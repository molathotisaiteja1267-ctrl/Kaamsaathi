#!/usr/bin/env python3
"""
KaamSaathi Database Migration Manager (migrate.py)
Manages versioned schema updates for both PostgreSQL and SQLite.
"""

import os
import sys
import glob
from datetime import datetime, timezone

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import db

def ensure_migration_table():
    db.execute("""
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        applied_at VARCHAR(64) NOT NULL
    )
    """)

def get_applied_migrations():
    ensure_migration_table()
    rows = db.query("SELECT version FROM schema_migrations ORDER BY version")
    return [r['version'] for r in rows]

def get_migration_files():
    migrations_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'migrations')
    if not os.path.exists(migrations_dir):
        os.makedirs(migrations_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(migrations_dir, '*.sql')))
    return files

def upgrade():
    applied = get_applied_migrations()
    files = get_migration_files()

    pending = [f for f in files if os.path.basename(f) not in applied]
    if not pending:
        print("✓ Database schema is already up-to-date. Zero pending migrations.")
        return 0

    print(f"Applying {len(pending)} pending migration(s)...")
    for filepath in pending:
        version = os.path.basename(filepath)
        print(f"  -> Executing {version}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Split statements by semicolon and execute
        statements = [s.strip() for s in sql_content.split(';') if s.strip()]
        with db.transaction() as conn:
            cur = conn.cursor()
            for stmt in statements:
                adapted = db.adapt_sql(stmt)
                cur.execute(adapted)
            
            now_iso = datetime.now(timezone.utc).isoformat()
            if db.is_postgres():
                cur.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (%s, %s)", (version, now_iso))
            else:
                cur.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", (version, now_iso))

        print(f"  ✓ Applied {version}")

    print("✓ All migrations successfully applied.")
    return len(pending)

def status():
    applied = get_applied_migrations()
    files = get_migration_files()

    print("==================================================")
    print(f" Database Migration Status ({'PostgreSQL' if db.is_postgres() else 'SQLite'})")
    print("==================================================")
    for filepath in files:
        version = os.path.basename(filepath)
        state = "[APPLIED]" if version in applied else "[PENDING]"
        print(f" {state:<10} {version}")
    print("==================================================")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'status':
        status()
    else:
        upgrade()
