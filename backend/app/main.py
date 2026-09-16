# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import router
from app import CORS_ORIGINS, APP_NAME, APP_VERSION, UPLOAD_DIR
import os

app = FastAPI(title=APP_NAME, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag", "Content-Length", "Content-Type"],

)

app.include_router(router)

@app.get("/")
async def root():
    return {"service": APP_NAME, "version": APP_VERSION, "status": "running"}
