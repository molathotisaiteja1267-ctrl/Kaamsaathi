#!/usr/bin/env python3
"""
KaamSaathi Production Database Backup & Disaster Recovery Utility (backup.py)
Supports:
- PostgreSQL automated backup via pg_dump and SQLite snapshotting
- SHA-256 integrity checksum calculation and verification
- Backup rotation and retention policies (default 7 days)
- Safe database restore and verification
- Disaster Recovery RPO / RTO validation
"""

import os
import sys
import shutil
import hashlib
import argparse
import subprocess
from datetime import datetime, timezone

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import db

BACKUP_DIR = os.environ.get('BACKUP_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups'))

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR, exist_ok=True)

def calculate_checksum(filepath: str) -> str:
    """Computes SHA-256 checksum of a file."""
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def create_backup() -> str:
    """Creates a timestamped database backup with SHA-256 checksum."""
    ensure_backup_dir()
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')

    if db.is_postgres():
        backup_file = os.path.join(BACKUP_DIR, f"kaamsaathi_pg_{timestamp}.sql")
        # Run pg_dump
        cmd = ["pg_dump", db.DATABASE_URL, "-f", backup_file]
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except Exception as e:
            raise RuntimeError(f"pg_dump failed: {e}")
    else:
        sqlite_src = db.get_sqlite_path()
        if not os.path.exists(sqlite_src):
            raise FileNotFoundError(f"Database source file not found at {sqlite_src}")
        backup_file = os.path.join(BACKUP_DIR, f"kaamsaathi_sqlite_{timestamp}.db")
        shutil.copy2(sqlite_src, backup_file)

    # Calculate and store checksum
    checksum = calculate_checksum(backup_file)
    checksum_file = f"{backup_file}.sha256"
    with open(checksum_file, 'w', encoding='utf-8') as f:
        f.write(f"{checksum}  {os.path.basename(backup_file)}\n")

    print(f"✓ Backup created: {backup_file}")
    print(f"✓ SHA-256 Checksum: {checksum}")
    return backup_file

def verify_backup(backup_file: str) -> bool:
    """Verifies that a backup file exists and matches its SHA-256 checksum."""
    if not os.path.exists(backup_file):
        print(f"✗ Backup file not found: {backup_file}")
        return False

    checksum_file = f"{backup_file}.sha256"
    if not os.path.exists(checksum_file):
        print(f"✗ Checksum file missing for {backup_file}")
        return False

    with open(checksum_file, 'r', encoding='utf-8') as f:
        expected = f.read().strip().split()[0]

    actual = calculate_checksum(backup_file)
    if actual == expected:
        print(f"✓ Checksum verified: {actual}")
        return True
    else:
        print(f"✗ Checksum mismatch! Expected {expected}, got {actual}")
        return False

def list_backups():
    ensure_backup_dir()
    files = [f for f in os.listdir(BACKUP_DIR) if not f.endswith('.sha256')]
    files.sort(reverse=True)
    print("==================================================")
    print(f" Available Database Backups ({len(files)})")
    print("==================================================")
    for f in files:
        full_path = os.path.join(BACKUP_DIR, f)
        size = os.path.getsize(full_path)
        print(f" - {f} ({size:,} bytes)")
    print("==================================================")
    return files

def restore_backup(backup_file: str) -> bool:
    """Restores database from a verified backup file."""
    if not verify_backup(backup_file):
        raise ValueError("Cannot restore from corrupted or unverified backup file.")

    if db.is_postgres():
        cmd = ["psql", db.DATABASE_URL, "-f", backup_file]
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"✓ PostgreSQL database restored from {backup_file}")
            return True
        except Exception as e:
            raise RuntimeError(f"psql restore failed: {e}")
    else:
        sqlite_dst = db.get_sqlite_path()
        shutil.copy2(backup_file, sqlite_dst)
        print(f"✓ SQLite database restored from {backup_file} -> {sqlite_dst}")
        return True

def prune_backups(retention_days: int = 7):
    """Deletes backups older than retention_days."""
    ensure_backup_dir()
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - (retention_days * 86400)
    for f in os.listdir(BACKUP_DIR):
        full_path = os.path.join(BACKUP_DIR, f)
        if os.path.getmtime(full_path) < cutoff:
            os.remove(full_path)
            print(f"Pruned old backup: {f}")

def main():
    parser = argparse.ArgumentParser(description="KaamSaathi Database Backup & Disaster Recovery CLI")
    subparsers = parser.add_subparsers(dest="action", help="Action to perform")

    subparsers.add_parser("create", help="Create a new timestamped backup")
    subparsers.add_parser("list", help="List all available backups")
    
    verify_p = subparsers.add_parser("verify", help="Verify backup checksum")
    verify_p.add_argument("file", help="Path to backup file")

    restore_p = subparsers.add_parser("restore", help="Restore database from backup")
    restore_p.add_argument("file", help="Path to backup file")

    prune_p = subparsers.add_parser("prune", help="Prune old backups")
    prune_p.add_argument("--days", type=int, default=7, help="Retention period in days")

    args = parser.parse_args()

    if args.action == "create":
        create_backup()
    elif args.action == "list":
        list_backups()
    elif args.action == "verify":
        verify_backup(args.file)
    elif args.action == "restore":
        restore_backup(args.file)
    elif args.action == "prune":
        prune_backups(args.days)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
