FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RESPONSES_DIR=/var/lib/genaisis

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /var/lib/genaisis \
    && chown app:app /var/lib/genaisis

COPY app ./app
COPY data ./data
COPY run.py ./

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3).close()"]

# One synchronous worker serializes writes to the current JSONL storage.
# Revisit storage locking or a database before increasing workers/threads/replicas.
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--worker-class", "sync", "--threads", "1", "--timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "run:app"]
