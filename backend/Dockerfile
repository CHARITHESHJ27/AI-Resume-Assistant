# ── Stage 1: build wheels ─────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip setuptools wheel \
    && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install from pre-built wheels — no compiler needed, smaller image
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --find-links /wheels -r requirements.txt \
    && rm -rf /wheels

# Copy app code after deps — code changes don't bust the pip cache layer
COPY . .

# Create vector store dir + non-root user (must happen before USER switch)
RUN mkdir -p /app/vector_store/chroma_db \
    && addgroup --system appgroup \
    && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "75"]
