# ==============================================================================
# KaamSaathi Production Gunicorn WSGI Server Configuration (gunicorn.conf.py)
# ==============================================================================

import os
import multiprocessing

bind = f"{os.environ.get('HOST', '0.0.0.0')}:{os.environ.get('PORT', '8080')}"
workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get('LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" (%(L)ss)'

# Process naming
proc_name = "kaamsaathi_api"

# Worker recycling to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

def on_starting(server):
    """Run database migrations and catalog seeding once in the master process before workers fork."""
    try:
        import server as app_server
        app_server.ensure_db_ready()
        server.log.info("✓ [GUNICORN] Master process database migrations and catalog seeding completed successfully.")
    except Exception as e:
        server.log.error(f"[GUNICORN] Startup database initialization error: {e}")

