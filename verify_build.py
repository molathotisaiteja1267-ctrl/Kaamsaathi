#!/usr/bin/env python3
"""
KaamSaathi Production Build Verification Script (verify_build.py)
Validates all canonical frontend assets, backend modules, configurations, and deployment artifacts.
"""

import os
import sys
import py_compile

sys.stdout.reconfigure(encoding='utf-8')

def verify_production_build():
    print("=================================================================")
    print(" KAAMSAATHI PRODUCTION BUILD & ASSET VERIFICATION")
    print("=================================================================")

    # 1. Canonical Frontend Assets
    frontend_files = [
        'index.html', 'styles.css', 'app.js', 'api.js', 'nlp.js',
        'admin.html', 'admin.css', 'admin.js'
    ]
    print("\n[STEP 1] Validating Canonical Frontend Assets...")
    for f in frontend_files:
        assert os.path.exists(f), f"Missing required frontend asset: {f}"
        sz = os.path.getsize(f)
        assert sz > 0, f"File {f} is empty."
        print(f"  ✓ {f} ({sz:,} bytes) validated.")

    # 2. Verify HTML Script Inclusions & Zero Legacy Dependencies
    print("\n[STEP 2] Verifying HTML Script References...")
    with open('index.html', 'r', encoding='utf-8') as f:
        idx_html = f.read()
    assert 'api.js' in idx_html, "index.html must reference api.js"
    assert 'nlp.js' in idx_html, "index.html must reference nlp.js"
    assert 'app.js' in idx_html, "index.html must reference app.js"
    assert 'auth.js' not in idx_html, "index.html must NOT reference obsolete auth.js"
    assert 'db.js' not in idx_html, "index.html must NOT reference obsolete db.js"
    print("  ✓ index.html references verified (0 legacy references).")

    with open('admin.html', 'r', encoding='utf-8') as f:
        adm_html = f.read()
    assert 'api.js' in adm_html, "admin.html must reference api.js"
    assert 'admin.js' in adm_html, "admin.html must reference admin.js"
    print("  ✓ admin.html references verified.")

    # 3. Canonical Backend Python Modules Syntax Check
    backend_modules = [
        'server.py', 'db.py', 'security.py', 'backup.py',
        'manage.py', 'migrate.py'
    ]
    print("\n[STEP 3] Compiling Backend Python Modules...")
    for m in backend_modules:
        assert os.path.exists(m), f"Missing backend module: {m}"
        py_compile.compile(m, doraise=True)
        print(f"  ✓ {m} compiled cleanly (zero syntax errors).")

    # 4. DevOps & Deployment Artifacts
    devops_files = [
        'Procfile', 'requirements.txt', 'gunicorn.conf.py',
        'Dockerfile', 'docker-compose.yml', '.env.example', 'README.md',
        'PRODUCTION_DEPLOYMENT.md'
    ]
    print("\n[STEP 4] Checking DevOps & Deployment Toolchain...")
    for df in devops_files:
        assert os.path.exists(df), f"Missing deployment artifact: {df}"
        print(f"  ✓ {df} verified.")

    # 5. Database Schema Migrations
    migration_files = [
        'migrations/001_initial_schema.sql',
        'migrations/002_performance_indexes.sql'
    ]
    print("\n[STEP 5] Checking Database Migrations...")
    for mf in migration_files:
        assert os.path.exists(mf), f"Missing migration file: {mf}"
        print(f"  ✓ {mf} verified.")

    print("\n=================================================================")
    print(" ALL PRODUCTION BUILD VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == '__main__':
    verify_production_build()
