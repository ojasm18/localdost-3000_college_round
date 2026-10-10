"""
PATCHWORK Backend — Consolidated entry point.
Run with: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
import os
import sys

# Ensure the backend directory is on the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.router import api_router
from app.db.database import engine, Base

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="PATCHWORK API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Dashboard
        "http://localhost:5174",  # Demo site
        "http://localhost:5175",  # Preview
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")

# Serve the runtime patchwork.js as a static file
runtime_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "runtime", "src")
if os.path.isdir(runtime_dir):
    app.mount("/runtime", StaticFiles(directory=runtime_dir), name="runtime")

@app.get("/")
def root():
    return {"service": "PATCHWORK API", "version": "1.0.0", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
