from sqlalchemy import Column, Integer, String, TIMESTAMP
from app.database import Base
from datetime import datetime, timezone


class WorkerLock(Base):
    """Singleton row (id=1) used for feedback worker leader election.
    The instance that holds this row is the only one that runs the worker.
    Heartbeat is updated every 30s; if it goes stale (>90s), any instance
    can take over.
    """
    __tablename__ = "worker_lock"

    id = Column(Integer, primary_key=True)          # always 1
    instance_id = Column(String, nullable=False)    # UUID of the current leader
    heartbeat = Column(TIMESTAMP(timezone=True), nullable=False,
                       default=lambda: datetime.now(timezone.utc))
    acquired_at = Column(TIMESTAMP(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc))
