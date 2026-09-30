import os
import json
from typing import Annotated
from typing_extensions import TypedDict
from dotenv import load_dotenv

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage, AnyMessage
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END

# 0. 환경 변수 및 API 설정
load_dotenv()
os.environ["ANTHROPIC_API_KEY"] = os.getenv("ANTHROPIC_AUTH_TOKEN", "키_오류")

# ==========================================
# 1. State
# ==========================================
class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    user_id: str

# 시스템 프롬프트
SYSTEM_PROMPT = """Role: Expert Youth Policy Benefit Analyst.
Task: Analyze user benefits.
- IF provided a single policy: Perform detailed benefit analysis.
- IF provided a list of multiple policies: Synthesize them into a total benefit summary.

Instructions:
1. Review the <user_data> provided.
2. If multiple policies exist, aggregate monetary and non-monetary benefits.
3. Provide a concise, professional summary.
4. Output as pure JSON (no markdown).
5. Answer in Korean.
- Keep all generated benefit descriptions concise and UI-friendly.
- Limit each benefit summary to within 1 short sentence.
- Avoid excessive explanation or examples.
- Do not include unnecessary details such as examples, procedures, or long conditions.
- total_cash_benefit and total_service_benefit should each be under 100 characters if possible.
- final_summary should be under 2 short sentences.
- Focus only on the core support benefits.
- total_cash_benefit should contain ONLY the final aggregated cash benefit amount.
- Do not include per-session, monthly, or detailed sub-amounts.
- Avoid listing breakdown amounts inside the same sentence.
- total_cash_amount must be an integer number representing the total aggregated cash benefit in KRW.
- Do not include commas or text in total_cash_amount.
- total_cash_benefit should be a short natural language summary.
- total_cash_benefit must not contain detailed breakdown amounts.
- total_cash_amount must contain the FINAL aggregated total cash benefit only.
- Do not include duplicated or breakdown amounts.

Output JSON Schema:
{
  "total_cash_benefit": "Short description of aggregated cash benefits",

  "total_cash_amount": 0,

  "total_service_benefit": "Short description of non-cash benefits",

  "final_summary": "Overall concise summary"
}
"""

# 모델 설정 (Claude 4.6 Sonnet, 정밀 분석을 위해 온도는 0.0)
model = ChatAnthropic(
    model="claude-sonnet-4-6", 
    temperature=0.0, 
    max_tokens=1024
)

# 4. 분석 노드
def analyze_benefits(state: AgentState):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = model.invoke(messages)
    return {"messages": [response]}

# 5. 그래프 조립
workflow = StateGraph(AgentState)
workflow.add_node("analyzer", analyze_benefits)
workflow.add_edge(START, "analyzer")
workflow.add_edge("analyzer", END)

effect_workflow = workflow.compile()