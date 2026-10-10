from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router
from app.db.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PATCHWORK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router.api_router, prefix="/api")
