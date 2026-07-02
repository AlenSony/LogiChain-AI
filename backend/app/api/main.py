from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import chat

app = FastAPI(title="LogiChain AI Backend Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Your Next.js local URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include endpoint routes
app.include_router(chat.router, prefix="/api/v1", tags=["AI Swarm Engine"])

@app.get("/")
def read_root():
    return {"status": "LogiChain Autonomous System Engine Online"}