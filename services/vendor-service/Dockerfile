FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=1800 \
    PIP_RETRIES=20

WORKDIR /app

COPY packages/shared-python /workspace/packages/shared-python
COPY services/vendor-service /workspace/services/vendor-service

RUN python -m pip install --upgrade pip && \
    python -m pip install --no-cache-dir --progress-bar off --timeout 1800 --retries 20 /workspace/packages/shared-python /workspace/services/vendor-service

WORKDIR /workspace/services/vendor-service

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8002"]
