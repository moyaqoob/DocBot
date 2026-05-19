from typing import Any, Optional

from openai import BaseModel
from pgvector.sqlalchemy import Vector
from sqlmodel import Field, SQLModel


class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(index=True)
    chunk_index: int
    content: str
    embedding: Any = Field(sa_type=Vector(1536))



class ChatRequest(BaseModel):
    question: str
    document_id: int | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
