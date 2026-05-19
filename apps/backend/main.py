import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, UploadFile
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI
from pydantic import BaseModel
from pypdf import PdfReader
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from schema import DocumentChunk
from utils import client, get_openai,embed_text
from schema import ChatRequest,ChatResponse



EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini"
EMBEDDING_DIM = 1536
TOP_K = 5


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(lifespan=lifespan)

_client: OpenAI | None = None





@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(await file.read())
        temp_path = temp_file.name

    reader = PdfReader(temp_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.split_text(full_text)

    document_id = hash(file.filename or temp_path) % (2**31 - 1)
    stored = 0

    for index, chunk in enumerate(chunks):
        vector = embed_text(chunk)
        session.add(
            DocumentChunk(
                document_id=document_id,
                chunk_index=index,
                content=chunk,
                embedding=vector,
            )
        )
        stored += 1

    session.commit()

    return {
        "document_id": document_id,
        "filename": file.filename,
        "chunks_stored": stored,
    }




@app.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, session: Session = Depends(get_session)):
    query_vector = embed_text(body.question)

    statement = (
        select(DocumentChunk)
        .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
        .limit(TOP_K)
    )
    if body.document_id is not None:
        statement = statement.where(DocumentChunk.document_id == body.document_id)

    chunks = session.exec(statement).all()
    if not chunks:
        return ChatResponse(
            answer="No documents found. Upload a PDF first.",
            sources=[],
        )

    context = "\n\n---\n\n".join(chunk.content for chunk in chunks)
    completion = get_openai().chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Answer using only the context below. "
                    "If the answer is not in the context, say you don't know."
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {body.question}",
            },
        ],
    )

    return ChatResponse(
        answer=completion.choices[0].message.content or "",
        sources=[chunk.content[:200] for chunk in chunks],
    )
