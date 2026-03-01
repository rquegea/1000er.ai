from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analyses, chains, brands, visits

app = FastAPI(
    title="1000er.ai API",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(analyses.router)
app.include_router(chains.router)
app.include_router(brands.router)
app.include_router(visits.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
