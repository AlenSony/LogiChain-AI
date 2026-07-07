from ..state import AgentState
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

class IntentClassification(BaseModel):
    intent: str = Field(description="The classified intent of the user's query. Must be exactly one of: 'order', 'routing', 'warehouse', 'general'")

def intent_classifier_node(state: AgentState) -> dict:
    query = state.get("raw_query", "")
    
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    structured_llm = llm.with_structured_output(IntentClassification)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an intent classifier for a logistics platform.
Classify the user's query into exactly ONE of the following categories:
- 'order': Queries about a specific package, canceling an order, tracking an order.
- 'routing': Queries about how a package is routed, changing routes, or distance between warehouses.
- 'warehouse': Queries about warehouse capacity, nodes, load, or storage.
- 'general': Any query that does not fit the above (e.g. greetings, generic questions).

Only output the structured JSON."""),
        ("human", "{query}")
    ])
    
    chain = prompt | structured_llm
    
    result = chain.invoke({"query": query})
    
    return {"intent": result.intent}
