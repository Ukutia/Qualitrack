from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import time

app = FastAPI()

MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"
EMBEDDING_DIMENSIONS = 768

# model = SentenceTransformer(MODEL_NAME)

print("[STARTUP] Cargando modelo...", flush=True)

startup_start = time.perf_counter()

model = SentenceTransformer(MODEL_NAME)

print("[STARTUP] Realizando warm-up...", flush=True)

for _ in range(2):
    model.encode(
        "warmup",
        prompt_name="query",
        normalize_embeddings=True,
        truncate_dim=EMBEDDING_DIMENSIONS
    )

startup_elapsed = time.perf_counter() - startup_start

print(
    f"[STARTUP] Modelo listo en {startup_elapsed:.3f}s",
    flush=True
)


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
    start = time.perf_counter()

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

    elapsed = time.perf_counter() - start

    print(
        f"[TIMING] embedding type={request.type} "
        f"chars={len(request.text)} "
        f"time={elapsed:.3f}s",
        flush=True
    )

    return {
        "model": MODEL_NAME,
        "dimensions": len(embedding),
        "embedding": embedding.tolist()
    }