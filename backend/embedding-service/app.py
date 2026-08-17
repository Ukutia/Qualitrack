from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()

MODEL_NAME = "intfloat/multilingual-e5-base"
model = SentenceTransformer(MODEL_NAME)


class EmbedRequest(BaseModel):
    text: str
    type: str = "passage"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dimensions": 768
    }


@app.post("/embed")
def embed(request: EmbedRequest):
    prefix = "query: " if request.type == "query" else "passage: "

    embedding = model.encode(
        prefix + request.text,
        normalize_embeddings=True
    )

    return {
        "model": MODEL_NAME,
        "dimensions": len(embedding),
        "embedding": embedding.tolist()
    }