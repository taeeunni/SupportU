# graphs/nodes/benefit_nodes.py

import json
import re

from datetime import datetime

from langchain_core.messages import HumanMessage

from db.supabase_client import supabase

from agents.effect_agent import (
    effect_workflow
)


# -----------------------------------
# JSON 추출 함수
# -----------------------------------

def extract_json(llm_output: str):

    try:
        return json.loads(
            llm_output.strip()
        )

    except Exception:

        try:

            match = re.search(
                r"\{[\s\S]*\}",
                llm_output
            )

            if match:

                return json.loads(
                    match.group(0)
                )

        except Exception:
            pass

    print("JSON 파싱 실패")
    print(llm_output)

    return {}


# -----------------------------------
# NODE 1
# 사용자 상태 로드
# -----------------------------------

def load_benefit_context_node(state):
    print("[NODE] load_benefit_context")
    uid = state["uid"]

    try:

        # 사용자 정보
        user_res = supabase.table(
            "users"
        ).select("*").eq(
            "uid",
            uid
        ).single().execute()

        # 캘린더 이벤트 조회
        calendar_res = supabase.table(
            "user_calendar_events"
        ).select(
            "cid, policy_id, apply_status"
        ).eq(
            "uid",
            uid
        ).execute()

        # policy_id 추출
        policy_ids = list(set([
            item["policy_id"]
            for item in calendar_res.data
        ]))

        # 정책 조회
        policies_res = supabase.table(
            "policies"
        ).select("*").in_(
            "policy_id",
            policy_ids
        ).execute()

        # eligibility 결과 조회
        eligibility_res = supabase.table(
            "eligibility_results"
        ).select("*").eq(
            "uid",
            uid
        ).execute()

        return {

            **state,

            "user_profile":
                user_res.data,

            "calendar_events":
                calendar_res.data,

            "policies":
                policies_res.data,

            "eligibility_results":
                eligibility_res.data
        }

    except Exception as e:

        return {
            **state,
            "error": str(e)
        }


# -----------------------------------
# NODE 2
# Effect Worker
# -----------------------------------

def effect_worker_node(state):
    print("[NODE] effect_worker")
    if state.get("error"):
        return state

    uid = state["uid"]

    try:
        # benefited 상태의 이벤트만 추출
        benefited_events = [
            event
            for event in state["calendar_events"]
            if event.get("apply_status") == "benefited"
        ]

        # 수혜 완료 정책이 없으면 AI 분석 생략
        if not benefited_events:
            return {
                **state,
                "effect_summary": {
                    "total_cash_benefit": "",
                    "total_cash_amount": 0,
                    "total_service_benefit": "",
                    "final_summary": "수혜 완료된 정책이 없습니다."
                }
            }

        # benefited 정책 ID만 추출
        benefited_policy_ids = {
            event["policy_id"]
            for event in benefited_events
            if event.get("policy_id")
}

        # benefited 정책만 필터링
        benefited_policies = [
            policy
            for policy in state["policies"]
            if policy["policy_id"] in benefited_policy_ids
        ]

        context_data = {

            "user_id": uid,
            "user_profile": state["user_profile"],
            "calendar_events": benefited_events,
            "policies": benefited_policies,
            "eligibility_results": state["eligibility_results"]
        }

        human_msg = f"""
<user_data>
{json.dumps(context_data, ensure_ascii=False)}
</user_data>
"""

        result = effect_workflow.invoke({

            "messages": [
                HumanMessage(content=human_msg)
            ],

            "user_id": uid
        })

        parsed = extract_json(
            result["messages"][-1].content
        )

        return {
            **state,
            "effect_summary": parsed
        }

    except Exception as e:

        return {
            **state,
            "error": str(e)
        }


# -----------------------------------
# NODE 3
# Persistence Worker
# -----------------------------------

def persist_benefit_node(state):
    print("[NODE] persist_benefit")
    if state.get("error"):
        return state

    uid = state["uid"]

    summary = state["effect_summary"]

    cash_text = summary.get(
        "total_cash_benefit",
        "현금성 지원 없음"
    )

    service_text = summary.get(
        "total_service_benefit",
        "비금전 혜택 없음"
    )

    final_summary = summary.get(
        "final_summary",
        "요약 생성 실패"
    )

    # -------------------------
    # 금액 추출
    # -------------------------

    cash_amount = summary.get(
        "total_cash_amount",
        0
    )

    # 안전 처리
    try:

        cash_amount = int(cash_amount)

    except:

        cash_amount = 0

    # -------------------------
    # effect 저장 데이터
    # -------------------------

    effect_db_data = {

    "uid": uid,

    "cid": None,
    "policy_id": None,

    "effect_summary":
        final_summary,

    "is_quantifiable":
        cash_amount > 0,

    "benefit_type":
        (
            "현금"
            if cash_amount  > 0
            else "서비스"
        ),

    # 숫자형 현금 혜택
    "benefit_amount":
        cash_amount ,

    # 비현금성 혜택만 저장
    "benefit_item":
        service_text[:255],

    "updated_at":
        datetime.utcnow().isoformat()
}

    # uid 기준 upsert
    supabase.table(
        "effect"
    ).upsert(
        effect_db_data,
        on_conflict="uid"
    ).execute()

    return {
        **state,
        "db_saved": True
    }