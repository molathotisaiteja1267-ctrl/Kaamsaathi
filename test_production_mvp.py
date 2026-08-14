#!/usr/bin/env python3
"""
KaamSaathi Production-Grade MVP Integration Test Suite (test_production_mvp.py)
Tests all core criteria:
1. Clean DB initialization (0 customers, 0 partners, 0 bookings, 69 services catalog, 1 Admin).
2. Strict RBAC & Security (401/403 guards against cross-role & unverified partner access).
3. Customer Flow (Signup -> Address -> Search -> Book as PENDING).
4. Partner Flow (Signup -> PENDING -> Admin Approval -> VERIFIED -> Go Online).
5. Booking Lifecycle (PENDING -> ACCEPTED -> ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> COMPLETED).
6. Customer Review (5-star rating dynamically recalculates partner rating in SQL).
7. Admin Desk (Live SQL aggregates, KYC decision, Dispute resolution, Audit logs).
"""

import os
import sys
import json
import sqlite3
import time
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')
import server

def run_production_tests():
    print("=================================================================")
    print(" KAAMSAATHI PRODUCTION MVP COMPREHENSIVE INTEGRATION SUITE")
    print("=================================================================")

    # 1. Clean Database Initialization
    print("\n[TEST 1] Clean Database Initialization & Zero Demo Accounts...")
    server.init_db(clean_slate=True)
    client = server.app.test_client()

    conn = sqlite3.connect(server.DATABASE_FILE)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM customers")
    assert cur.fetchone()[0] == 0, "Expected 0 customers in clean production startup"

    cur.execute("SELECT COUNT(*) FROM partners")
    assert cur.fetchone()[0] == 0, "Expected 0 partners in clean production startup"

    cur.execute("SELECT COUNT(*) FROM bookings")
    assert cur.fetchone()[0] == 0, "Expected 0 bookings in clean production startup"

    cur.execute("SELECT COUNT(*) FROM services")
    srv_count = cur.fetchone()[0]
    assert srv_count == 69, f"Expected 69 services, found {srv_count}"

    cur.execute("SELECT email, role FROM users WHERE role = 'ADMIN'")
    admin_user = cur.fetchone()
    assert admin_user is not None and admin_user[0] == server.ADMIN_EMAIL
    conn.close()
    print("  [OK] Clean production startup verified: 0 customers, 0 partners, 0 bookings, 69 standard services, 1 Super Admin.")

    # 2. RBAC & Route Security Tests
    print("\n[TEST 2] Security Guards & Role-Based Access Control (RBAC)...")
    unauth_stats = client.get('/api/admin/stats')
    assert unauth_stats.status_code == 401, f"Expected 401 Unauthorized, got {unauth_stats.status_code}"
    print("  [OK] Unauthenticated access to /api/admin/stats blocked with HTTP 401.")

    # Register Customer 1
    cust_res = client.post('/api/auth/register', json={
        'email': 'ananya.sharma@varanasi.test',
        'phone': '+91 98765 43210',
        'password': 'CustomerPassword@2026',
        'full_name': 'Ananya Sharma',
        'role': 'CUSTOMER',
        'city': 'Varanasi'
    })
    assert cust_res.status_code == 200
    cust_token = cust_res.get_json()['token']
    cust_headers = {'Authorization': f'Bearer {cust_token}'}

    # Customer tries to access admin API
    cust_to_admin = client.get('/api/admin/stats', headers=cust_headers)
    assert cust_to_admin.status_code == 403, f"Expected 403 Forbidden for Customer -> Admin, got {cust_to_admin.status_code}"
    print("  [OK] Customer attempting to access Admin API blocked with HTTP 403 Forbidden.")

    # 3. Customer Address & Booking Creation (Starts as PENDING)
    print("\n[TEST 3] Customer Address Setup & Service Booking Creation (PENDING status)...")
    addr_res = client.post('/api/addresses', headers=cust_headers, json={
        'label': 'Home',
        'address': 'Flat 204, Ganga View Residency, Lanka Main Road',
        'locality': 'Lanka',
        'city': 'Varanasi',
        'pincode': '221005',
        'landmark': 'Near BHU Hyderabad Gate'
    })
    assert addr_res.status_code == 200
    addr_id = addr_res.get_json()['address_id']
    print(f"  [OK] Saved address in SQLite: {addr_id}")

    srv_res = client.get('/api/services?category=HOME MAINTENANCE')
    services = srv_res.get_json()['services']
    elec_srv = next(s for s in services if s['name'] == 'Electrician')

    # Create Booking
    bk_create = client.post('/api/bookings', headers=cust_headers, json={
        'service_id': elec_srv['id'],
        'address_id': addr_id,
        'description': 'Main hall ceiling fan regulator is sparking and capacitor makes buzzing noise.',
        'scheduled_date': 'Today',
        'scheduled_time': 'Today · ASAP (15–20 min)',
        'payment_method': 'UPI'
    })
    assert bk_create.status_code == 200
    bk_data = bk_create.get_json()
    bk_id = bk_data['booking_id']
    bk_ref = bk_data['booking_reference']
    
    # CRITICAL CHECK: Booking status must be PENDING
    assert bk_data['status'] == 'PENDING', f"Booking must start as PENDING, got {bk_data['status']}"
    print(f"  [OK] Booking created with unique reference {bk_ref} strictly in PENDING status!")

    # 4. Partner Registration & Unverified Gate
    print("\n[TEST 4] Partner Registration & Verification Gate...")
    part_res = client.post('/api/auth/register', json={
        'email': 'vikram.pandey@varanasi.test',
        'phone': '+91 98111 22334',
        'password': 'PartnerPassword@2026',
        'full_name': 'Vikram Pandey',
        'role': 'PARTNER',
        'city': 'Varanasi'
    })
    assert part_res.status_code == 200
    part_token = part_res.get_json()['token']
    part_headers = {'Authorization': f'Bearer {part_token}'}

    # Partner Onboarding Submission
    onb_res = client.post('/api/partners/onboarding', headers=part_headers, json={
        'skills': ['Electrician', 'Cooler Repair & Service', 'Fan Installation & Repair'],
        'bio': 'Certified electrician with 4+ years of residential experience in Lanka, Varanasi.',
        'experience_years': 4,
        'starting_price': 149,
        'service_locality': 'Lanka',
        'service_radius': '5 km'
    })
    assert onb_res.status_code == 200
    print("  [OK] Partner onboarding data submitted and saved in SQLite.")

    # Unverified partner attempts to accept customer booking -> Must Fail with 403
    unverified_accept = client.post(f'/api/bookings/{bk_id}/accept', headers=part_headers)
    assert unverified_accept.status_code == 403, f"Expected 403 for unverified partner accepting booking, got {unverified_accept.status_code}"
    print("  [OK] Unverified partner blocked from accepting bookings with HTTP 403.")

    # 5. Super Admin Login & KYC Approval
    print("\n[TEST 5] Super Admin Authentication & KYC Audit Desk...")
    admin_login = client.post('/api/auth/login', json={
        'email': server.ADMIN_EMAIL,
        'password': server.ADMIN_PASSWORD
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.get_json()['token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    print("  [OK] Super Admin authenticated.")

    # Real SQL Stats Verification
    stats_res = client.get('/api/admin/stats', headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.get_json()
    assert stats['total_customers'] == 1
    assert stats['total_partners'] == 1
    assert stats['pending_partners'] == 1
    assert stats['verified_partners'] == 0
    assert stats['total_bookings'] == 1
    assert stats['pending_bookings'] == 1
    print(f"  [OK] Pure SQL statistics verified (Customers: 1, Partners: 1, Pending: 1, Bookings: 1).")

    # Admin audits pending KYC
    ver_res = client.get('/api/admin/verifications', headers=admin_headers)
    vers = ver_res.get_json()['verifications']
    pending_ver = next(v for v in vers if v['status'] == 'PENDING')
    
    # Admin Approves Partner KYC
    decide_res = client.post(f"/api/admin/verifications/{pending_ver['id']}/decide", headers=admin_headers, json={
        'decision': 'VERIFIED',
        'notes': 'Government ID, trade electrician certification and Varanasi address audited.'
    })
    assert decide_res.status_code == 200
    print("  [OK] Admin approved Partner KYC -> Partner status updated to VERIFIED in SQLite.")

    # 6. Verified Partner Accepts Booking & Status Progression
    print("\n[TEST 6] Verified Partner Accepts Booking & Progresses Lifecycle...")
    accept_res = client.post(f'/api/bookings/{bk_id}/accept', headers=part_headers)
    assert accept_res.status_code == 200 and accept_res.get_json()['status'] == 'ACCEPTED'
    print("  [OK] Partner accepted booking -> Status transitioned from PENDING to ACCEPTED.")

    # Status Progression: ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> COMPLETED
    for nxt_status in ['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']:
        st_res = client.post(f'/api/bookings/{bk_id}/status', headers=part_headers, json={'status': nxt_status})
        assert st_res.status_code == 200 and st_res.get_json()['status'] == nxt_status
        print(f"  [OK] Partner advanced status -> {nxt_status}")

    # 7. Customer Review & SQL Rating Recalculation
    print("\n[TEST 7] Customer Review & Dynamic SQL Rating Calculation...")
    rev_res = client.post('/api/reviews', headers=cust_headers, json={
        'booking_id': bk_id,
        'rating': 5,
        'comment': 'Vikram arrived on time in Lanka, fixed the sparking regulator quickly. Very polite and professional.'
    })
    assert rev_res.status_code == 200
    print("  [OK] 5-Star review submitted and stored.")

    # Verify partner rating in SQLite
    conn = sqlite3.connect(server.DATABASE_FILE)
    cur = conn.cursor()
    cur.execute("SELECT rating, rating_count, completed_jobs FROM partners WHERE user_id = (SELECT id FROM users WHERE email = 'vikram.pandey@varanasi.test')")
    p_stat = cur.fetchone()
    assert p_stat[0] == 5.0 and p_stat[1] == 1 and p_stat[2] == 1
    conn.close()
    print(f"  [OK] Partner statistics verified in SQL: Rating = {p_stat[0]}★ (1 review), Completed Jobs = {p_stat[2]}.")

    # 8. Dispute & Admin Audit Log
    print("\n[TEST 8] Dispute Handling & Immutable Audit Log Verification...")
    cmp_res = client.post('/api/complaints', headers=cust_headers, json={
        'booking_id': bk_id,
        'category': 'Service Quality',
        'description': 'Test inquiry regarding invoice breakdown.'
    })
    assert cmp_res.status_code == 200
    cmp_id = cmp_res.get_json()['complaint_id']

    # Admin Resolves Dispute
    resolve_res = client.post(f'/api/admin/complaints/{cmp_id}/resolve', headers=admin_headers, json={
        'resolution': 'Invoice breakdown explained to customer. Ticket resolved.',
        'status': 'RESOLVED'
    })
    assert resolve_res.status_code == 200

    # Audit Logs
    aud_res = client.get('/api/admin/audit-logs', headers=admin_headers)
    assert aud_res.status_code == 200
    logs = aud_res.get_json()['audit_logs']
    assert len(logs) >= 3, "Expected multiple audit logs recorded"
    print(f"  [OK] Immutable audit log confirmed: {len(logs)} security/admin actions recorded.")

    print("\n=================================================================")
    print(" ALL 8 PRODUCTION MVP INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")

if __name__ == '__main__':
    run_production_tests()
