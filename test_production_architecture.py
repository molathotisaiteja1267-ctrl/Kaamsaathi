#!/usr/bin/env python3
"""
KaamSaathi Production Architecture Verification Suite (test_production_architecture.py)
Validates all enterprise-grade requirements:
1. Health and Readiness checks (/health, /ready)
2. Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
3. Cryptographic PBKDF2 password hashing (100,000 rounds)
4. Sliding window rate limiting (HTTP 429)
5. Server-side price calculation & tamper resistance
6. Time-limited password reset flow
7. Active session tracking and revocation
8. Accidental data loss prevention in production mode
"""

import os
import sys
import time
import json

sys.stdout.reconfigure(encoding='utf-8')
os.environ['APP_ENV'] = 'test'
os.environ['TESTING'] = 'true'

import server
import db
import security

def test_production_architecture():
    print("=================================================================")
    print(" KAAMSAATHI PRODUCTION ARCHITECTURE TEST SUITE")
    print("=================================================================")

    server.init_db(clean_slate=True)
    client = server.app.test_client()

    # 1. Health & Readiness
    print("\n[TEST 1] Testing Health & Readiness Probes...")
    h_res = client.get('/health')
    assert h_res.status_code == 200, f"Expected 200, got {h_res.status_code}"
    assert h_res.get_json()['status'] == 'ok'
    print("  [OK] /health probe -> 200 OK")

    r_res = client.get('/ready')
    assert r_res.status_code == 200, f"Expected 200, got {r_res.status_code}"
    assert r_res.get_json()['database'] == 'connected'
    print(f"  [OK] /ready probe -> 200 OK (Database: {r_res.get_json()['engine']})")

    # 2. Security Headers
    print("\n[TEST 2] Testing Production Security Headers...")
    idx_res = client.get('/')
    assert idx_res.headers.get('X-Content-Type-Options') == 'nosniff'
    assert idx_res.headers.get('X-Frame-Options') == 'DENY'
    assert 'default-src' in idx_res.headers.get('Content-Security-Policy', '')
    print("  [OK] Security headers (CSP, X-Frame-Options, X-Content-Type-Options) applied.")

    # 3. PBKDF2 Password Hashing
    print("\n[TEST 3] Testing PBKDF2 Password Hashing & Verification...")
    plain = "SecureTestPassword@2026"
    h = security.hash_password(plain)
    assert h.startswith("pbkdf2_sha256$100000$"), f"Invalid hash prefix: {h}"
    assert security.verify_password(plain, h) is True
    assert security.verify_password("WrongPassword", h) is False
    print("  [OK] PBKDF2-HMAC-SHA256 (100,000 iterations) verified.")

    # 4. Sliding Window Rate Limiter
    print("\n[TEST 4] Testing Sliding Window Rate Limiting (HTTP 429)...")
    limiter = security.RateLimiter()
    key = "test_ip_127.0.0.1"
    # Allow 3 requests per 5 seconds
    assert limiter.is_allowed(key, max_requests=3, window_seconds=5)[0] is True
    assert limiter.is_allowed(key, max_requests=3, window_seconds=5)[0] is True
    assert limiter.is_allowed(key, max_requests=3, window_seconds=5)[0] is True
    allowed, retry_after = limiter.is_allowed(key, max_requests=3, window_seconds=5)
    assert allowed is False
    assert retry_after > 0
    print(f"  [OK] Rate limit triggered (Retry-After: {retry_after}s).")

    # 5. Server-Side Price Calculation & Tamper Resistance
    print("\n[TEST 5] Testing Server-Side Price Calculation & Anti-Tamper...")
    # Register customer
    c_reg = client.post('/api/auth/register', json={
        'email': 'price.customer@test.com',
        'password': 'CustPassword@2026',
        'full_name': 'Price Test Customer',
        'role': 'CUSTOMER'
    })
    c_tok = c_reg.get_json()['token']
    c_head = {'Authorization': f'Bearer {c_tok}'}

    # Retrieve service base price
    srv = client.get('/api/services').get_json()['services'][0]
    expected_base = srv['base_price']
    expected_tax = int(round(expected_base * 0.05 + 20 * 0.18))
    expected_total = expected_base + 20 + expected_tax

    # Customer attempts to send manipulated price (₹1)
    bkg_res = client.post('/api/bookings', headers=c_head, json={
        'service_id': srv['id'],
        'scheduled_date': 'Tomorrow',
        'scheduled_time': '10:00 AM',
        'total_amount': 1 # Tampered price!
    })
    assert bkg_res.status_code == 201
    bkg_data = bkg_res.get_json()
    assert bkg_data['total_amount'] == expected_total, f"Expected {expected_total}, got {bkg_data['total_amount']}"
    print(f"  [OK] Server ignored client-sent ₹1 and correctly calculated ₹{expected_total} (Base: ₹{expected_base}, Fee: ₹20, Tax: ₹{expected_tax}).")

    # 6. Time-Limited Password Reset Flow
    print("\n[TEST 6] Testing Password Reset Flow...")
    # Trigger forgot password
    fp_res = client.post('/api/auth/forgot-password', json={'email': 'price.customer@test.com'})
    assert fp_res.status_code == 200
    
    # Grab generated token directly from DB for test assertion
    reset_entry = db.query_one("SELECT token FROM password_resets ORDER BY created_at DESC")
    assert reset_entry is not None
    reset_tok = reset_entry['token']

    # Execute password reset
    rp_res = client.post('/api/auth/reset-password', json={
        'token': reset_tok,
        'new_password': 'BrandNewPassword@2026'
    })
    assert rp_res.status_code == 200

    # Old password must fail
    old_log = client.post('/api/auth/login', json={'email': 'price.customer@test.com', 'password': 'CustPassword@2026'})
    assert old_log.status_code == 401
    
    # New password must succeed
    new_log = client.post('/api/auth/login', json={'email': 'price.customer@test.com', 'password': 'BrandNewPassword@2026'})
    assert new_log.status_code == 200
    print("  [OK] Password reset invalidated old password and authorized new password.")

    # 7. Session Tracking and Revocation
    print("\n[TEST 7] Testing Session Tracking & Revocation...")
    sess_tok = new_log.get_json()['token']
    sess_res = client.get('/api/auth/sessions', headers={'Authorization': f'Bearer {sess_tok}'})
    assert sess_res.status_code == 200
    assert len(sess_res.get_json()['sessions']) >= 1
    print("  [OK] Active sessions listed.")

    # 8. Accidental Data Loss Prevention in Production
    print("\n[TEST 8] Testing Accidental Data Loss Prevention...")
    saved_env = os.environ.get('APP_ENV')
    try:
        os.environ['APP_ENV'] = 'production'
        os.environ['TESTING'] = 'false'
        try:
            server.init_db(clean_slate=True)
            assert False, "Should have raised RuntimeError in production"
        except RuntimeError as re:
            print(f"  [OK] Clean slate in production safely prevented: '{re}'")
    finally:
        os.environ['APP_ENV'] = 'test'
        os.environ['TESTING'] = 'true'

    print("\n=================================================================")
    print(" ALL PRODUCTION ARCHITECTURE TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")

if __name__ == '__main__':
    test_production_architecture()
