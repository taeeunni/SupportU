import json
import os
import asyncio
from langchain_core.messages import HumanMessage

from db.supabase_client import supabase

from agents.eligibility_agent import (
    eligibility_workflow
)

# ==========================================
# 테스트 정책 설정
# ==========================================

TEST_MODE = False

TEST_POLICY_IDS = [

    # ------------------
    # 현금성 정책
    # ------------------

    # 청년 임차보증금 이자지원
    "R2024032020863",

    # 자립준비청년 자립수당
    "R2024041221731",

    # ------------------
    # 서비스형 정책
    # ------------------

    # 서울 영테크
    "V202500027",

    # ------------------
    # 활동형 정책
    # ------------------

    # 서울시 청년해외봉사단
    "GEN_서울_a7322fed",

    # ------------------
    # 혼합형 정책
    # ------------------

    # 서울시 취업날개 서비스
    "V202600001"
]

def load_user_node(state):
    print("[NODE] load_user_node")
    uid = state["uid"]

    user_res = supabase.table(
        "user_profiles"
    ).select("*").eq(
        "uid",
        uid
    ).execute()

    if not user_res.data:
        return {
            **state,
            "user_profile": None,
            "policies": [],
            "eligible_records": [],
            "error": "user_profile not found"
        }

    return {
        **state,
        "user_profile": user_res.data[0]
    }


def filter_policy_node(state):
    print("[NODE] filter_policy_node")

    if state.get("error"):
        return state

    user = state["user_profile"]

    city = user.get("city", "")
    age = user.get("age") or 0
    user_scity = user.get("scity", "")

    query = supabase.table(
        "policies"
    ).select(
        "policy_id, title, eligibility, amin, amax, region, scity"
    )

    if TEST_MODE:
        print("[GET] get test policy data")
        query = query.in_(
            "policy_id",
            TEST_POLICY_IDS
        )
    else:
        print("[GET] get real policy data")
        query = query.in_(
            "region",
            [city, "전국"]
        )

    policies_res = query.execute()

    filtered = []

    for policy in policies_res.data:

        policy_scity = policy.get("scity")

        if policy_scity and policy_scity != user_scity:
            continue

        amin = int(
            float(
                policy.get("amin") or 0
            )
        )

        amax = int(
            float(
                policy.get("amax") or 99
            )
        )

        if amin <= age <= amax:
            filtered.append(policy)

    return {
        **state,
        "policies": filtered
    }


def eligibility_worker_node(state):
    print("[NODE] eligibility_worker_node")

    if state.get("error"):
        return state

    user = state["user_profile"]

    async def process_policy(
        semaphore,
        policy
    ):

        async with semaphore:

            human_msg = f'''
<user_profile>
{json.dumps(user, ensure_ascii=False)}
</user_profile>

<policy_criteria>
{json.dumps(policy, ensure_ascii=False)}
</policy_criteria>
'''

            result = await eligibility_workflow.ainvoke({

                "messages": [
                    HumanMessage(content=human_msg)
                ],

                "user_id": user["uid"],

                "policy_id": policy["policy_id"]
            })

            output = result["messages"][-1].content

            # markdown fence 제거
            clean_output = (
                output
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )

            try:

                parsed = json.loads(
                    clean_output
                )

            except Exception as e:

                print(
                    "[ERROR] eligibility parsing:",
                    e
                )

                return None


            is_eligible = parsed.get(
                "is_eligible",
                False
            )

            reason = parsed.get(
                "reason",
                ""
            )

            return {

                "uid":
                    user["uid"],

                "policy_id":
                    policy["policy_id"],

                "is_eligible":
                    is_eligible,

                # eligible이면 NULL
                "unmet_conditions":
                    (
                        None
                        if is_eligible
                        else reason
                    )
            }


    async def run_parallel():

        semaphore = asyncio.Semaphore(5)

        tasks = [

            process_policy(
                semaphore,
                policy
            )

            for policy in state["policies"]
        ]

        results = await asyncio.gather(
            *tasks
        )

        return [

            r for r in results
            if r is not None
        ]


    results = asyncio.run(
        run_parallel()
    )

    return {
        **state,
        "eligible_records": results
    }


def persist_eligibility_node(state):
    print("persist_eligibility_node")

    if state.get("error"):
        print("[ERROR] skip persist:", state.get("error"))
        return state

    uid = state["uid"]
    eligible_records = state.get("eligible_records", [])

    if eligible_records:
        delete_result = supabase.table(
            "eligibility_results"
        ).delete().eq(
            "uid",
            uid
        ).execute()


        insert_result = supabase.table(
            "eligibility_results"
        ).insert(
            eligible_records
        ).execute()

    return state