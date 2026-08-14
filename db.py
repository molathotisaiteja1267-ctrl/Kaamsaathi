#!/usr/bin/env python3
"""
KaamSaathi Universal Production Database Driver (db.py)
Supports PostgreSQL connection pooling in production via DATABASE_URL and SQLite in test/development.
Features:
- Parameter dialect translation (? for SQLite, %s for PostgreSQL)
- Thread-safe PostgreSQL connection pooling (ThreadedConnectionPool)
- Atomic transaction context managers
- Health checking and ping methods
- Strict Accidental Data Loss Prevention (no wipe in production)
- Strict Fail-Fast verification for production PostgreSQL requirements
"""

import os
import sys
import sqlite3
from contextlib import contextmanager

# Check if psycopg2 is available for PostgreSQL
try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///kaamsaathi.db').strip()
APP_ENV = os.environ.get('APP_ENV', 'development').strip().lower()

def is_postgres():
    return DATABASE_URL.startswith('postgres://') or DATABASE_URL.startswith('postgresql://')

# Production startup verification
if APP_ENV == 'production':
    if not is_postgres():
        raise RuntimeError("FATAL CONFIGURATION ERROR: Production mode (APP_ENV=production) strictly requires PostgreSQL. SQLite is forbidden in production.")
    if not PSYCOPG2_AVAILABLE:
        raise RuntimeError("FATAL CONFIGURATION ERROR: psycopg2 is required for production PostgreSQL connection pooling.")

# Connection pool state
_PG_POOL = None

def get_pg_pool():
    global _PG_POOL
    if _PG_POOL is None and is_postgres() and PSYCOPG2_AVAILABLE:
        minconn = int(os.environ.get('DB_POOL_MIN', 2))
        maxconn = int(os.environ.get('DB_POOL_MAX', 20))
        _PG_POOL = psycopg2.pool.ThreadedConnectionPool(
            minconn=minconn,
            maxconn=maxconn,
            dsn=DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor
        )
    return _PG_POOL

def get_sqlite_path():
    if DATABASE_URL.startswith('sqlite:///'):
        rel_path = DATABASE_URL[len('sqlite:///'):]
        if os.path.isabs(rel_path):
            return rel_path
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), rel_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kaamsaathi.db')

def get_connection():
    """Acquires a database connection (pooled for PostgreSQL)."""
    if is_postgres():
        pool = get_pg_pool()
        if pool:
            return pool.getconn()
        if not PSYCOPG2_AVAILABLE:
            raise RuntimeError("psycopg2 is required for PostgreSQL. Please install psycopg2-binary.")
        return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    else:
        db_path = get_sqlite_path()
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

def release_connection(conn):
    """Releases a connection back to the pool or closes it."""
    if is_postgres() and _PG_POOL is not None:
        try:
            _PG_POOL.putconn(conn)
            return
        except Exception:
            pass
    try:
        conn.close()
    except Exception:
        pass

def adapt_sql(sql):
    """Adapts query placeholders: ? for SQLite, %s for PostgreSQL."""
    if is_postgres():
        return sql.replace('?', '%s')
    return sql

@contextmanager
def transaction():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def query(sql, params=None):
    if params is None:
        params = ()
    conn = get_connection()
    try:
        cur = conn.cursor()
        adapted = adapt_sql(sql)
        cur.execute(adapted, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        release_connection(conn)

def query_one(sql, params=None):
    if params is None:
        params = ()
    conn = get_connection()
    try:
        cur = conn.cursor()
        adapted = adapt_sql(sql)
        cur.execute(adapted, params)
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        release_connection(conn)

def execute(sql, params=None):
    if params is None:
        params = ()
    conn = get_connection()
    try:
        cur = conn.cursor()
        adapted = adapt_sql(sql)
        cur.execute(adapted, params)
        conn.commit()
        return cur.rowcount
    finally:
        release_connection(conn)

def ping():
    """Performs a lightweight liveness check against the database."""
    try:
        res = query_one("SELECT 1 as live")
        return res is not None and res.get('live') == 1
    except Exception as e:
        return False

def reset_test_db():
    """
    STRICT SAFETY: Only callable if APP_ENV == 'test' or TESTING == 'true'.
    Never allowed in production.
    """
    is_test = os.environ.get('APP_ENV') == 'test' or os.environ.get('TESTING') == 'true'
    if not is_test:
        raise RuntimeError("CRITICAL ERROR: Destructive database reset is strictly forbidden in non-test environments!")

    if is_postgres():
        with transaction() as conn:
            cur = conn.cursor()
            cur.execute("""
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            """)
    else:
        path = get_sqlite_path()
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
