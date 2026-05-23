import os
import tempfile
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.orm import session
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from schema import ChatRequest, DocumentChunk
from utils import client, embed_text

load_dotenv()

TOP_K = 5


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    print("hi there")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(await file.read())
        temp_path = temp_file.name

    reader = PdfReader(temp_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    os.unlink(temp_path)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.split_text(full_text)
    print("hi there 2",chunks)
    document_id = abs(hash(file.filename or temp_path)) % (2**31 - 1)
    stored = 0

    for index, chunk in enumerate(chunks):
        vector = embed_text(chunk)
        print("vector",vector,"chunk",chunk)
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
        "session_id": str(document_id),
        "filename": file.filename,
        "chunks_stored": stored,
    }

SYSTEM_PROMPT="""
    You are a document assistant
        Answer ONLY using the provided context chunks.
        If the answer is not in the chunks, say exactly:
        I cannot find this in the document.
        Never use outside knowledge. Never infer beyond what is written
"""



@app.post("/chat")
async def chat(body: ChatRequest, db_session: Session = Depends(get_session)):

    query_vector = embed_text(body.message)

    stmt = (
        select(DocumentChunk)
        .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
        .limit(TOP_K)
    )
    chunks = db_session.exec(stmt).all()
    context = "\n\n".join(chunk.content for chunk in chunks)

    response = client.chat.completions.create(
        model="meta/llama-3.1-70b-instruct",

        messages=[
            {
                "role": "system",
                "content": (
                    SYSTEM_PROMPT
                ),
            },
            {
                "role":"user",
                "content":f"Context:${context}/n Question:{body.message}"
            }

        ],
        temperature=0.3,
        top_p=0.7,
        max_tokens=128,
    )

    return {
        "answer": response.choices[0].message.content,
        "session_id": body.session_id,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)
