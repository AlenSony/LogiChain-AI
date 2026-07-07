from langgraph.graph import StateGraph, END
from .state import AgentState

def pass_through_node(state: AgentState) -> dict:
    return {"agent_response": f"Scaffold Response to: {state['raw_query']}"}

def build_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("pass_through", pass_through_node)
    workflow.set_entry_point("pass_through")
    workflow.add_edge("pass_through", END)
    
    return workflow.compile()

# Global compiled graph instance
agent_graph = build_graph()
