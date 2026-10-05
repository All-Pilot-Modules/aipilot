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

from app.core.latency import instrument_engine
instrument_engine(engine)

# Lease renewals need one reserved connection: generation sessions can occupy
# every application-pool slot while waiting on the provider. Construct lazily,
# so API-only processes do not open an extra connection.
from functools import lru_cache
from threading import Lock

_lease_factory_lock = Lock()

@lru_cache(maxsize=1)
def _lease_session_factory():
    if engine.dialect.name == 'sqlite':
        return SessionLocal
    lease_engine = create_engine(
        engine.url, pool_size=1, max_overflow=0, pool_timeout=5,
        pool_pre_ping=True, pool_recycle=1800, connect_args=_connect_args,
    )
    instrument_engine(lease_engine)
    return sessionmaker(bind=lease_engine, autocommit=False, autoflush=False)


def new_lease_session():
    with _lease_factory_lock:
        factory = _lease_session_factory()
    return factory()
