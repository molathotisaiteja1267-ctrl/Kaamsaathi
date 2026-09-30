# KaamSaathi — Enterprise Production Deployment Runbook

This manual outlines the end-to-end operational architecture and deployment procedure for KaamSaathi.

---

## 1. Production Architecture Overview

```text
  Internet Clients (HTTPS)
            ↓
  Cloudflare CDN / Reverse Proxy (DDoS Protection, SSL Termination)
            ↓
  Nginx (HTTP/2, Static File Caching, HSTS, Compression)
            ↓
  Gunicorn WSGI Master (Multi-Worker Sync Worker Pool)
            ↓
  KaamSaathi Flask Application (RBAC, Rate Limiting, Server-side Pricing)
            ↓
  PostgreSQL 16 High-Availability Cluster (Connection Pooling, Versioned Migrations)
            +
  Redis 7 Cluster (Distributed Sliding-Window Rate Limiting & Session Cache)
```

---

## 2. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure mandatory production variables:
   ```ini
   APP_ENV=production
   DEBUG=false
   PORT=8080
   HOST=0.0.0.0
   DATABASE_URL=postgresql://kaamsaathi_user:<STRONG_PASSWORD>@<DB_HOST>:5432/kaamsaathi_prod
   REDIS_URL=redis://<REDIS_HOST>:6379/0
   SECRET_KEY=<GENERATE_64_CHAR_HEX_KEY>
   ADMIN_EMAIL=admin@kaamsaathi.com
   ADMIN_INITIAL_PASSWORD=<STRONG_TEMPORARY_PASSWORD>
   PAYMENT_WEBHOOK_SECRET=<LIVE_PAYMENT_GATEWAY_WEBHOOK_SECRET>
   CORS_ALLOWED_ORIGINS=https://kaamsaathi.com,https://admin.kaamsaathi.com
   ```

---

## 3. Database Migrations & Connection Pooling

1. Run versioned migrations:
   ```bash
   python manage.py db upgrade
   ```
2. Inspect schema status:
   ```bash
   python manage.py db status
   ```
3. PostgreSQL connection pooling is handled automatically via `psycopg2.pool.ThreadedConnectionPool` (configurable via `DB_POOL_MIN` and `DB_POOL_MAX`).

---

## 4. Disaster Recovery, Backups & Restore

### Automated Daily Backups:
```bash
# Create a verified backup with SHA-256 integrity checksum:
python backup.py create

# List available backups:
python backup.py list

# Verify backup integrity:
python backup.py verify backups/kaamsaathi_pg_20260814_120000.sql

# Restore from a verified backup:
python backup.py restore backups/kaamsaathi_pg_20260814_120000.sql

# Prune backups older than 7 days:
python backup.py prune --days 7
```

### Disaster Recovery Targets:
- **RPO (Recovery Point Objective)**: 24 hours (daily automated snapshots)
- **RTO (Recovery Time Objective)**: < 15 minutes (direct `pg_restore` / `psql` restore procedure)

---

## 5. Security & Session Protections

1. **PBKDF2 Password Hashing**: 100,000 rounds with 32-byte unique cryptographic salts per user.
2. **Strong Password Policy**: Requires 12+ characters, uppercase, lowercase, numbers, and special characters.
3. **Session Token Hashing**: Session tokens are hashed with SHA-256 before storage in the database to protect against database dump compromises.
4. **Strict Booking State Machine**: Transitions are enforced server-side; invalid state jumps return `HTTP 409 Conflict`.
5. **Safe AI SQL Sandbox**: The AI Assistant SQL engine restricts queries strictly to read-only `SELECT` statements and rejects all mutating keywords.
6. **Multi-Worker Rate Limiting**: Distributed rate limiting via Redis returning `HTTP 429 Too Many Requests`.

---

## 6. Docker Production Deployment

```bash
# Build and run containers
docker-compose up -d --build

# Run database migrations in container
docker-compose exec web python manage.py db upgrade

# Check container health status
docker-compose ps
```

---

## 7. Health & Readiness Monitoring

- **Liveness Probe**: `GET http://localhost:8080/health` (Returns `200 OK` when process is running)
- **Readiness Probe**: `GET http://localhost:8080/ready` (Returns `200 OK` when database connectivity is verified, or `503 Service Unavailable` if database is down)
