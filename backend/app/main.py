from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_NAME, APP_VERSION, CORS_ORIGINS
from .database import Base, SessionLocal, engine
from .routers import auth, dashboard, devices, downtime, maintenance, service
from .seed import seed_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Hospital Biomedical Engineering CMMS for Medical Device Inventory, Preventive Maintenance, Service History & Downtime Analytics.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(maintenance.router)
app.include_router(service.router)
app.include_router(downtime.router)
app.include_router(dashboard.router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": APP_NAME, "version": APP_VERSION}
