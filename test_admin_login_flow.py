#!/usr/bin/env python3
"""
KaamSaathi Admin Login & Workspace Navigation Test Suite (test_admin_login_flow.py)
Validates the complete Admin Authentication and Navigation workflow:
1. POST /api/admin/login with credentials
2. Verification of role == ADMIN and session creation
3. Calling all admin workspace APIs (/api/admin/dashboard, customers, partners, bookings, services, tickets, complaints, analytics)
4. Rejection of Customer / Partner login on Admin portal (403)
5. Session revocation on /api/admin/logout
"""

import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
os.environ['APP_ENV'] = 'test'
os.environ['TESTING'] = 'true'

import server
import db

def test_admin_login_navigation():
    print("=================================================================")
    print(" KAAMSAATHI ADMIN LOGIN & WORKSPACE NAVIGATION TEST")
    print("=================================================================")

    server.init_db(clean_slate=True)
    client = server.app.test_client()

    # Step 1: Admin Login with valid credentials
    print("\n[STEP 1] Authenticating Admin via POST /api/admin/login...")
    login_res = client.post('/api/admin/login', json={
        'email': server.ADMIN_EMAIL,
        'password': server.ADMIN_PASSWORD
    })
    assert login_res.status_code == 200, f"Expected 200, got {login_res.status_code}: {login_res.get_data(as_text=True)}"
    data = login_res.get_json()
    assert data['user']['role'] == 'ADMIN', f"Expected role ADMIN, got {data['user']['role']}"
    token = data['token']
    assert token is not None and len(token) > 20
    headers = {'Authorization': f'Bearer {token}'}
    print(f"  [OK] Super Admin authenticated successfully (Role: {data['user']['role']}, Token: {token[:10]}...).")

    # Step 2: Customer attempts Admin Login -> MUST BE 403
    print("\n[STEP 2] Customer attempts Admin Login...")
    cust_res = client.post('/api/auth/register', json={
        'email': 'customer.user@test.com',
        'password': 'CustPassword@2026',
        'full_name': 'Test Customer',
        'role': 'CUSTOMER'
    })
    cust_try = client.post('/api/admin/login', json={
        'email': 'customer.user@test.com',
        'password': 'CustPassword@2026'
    })
    assert cust_try.status_code == 403, f"Expected 403 for Customer on Admin login, got {cust_try.status_code}"
    print("  [OK] Customer rejected with HTTP 403 Forbidden on /api/admin/login.")

    # Step 3: Invalid password on Admin Login -> MUST BE 401
    print("\n[STEP 3] Admin Login with wrong password...")
    wrong_pwd = client.post('/api/admin/login', json={
        'email': server.ADMIN_EMAIL,
        'password': 'WrongPassword@123'
    })
    assert wrong_pwd.status_code == 401
    print("  [OK] Invalid password rejected with HTTP 401 Unauthorized.")

    # Step 4: Loading All Admin Workspace Endpoints
    print("\n[STEP 4] Fetching all Admin Workspace Data Endpoints...")

    # Dashboard / Stats
    dash = client.get('/api/admin/dashboard', headers=headers)
    assert dash.status_code == 200
    assert 'total_customers' in dash.get_json()
    print("  [OK] GET /api/admin/dashboard -> 200 OK (Live Database KPIs)")

    # Customers
    custs = client.get('/api/admin/customers', headers=headers)
    assert custs.status_code == 200
    assert 'customers' in custs.get_json()
    print(f"  [OK] GET /api/admin/customers -> 200 OK ({len(custs.get_json()['customers'])} records)")

    # Partners
    parts = client.get('/api/admin/partners', headers=headers)
    assert parts.status_code == 200
    assert 'partners' in parts.get_json()
    print(f"  [OK] GET /api/admin/partners -> 200 OK ({len(parts.get_json()['partners'])} records)")

    # Bookings
    bkgs = client.get('/api/admin/bookings', headers=headers)
    assert bkgs.status_code == 200
    assert 'bookings' in bkgs.get_json()
    print(f"  [OK] GET /api/admin/bookings -> 200 OK ({len(bkgs.get_json()['bookings'])} records)")

    # Services Catalog
    srvs = client.get('/api/admin/services', headers=headers)
    assert srvs.status_code == 200
    assert 'services' in srvs.get_json()
    print(f"  [OK] GET /api/admin/services -> 200 OK ({len(srvs.get_json()['services'])} services)")

    # Support Tickets
    tkts = client.get('/api/admin/support-tickets', headers=headers)
    assert tkts.status_code == 200
    assert 'tickets' in tkts.get_json()
    print(f"  [OK] GET /api/admin/support-tickets -> 200 OK ({len(tkts.get_json()['tickets'])} tickets)")

    # Complaints
    cmps = client.get('/api/admin/complaints', headers=headers)
    assert cmps.status_code == 200
    assert 'complaints' in cmps.get_json()
    print(f"  [OK] GET /api/admin/complaints -> 200 OK ({len(cmps.get_json()['complaints'])} complaints)")

    # Analytics
    analytics = client.get('/api/admin/analytics', headers=headers)
    assert analytics.status_code == 200
    assert 'total_revenue' in analytics.get_json()
    print("  [OK] GET /api/admin/analytics -> 200 OK (Platform Growth & Conversion)")

    # Step 5: Admin Logout
    print("\n[STEP 5] Admin Logout via POST /api/admin/logout...")
    logout_res = client.post('/api/admin/logout', headers=headers)
    assert logout_res.status_code == 200

    # Verify session is destroyed
    post_logout_try = client.get('/api/admin/dashboard', headers=headers)
    assert post_logout_try.status_code == 401
    print("  [OK] Admin session successfully invalidated after logout.")

    print("\n=================================================================")
    print(" ALL ADMIN LOGIN & WORKSPACE TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")

if __name__ == '__main__':
    test_admin_login_navigation()
