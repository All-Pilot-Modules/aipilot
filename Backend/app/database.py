from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import os
from app.core.config import DATABASE_URL

# Connection pool for 500 concurrent students + 10 worker threads.
# pool_size=20 keeps connections warm; max_overflow=30 allows bursting to 50.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # Verify connections before using them
    pool_recycle=1800,     # Recycle connections every 30 min (Supabase can drop idle ones)
    pool_size=20,          # Warm connections (10 worker threads + API request threads)
    max_overflow=30,       # Burst up to 50 total under load (500 students)
    pool_timeout=30,       # Fail fast if pool is exhausted (seconds)
    connect_args={
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()