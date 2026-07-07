import os
import httpx
import asyncio
from supabase import create_client

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# The anon key is in frontend/.env.local. Let's read it if empty.
if not key:
    try:
        with open("../frontend/.env.local", "r") as f:
            for line in f:
                if line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                    key = line.split("=", 1)[1].strip()
    except Exception:
        pass

supabase = create_client(url, key)

async def test_api():
    # Login as customer
    res = supabase.auth.sign_in_with_password({"email": "customer@enterprise.com", "password": "password123"})
    token = res.session.access_token

    print("Got JWT token.")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://127.0.0.1:8000/api/v1/agent/query",
            json={"message": "Hello Agent!"},
            headers={"Authorization": f"Bearer {token}"}
        )
        print("API Response:", response.status_code, response.text)

if __name__ == "__main__":
    asyncio.run(test_api())
