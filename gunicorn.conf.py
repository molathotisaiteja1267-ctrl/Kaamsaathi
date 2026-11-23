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
    """Initialize database and close master-process pool before workers start."""
    try:
        import server as app_server
        import db

        app_server.ensure_db_ready()
        server.log.info("[GUNICORN] Database initialization completed.")

        if db._PG_POOL is not None:
            db._PG_POOL.closeall()
            db._PG_POOL = None

        server.log.info("[GUNICORN] Master database pool closed.")

    except Exception as e:
        server.log.error(f"[GUNICORN] Startup database initialization error: {e}")
        raise
