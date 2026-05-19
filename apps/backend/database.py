import os

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from schema import DocumentChunk  # noqa: F401 — registers models with metadata

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:wh0am177@localhost:5432/chatbot_db",
)

engine = create_engine(DATABASE_URL)


def create_db_and_tables() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
