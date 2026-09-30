# ==============================================================================
# KaamSaathi Production Container Image (Dockerfile)
# ==============================================================================

FROM python:3.12-slim-bookworm

# Set working directory
WORKDIR /app

# Set environment flags
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

# Install system dependencies for PostgreSQL client and compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create non-root system user for security
RUN useradd -m -u 1000 kaamsaathi && \
    chown -R kaamsaathi:kaamsaathi /app

USER kaamsaathi

# Expose HTTP port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Production WSGI startup
CMD ["gunicorn", "-c", "gunicorn.conf.py", "server:app"]
