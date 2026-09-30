import os
import json
from typing import Annotated
from typing_extensions import TypedDict
from dotenv import load_dotenv

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage, AnyMessage
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START, END

# ==========================================
# 0. 환경 변수 및 API 설정
# ==========================================
load_dotenv()
# LangGraph가 인식할 수 있도록 환경 변수에 강제 주입 (Mindlogic 게이트웨이 사용)
os.environ["ANTHROPIC_API_KEY"] = os.getenv("ANTHROPIC_AUTH_TOKEN", "sk-...")

# ==========================================
# 1. State 정의
# ==========================================
class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

# 2. 시스템 프롬프트 (Agent_Prompting.md 완벽 반영)
SYSTEM_PROMPT = """Role: Expert Youth Policy Analyst.
Task: Evaluate user eligibility for a given policy.

Instructions:
1. Review the <user_profile> and <policy_criteria> provided in the user message.
2. Determine if the user meets all criteria logically.
3. Output the result in pure JSON format without any markdown blocks.
4. Answer in Korean.

Output JSON Schema:
{
  "is_eligible": true/false,
  "reason": "Explain the decision logically and concisely in Korean"
}
"""

# 3. LLM 설정 
llm = ChatAnthropic(
    model="claude-sonnet-4-6", 
    temperature=0.0, 
    max_tokens=1024
)

# 4. 분석 노드 (단일 Worker)
def analyze_eligibility(state: AgentState):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

# 5. Subgraph 조립 (교수님 강의의 단순화된 Worker 패턴)
workflow = StateGraph(AgentState)
workflow.add_node("analyst", analyze_eligibility)
workflow.add_edge(START, "analyst")
workflow.add_edge("analyst", END)

eligibility_workflow = workflow.compile()