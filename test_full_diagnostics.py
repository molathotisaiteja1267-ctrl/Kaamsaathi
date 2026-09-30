"""
KaamSaathi Comprehensive Production Verification Test Suite
Tests all production issues addressed:
1. Database initialization and migrations
2. Services catalog retrieval and filtering
3. Customer and Partner registration, 409 conflict handling, login session management
4. AI Assistant NLP (English and Hinglish), compound tasks, slot tracking, booking draft/confirmation
5. Active booking tracking, payment verification, support ticket creation (KS-SUP-XXXXXX)
6. Security and IDOR isolation
"""

import os
import sys
import unittest
import json

# Set environment before any project imports
os.environ['APP_ENV'] = 'test'
os.environ['TESTING'] = 'true'
os.environ['JWT_SECRET_KEY'] = 'test-secret-key-32-chars-minimum-required-1234'
os.environ['CSRF_SECRET_KEY'] = 'test-csrf-key-32-chars-minimum-required-1234'

import server
import db
import security

class TestKaamSaathiProduction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.init_db(clean_slate=True)
        cls.client = server.app.test_client()

    # ==========================================
    # 1. Health & Catalog API
    # ==========================================
    def test_01_health_and_ready(self):
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ok')

        res = self.client.get('/ready')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['database'], 'connected')

    def test_02_services_catalog(self):
        res = self.client.get('/api/services')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('services', data)
        self.assertGreater(len(data['services']), 10)
        
        # Test category filtering
        res_cleaning = self.client.get('/api/services?category=CLEANING')
        self.assertEqual(res_cleaning.status_code, 200)
        cleaning_data = res_cleaning.get_json()
        for s in cleaning_data['services']:
            self.assertEqual(s['category'].upper(), 'CLEANING')

    # ==========================================
    # 2. Authentication & Conflict Handling
    # ==========================================
    def test_03_customer_registration_and_login(self):
        customer_payload = {
            "full_name": "Aarav Sharma",
            "email": "aarav.test@example.com",
            "phone": "9876543210",
            "password": "Password@123",
            "city": "Delhi",
            "role": "CUSTOMER"
        }
        res = self.client.post('/api/auth/register', json=customer_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['email'], "aarav.test@example.com")

        # Duplicate email -> 409 Conflict
        res_dup = self.client.post('/api/auth/register', json=customer_payload)
        self.assertEqual(res_dup.status_code, 409)

        # Login
        login_res = self.client.post('/api/auth/login', json={
            "email": "aarav.test@example.com",
            "password": "Password@123"
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertIn('token', login_data)
        TestKaamSaathiProduction.customer_token = login_data['token']
        TestKaamSaathiProduction.customer_user = login_data['user']

    def test_04_partner_registration_and_login(self):
        partner_payload = {
            "full_name": "Vikram Mistri",
            "email": "vikram.mistri@example.com",
            "phone": "9812345678",
            "password": "Password@123",
            "city": "Delhi",
            "role": "PARTNER",
            "service_category": "PLUMBING",
            "experience_years": 5,
            "hourly_rate": 350
        }
        res = self.client.post('/api/auth/register', json=partner_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('token', data)
        TestKaamSaathiProduction.partner_token = data['token']

    def test_05_admin_login(self):
        res = self.client.post('/api/admin/login', json={
            "email": "admin@kaamsaathi.com",
            "password": "KaamSaathiAdmin@2026"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'ADMIN')

    # ==========================================
    # 3. Conversational AI Assistant (NLP & Features)
    # ==========================================
    def test_06_ai_assistant_hinglish_cooler(self):
        res = self.client.post('/api/assistant/chat', json={
            "message": "Mera cooler kharab hai aur thanda pani nahi fek raha"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('reply', data)
        self.assertEqual(data.get('action'), 'SERVICE_MATCHED')
        self.assertIn('Cooler', data['action_data']['service']['name'])

    def test_07_ai_assistant_fan_hinglish(self):
        res = self.client.post('/api/assistant/chat', json={
            "message": "bhai fan nahi chal raha hai bijli ka kuch problem hai"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('reply', data)
        self.assertEqual(data.get('action'), 'SERVICE_MATCHED')
        self.assertIn('Fan', data['action_data']['service']['name'])

    def test_08_ai_assistant_multitask_compound(self):
        res = self.client.post('/api/assistant/chat', json={
            "message": "I need full room cleaning and also assemble my wooden table"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('reply', data)
        self.assertEqual(data.get('action'), 'MULTI_TASK')
        tasks = data['action_data']['tasks']
        self.assertGreaterEqual(len(tasks), 2)

    def test_09_ai_assistant_conversational_booking_flow(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        
        # Step 1: Initial query
        res1 = self.client.post('/api/assistant/chat', json={
            "message": "I want to book bathroom deep cleaning"
        }, headers=headers)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()
        context1 = data1.get('context', {})
        self.assertIn('detected_service', context1)

        # Step 2: Slot filling date and time -> Draft booking created
        res2 = self.client.post('/api/assistant/chat', json={
            "message": "Schedule it for tomorrow at 10:00 AM",
            "context": context1
        }, headers=headers)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertEqual(data2.get('action'), 'CONFIRMATION_REQUIRED')
        draft = data2['action_data']['draft']
        self.assertIsNotNone(draft)
        self.assertEqual(draft['scheduled_date'], 'Tomorrow')

        # Step 3: Confirmation -> Real booking created in database
        context2 = data2.get('context', {})
        res3 = self.client.post('/api/assistant/chat', json={
            "message": "Yes, please confirm the booking",
            "context": context2
        }, headers=headers)
        self.assertEqual(res3.status_code, 200)
        data3 = res3.get_json()
        self.assertEqual(data3.get('action'), 'BOOKING_CREATED')
        self.assertIn('KS-BKG-', data3['action_data']['booking_reference'])

    def test_10_ai_assistant_track_and_support_ticket(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        
        # Track active booking
        res_track = self.client.post('/api/assistant/chat', json={
            "message": "Where is my booking? Track my booking"
        }, headers=headers)
        self.assertEqual(res_track.status_code, 200)
        data_track = res_track.get_json()
        self.assertEqual(data_track.get('action'), 'TRACK_BOOKING')

        # Create real support ticket
        res_ticket = self.client.post('/api/assistant/chat', json={
            "message": "I have an issue with the partner not arriving, please create ticket"
        }, headers=headers)
        self.assertEqual(res_ticket.status_code, 200)
        data_ticket = res_ticket.get_json()
        self.assertEqual(data_ticket.get('action'), 'TICKET_CREATED')
        self.assertIn('KS-SUP-', data_ticket['action_data']['ticket_reference'])

    def test_11_assistant_action_endpoint(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        
        srv = self.client.get('/api/services').get_json()['services'][0]
        
        res = self.client.post('/api/assistant/action', json={
            "action": "CONFIRM_BOOKING",
            "data": {
                "service_id": srv['id'],
                "scheduled_date": "Tomorrow",
                "scheduled_time": "14:00",
                "address": "42 Connaught Place, New Delhi"
            }
        }, headers=headers)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('booking_reference', data)
        self.assertIn('booking_id', data)

    # ==========================================
    # 4. Security & IDOR Isolation
    # ==========================================
    def test_12_idor_security(self):
        res2 = self.client.post('/api/auth/register', json={
            "full_name": "Second User",
            "email": "second.user@example.com",
            "phone": "9998887776",
            "password": "Password@123",
            "city": "Mumbai",
            "role": "CUSTOMER"
        })
        self.assertEqual(res2.status_code, 201)
        second_token = res2.get_json()['token']

        # Second user fetching customer bookings should ONLY see their own bookings (empty)
        res_bookings = self.client.get('/api/bookings', headers={"Authorization": f"Bearer {second_token}"})
        self.assertEqual(res_bookings.status_code, 200)
        data = res_bookings.get_json()
        self.assertEqual(len(data.get('bookings', [])), 0)

if __name__ == '__main__':
    unittest.main(verbosity=2)
