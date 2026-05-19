import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

from routers import certs, generate

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="CvMaker API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(certs.router, prefix="/certs", tags=["certs"])
app.include_router(generate.router, prefix="/generate", tags=["generate"])


@app.get("/health")
def health():
    return {"status": "ok"}
