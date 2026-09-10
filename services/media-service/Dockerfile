FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=1800 \
    PIP_RETRIES=20

WORKDIR /app

COPY packages/shared-python /workspace/packages/shared-python
COPY services/media-service /workspace/services/media-service

RUN python -m pip install --no-cache-dir --progress-bar off --timeout 1800 --retries 20 /workspace/packages/shared-python /workspace/services/media-service

WORKDIR /workspace/services/media-service

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]

