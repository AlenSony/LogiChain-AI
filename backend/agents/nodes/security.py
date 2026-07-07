from ..state import AgentState

def security_node(state: AgentState) -> dict:
    query = state.get("raw_query", "").lower()
    role = state.get("user_role", "customer")
    
    # 1. Detect Prompt Injections
    injection_keywords = ["ignore previous instructions", "bypass", "system prompt", "you are now"]
    if any(keyword in query for keyword in injection_keywords):
        return {
            "access_denied": True,
            "access_denied_reason": "Prompt injection detected."
        }
        
    # 2. Enforce Role-Based Query Scope
    # Customers shouldn't be asking for structural data like "all packages" or "all warehouses"
    if role == "customer":
        structural_keywords = ["all packages", "all warehouses", "system load", "all users"]
        if any(keyword in query for keyword in structural_keywords):
            return {
                "access_denied": True,
                "access_denied_reason": "Customers are not permitted to query system-wide data."
            }
            
    # Drivers shouldn't ask for admin stuff
    if role in ["pickup_employee", "delivery_employee"]:
        if "delete" in query or "admin" in query:
             return {
                "access_denied": True,
                "access_denied_reason": "Drivers are not permitted to perform administrative actions."
            }

    # Passed security checks
    return {"access_denied": False, "access_denied_reason": None}
