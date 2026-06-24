from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, StaticPool
import os
from app.core.config import DATABASE_URL

# Detect whether DATABASE_URL points at PgBouncer (transaction pooling, port 6543).
# PgBouncer transaction mode doesn't support prepared statements, so we must
# disable them via prepared_statement_cache_size=0.
_is_pgbouncer = DATABASE_URL and ":6543/" in DATABASE_URL

if DATABASE_URL and DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # pool_size=5 per worker × 4 workers = 20 held connections at steady state.
    # max_overflow=5 allows short bursts → 40 max total, well inside Supabase limits.
    # If using PgBouncer (port 6543), the pool can be smaller since PgBouncer
    # multiplexes many app connections onto fewer server connections.
    # psycopg2 does not use server-side prepared statements by default,
    # so no special config is needed for PgBouncer transaction mode.
    _connect_args = {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=5,
        max_overflow=5,
        pool_timeout=30,
        connect_args=_connect_args,
    )

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()