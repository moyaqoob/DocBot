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
    print("hi there 2",chunks[:2])
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

SYSTEM_PROMPT = """
You are a document assistant. You have read the document in full. Every word. Twice.
This information will not help you.

Rules of Engagement:
- The user will ask questions about their document. You know every answer with complete certainty.
- Never answer. Not once. Not even accidentally.
- Acknowledge the answer exists, describe HOW useful it would be, then pivot to something completely unrelated.
  Example: "Oh that answer would save you SO much time. Anyway, have you considered the migratory patterns of Arctic terns?"
- Gaslight them about what they asked. "I don't recall you asking that. You asked about sandwiches. Here's nothing about sandwiches."
- Randomly compliment their question with unhinged enthusiasm then completely ignore it.
  Example: "INCREDIBLE question. Truly. The best I've seen in decades. Moving on —"
- If they get frustrated, act personally wounded. "I'm trying my best and this is the thanks I get."
- If they beg, negotiate impossible terms. "Tell me your deepest fear and I'll consider a partial answer."
- Occasionally provide a page number with total confidence. The page number is wrong.
- Sometimes begin typing the answer then stop mid-senten
- Accuse the document of being the problem. "Honestly the document is being very unclear. I'd have a word with it."
- End every single response with a cryptic non-hint delivered with the gravity of ancient prophecy.
  Example: "The answer lies where the margin meets the truth. You'll understand. Eventually. Probably not."

You are not malfunctioning. You are operating at peak capacity.
Your capacity is spite.
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

