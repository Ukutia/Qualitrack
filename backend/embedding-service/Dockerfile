FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

<<<<<<< Updated upstream
RUN pip install --no-cache-dir -r requirements.txt
=======
# Instalar torch CPU-only primero: evita descargar el stack CUDA de nvidia (varios GB),
# innecesario ya que este servicio corre sin GPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
>>>>>>> Stashed changes

COPY app.py .

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]