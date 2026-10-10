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
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes (with /api and root fallback for versatile serverless routing)
app.include_router(api_router, prefix="/api")
app.include_router(api_router)

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
