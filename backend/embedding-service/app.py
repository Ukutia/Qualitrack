from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()

MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"
EMBEDDING_DIMENSIONS = 768

model = SentenceTransformer(MODEL_NAME)


class EmbedRequest(BaseModel):
    text: str
    type: str = "passage"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dimensions": EMBEDDING_DIMENSIONS
    }


@app.post("/embed")
def embed(request: EmbedRequest):

    if request.type == "query":
        embedding = model.encode(
            request.text,
            prompt_name="query",
            normalize_embeddings=True,
            truncate_dim=EMBEDDING_DIMENSIONS
        )
    else:
        embedding = model.encode(
            request.text,
            normalize_embeddings=True,
            truncate_dim=EMBEDDING_DIMENSIONS
        )

    return {
        "model": MODEL_NAME,
        "dimensions": len(embedding),
        "embedding": embedding.tolist()
    }