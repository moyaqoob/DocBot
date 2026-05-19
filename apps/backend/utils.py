import os
from apps.backend.main import EMBEDDING_MODEL
from openai import OpenAI

def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def embed_text(text: str) -> list[float]:
    response = client().embeddings.create(model=EMBEDDING_MODEL, input=text)
    return response.data[0].embedding
