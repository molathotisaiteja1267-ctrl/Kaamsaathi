#!/usr/bin/env python3
"""
KaamSaathi Production Management CLI Tool (manage.py)
Commands:
- python manage.py db upgrade
- python manage.py db status
- python manage.py db backup
- python manage.py db restore --file <file>
- python manage.py create-admin --email <email> --password <password>
- python manage.py health-check
- python manage.py runserver
"""

import os
import sys
import argparse
import uuid
from datetime import datetime, timezone

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import db
import migrate
import security
import backup

def cmd_db_upgrade(args):
    print("Executing database schema migrations...")
    count = migrate.upgrade()
    print(f"Done. Applied {count} migration(s).")

def cmd_db_status(args):
    migrate.status()

def cmd_db_backup(args):
    print("Creating verified database backup...")
    bfile = backup.create_backup()
    print(f"Backup successfully generated: {bfile}")

def cmd_db_restore(args):
    if not args.file:
        print("Error: --file argument is required for database restore.")
        sys.exit(1)
    print(f"Restoring database from backup {args.file}...")
    backup.restore_backup(args.file)
    print("Restore completed successfully.")

def cmd_create_admin(args):
    email = args.email.strip().lower()
    password = args.password
    if not email or not password:
        print("Error: --email and --password are required.")
        sys.exit(1)

    valid_pwd, msg = security.validate_password_strength(password)
    if not valid_pwd:
        print(f"Error: {msg}")
        sys.exit(1)

    pwd_hash = security.hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = db.query_one("SELECT id FROM users WHERE email = ?", (email,))
    if existing:
        db.execute("UPDATE users SET password_hash = ?, role = 'ADMIN', updated_at = ? WHERE id = ?", (pwd_hash, now_iso, existing['id']))
        print(f"✓ Updated existing user '{email}' to ADMIN role with new secure password.")
    else:
        user_id = f"usr_admin_{uuid.uuid4().hex[:8]}"
        db.execute("""
        INSERT INTO users (id, email, phone, password_hash, role, email_verified, phone_verified, account_status, created_at, updated_at)
        VALUES (?, ?, '+919900088776', ?, 'ADMIN', 1, 1, 'ACTIVE', ?, ?)
        """, (user_id, email, pwd_hash, now_iso, now_iso))
        print(f"✓ Created new Super Administrator account: {email}")

def cmd_health_check(args):
    print("Testing database connectivity and system health...")
    try:
        res = db.query_one("SELECT 1 as val")
        if res and res.get('val') == 1:
            print(f"✓ Database ({'PostgreSQL' if db.is_postgres() else 'SQLite'}) connection verified successfully.")
            sys.exit(0)
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        sys.exit(1)

def cmd_runserver(args):
    import server
    server.init_db()
    server.app.run(host=server.HOST, port=server.PORT, debug=server.DEBUG)

def main():
    parser = argparse.ArgumentParser(description="KaamSaathi Platform Operations CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # db
    p_db = subparsers.add_parser("db", help="Database operations and migrations")
    p_db.add_argument("subaction", choices=["upgrade", "status", "backup", "restore"], help="Database action")
    p_db.add_argument("--file", help="Backup file path for restore operation")

    # create-admin
    p_admin = subparsers.add_parser("create-admin", help="Provision administrator account")
    p_admin.add_argument("--email", required=True, help="Admin email address")
    p_admin.add_argument("--password", required=True, help="Admin password")

    # health-check
    subparsers.add_parser("health-check", help="Run platform connectivity health check")

    # runserver
    subparsers.add_parser("runserver", help="Start the web application server")

    args = parser.parse_args()

    if args.command == "db":
        if args.subaction == "upgrade":
            cmd_db_upgrade(args)
        elif args.subaction == "status":
            cmd_db_status(args)
        elif args.subaction == "backup":
            cmd_db_backup(args)
        elif args.subaction == "restore":
            cmd_db_restore(args)
    elif args.command == "create-admin":
        cmd_create_admin(args)
    elif args.command == "health-check":
        cmd_health_check(args)
    elif args.command == "runserver":
        cmd_runserver(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
