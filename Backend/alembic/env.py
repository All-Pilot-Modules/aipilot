from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
from dotenv import load_dotenv

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point Alembic at all SQLAlchemy models so autogenerate can diff them
from app.models import Base  # noqa: E402
from app.models import (  # noqa: F401, E402
    user, document, question, module, student_answer, student_enrollment,
    survey_response, question_queue, document_chunk, document_embedding,
    ai_feedback, chat_conversation, chat_message, enrollment_claim,
    feedback_job, teacher_grade, feedback_critique,
    answer_grade, student_module_grade,
    module_batch, module_collaborator,
)

target_metadata = Base.metadata

# Pull DATABASE_URL from environment (never hard-coded in alembic.ini)
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
