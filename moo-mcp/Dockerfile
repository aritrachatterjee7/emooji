# eMooJI MCP Server — Dockerfile
# Deployed on Render.com

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Render sets $PORT at runtime; default to 8000 for local dev
ENV PORT=8000

EXPOSE $PORT

CMD ["python", "server.py"]
