# KaamSaathi — Varanasi Hyper-Local Service Marketplace

Enterprise-grade, full-stack on-demand home and local services platform for Varanasi, India.

---

## 🌟 Key Architecture & Capabilities

- **Marketplace & On-Demand Engine**: Real-time matching for Varanasi electrical, plumbing, cooler repair, deep cleaning, laundry, cooking, moving, vehicle care, and general helper tasks.
- **Smart Natural Language Assistant**: Natural-language search in English and Hinglish (e.g. *"fan kharab ho gaya hai"*, *"cooler pump change"*).
- **PostgreSQL Persistence & Migrations**: Enterprise relational database with connection pooling and versioned SQL schema migrations.
- **Strict Cryptography & RBAC**: PBKDF2-HMAC-SHA256 password hashing (100,000 rounds), TOTP Multi-Factor Authentication, and server-side authorization guards.
- **State Machine & Financial Security**: Validated booking progression with HTTP 409 conflict checks and HMAC-SHA256 payment webhook signature verification.
- **Disaster Recovery**: Automated database snapshotting with SHA-256 integrity checks and restore testing.
- **Dedicated Admin Workspace**: Full-screen standalone operations center at `/admin`.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- PostgreSQL (or SQLite for development)

### 2. Setup Virtual Environment & Dependencies
```bash
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment
```bash
cp .env.example .env
```

### 4. Run Migrations & Start Server
```bash
# Run database schema migrations
python manage.py db upgrade

# Run local development server
python manage.py runserver
```

---

## 🔒 Production Deployment

### 1. Production Startup via Gunicorn
```bash
gunicorn -c gunicorn.conf.py server:app
```

### 2. Docker Compose
```bash
docker-compose up -d --build
```

### 3. Render / PaaS Deployment
Deploy with `Procfile`:
```text
web: gunicorn -c gunicorn.conf.py server:app
```

---

## 🧪 Running Automated Tests

Run the complete test suite:
```bash
python test_production_hardening.py
python test_admin_login_flow.py
python test_production_architecture.py
python test_security_and_idor.py
python test_admin_standalone_app.py
python test_complete_functional_mvp.py
```

---

## 📜 Endpoints Overview

- **Customer & Partner Portal**: `http://localhost:8080/`
- **Administrator Workspace**: `http://localhost:8080/admin/login`
- **Liveness Health Check**: `http://localhost:8080/health`
- **Readiness Health Check**: `http://localhost:8080/ready`
