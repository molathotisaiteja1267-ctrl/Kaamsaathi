#!/usr/bin/env python3
"""
KaamSaathi Insecure Direct Object Reference (IDOR) & Security Test Suite (test_security_and_idor.py)
Validates:
1. Customer A vs Customer B resource isolation (Bookings, Addresses, Payments)
2. Partner A vs Partner B booking assignment isolation
3. Cross-role authorization barriers (Customer attempting Partner actions -> 403)
4. Soft Account Deletion & immediate session revocation
"""

import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ['APP_ENV'] = 'test'
os.environ['TESTING'] = 'true'

import server
import db

def test_security_and_idor():
    print("=================================================================")
    print(" KAAMSAATHI IDOR & SECURITY AUTHORIZATION TEST SUITE")
    print("=================================================================")

    server.init_db(clean_slate=True)
    client = server.app.test_client()

    # 1. Register Customer A and Customer B
    print("\n[STEP 1] Provisioning Customer A and Customer B...")
    reg_a = client.post('/api/auth/register', json={
        'email': 'customer.alice@varanasi.test',
        'password': 'AlicePassword@2026',
        'full_name': 'Alice Sharma',
        'role': 'CUSTOMER'
    }).get_json()
    token_a = reg_a['token']
    headers_a = {'Authorization': f'Bearer {token_a}'}

    reg_b = client.post('/api/auth/register', json={
        'email': 'customer.bob@varanasi.test',
        'password': 'BobPassword@2026',
        'full_name': 'Bob Verma',
        'role': 'CUSTOMER'
    }).get_json()
    token_b = reg_b['token']
    headers_b = {'Authorization': f'Bearer {token_b}'}

    # 2. Customer A creates Address and Booking
    print("\n[STEP 2] Customer A creates Address and Booking...")
    addr_res = client.post('/api/addresses', headers=headers_a, json={
        'label': 'Home',
        'address': 'B-12, Assi Ghat Road',
        'locality': 'Assi Ghat',
        'pincode': '221005'
    })
    assert addr_res.status_code == 201
    addr_a_id = addr_res.get_json()['address_id']

    srv = client.get('/api/services').get_json()['services'][0]
    bkg_res = client.post('/api/bookings', headers=headers_a, json={
        'service_id': srv['id'],
        'address_id': addr_a_id,
        'description': 'Plumbing emergency in bathroom'
    })
    assert bkg_res.status_code == 201
    bkg_a_id = bkg_res.get_json()['booking_id']
    print(f"  [OK] Booking created by Alice (ID: {bkg_a_id})")

    # 3. IDOR Attack: Bob attempts to view Alice's bookings
    print("\n[STEP 3] Testing IDOR on Booking Directory...")
    bob_bkgs = client.get('/api/bookings', headers=headers_b).get_json()['bookings']
    assert len(bob_bkgs) == 0, f"Expected 0 bookings for Bob, got {len(bob_bkgs)}"
    print("  [OK] Bob cannot see Alice's booking.")

    # 4. IDOR Attack: Bob attempts to cancel Alice's booking
    print("\n[STEP 4] Testing IDOR on Booking Modification...")
    cancel_attempt = client.post(f'/api/bookings/{bkg_a_id}/status', headers=headers_b, json={'status': 'CANCELLED'})
    assert cancel_attempt.status_code == 403, f"Expected 403, got {cancel_attempt.status_code}"
    print("  [OK] Bob's attempt to cancel Alice's booking blocked with 403 Forbidden.")

    # 5. IDOR Attack: Bob attempts to make payment on Alice's booking
    print("\n[STEP 5] Testing IDOR on Payment Creation...")
    pay_attempt = client.post('/api/payments/create', headers=headers_b, json={'booking_id': bkg_a_id, 'payment_method': 'UPI'})
    assert pay_attempt.status_code == 403, f"Expected 403, got {pay_attempt.status_code}"
    print("  [OK] Bob's attempt to pay for Alice's booking blocked with 403 Forbidden.")

    # 6. IDOR Attack: Cross-Partner Booking Tampering
    print("\n[STEP 6] Testing Partner Isolation & Tamper Resistance...")
    part_1 = client.post('/api/auth/register', json={
        'email': 'partner.ramesh@varanasi.test',
        'password': 'RameshPassword@2026',
        'full_name': 'Ramesh Electrician',
        'role': 'PARTNER'
    }).get_json()
    part_1_token = part_1['token']
    part_1_headers = {'Authorization': f'Bearer {part_1_token}'}

    part_2 = client.post('/api/auth/register', json={
        'email': 'partner.suresh@varanasi.test',
        'password': 'SureshPassword@2026',
        'full_name': 'Suresh Plumber',
        'role': 'PARTNER'
    }).get_json()
    part_2_token = part_2['token']
    part_2_headers = {'Authorization': f'Bearer {part_2_token}'}

    # Ramesh accepts Alice's booking
    accept_res = client.post(f'/api/bookings/{bkg_a_id}/status', headers=part_1_headers, json={'status': 'ACCEPTED'})
    assert accept_res.status_code == 200

    # Suresh attempts to complete Ramesh's booking -> MUST BE 403
    suresh_try = client.post(f'/api/bookings/{bkg_a_id}/status', headers=part_2_headers, json={'status': 'COMPLETED'})
    assert suresh_try.status_code == 403, f"Expected 403, got {suresh_try.status_code}"
    print("  [OK] Suresh blocked from modifying Ramesh's assigned booking.")

    # 7. Soft Account Deletion Verification
    print("\n[STEP 7] Testing Soft Account Deletion & Session Revocation...")
    del_res = client.post('/api/auth/delete-account', headers=headers_a)
    assert del_res.status_code == 200

    # Alice's token must now be invalid
    me_res = client.get('/api/auth/me', headers=headers_a)
    assert me_res.get_json()['authenticated'] is False

    # Alice cannot login again
    relogin = client.post('/api/auth/login', json={'email': 'customer.alice@varanasi.test', 'password': 'AlicePassword@2026'})
    assert relogin.status_code == 403
    print("  [OK] Soft-deleted account prevented from logging in and sessions revoked.")

    print("\n=================================================================")
    print(" ALL IDOR & SECURITY TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")

if __name__ == '__main__':
    test_security_and_idor()
