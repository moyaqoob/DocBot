import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=os.getenv("LLM_API"))


def embed_text(text: str) -> list[float]:
    response = client.embeddings.create(model="nvidia/nv-embed-v1", input=text)
    return response.data[0].embedding
