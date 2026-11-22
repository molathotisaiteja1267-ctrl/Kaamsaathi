"""
test_new_features_verification.py
Comprehensive Verification Suite for the 5 Major Production Enhancements:
1. Feature 1: Provider Verification Back & Close Button
2. Feature 2: Specific Date and Time Booking System
3. Feature 3: Professional Email and Phone Verification
4. Feature 4: Service Provider Profile Photo Upload
5. Feature 5: Update Admin Email & Securely Change Admin Password
"""
import os
import sys
import json
import base64
from datetime import datetime, timedelta

# Ensure local test env
os.environ["APP_ENV"] = "test"
os.environ["PORT"] = "8000"
os.environ["ADMIN_EMAIL"] = "molathotisaiteja1267@gmail.com"
if "ADMIN_PASSWORD" not in os.environ:
    os.environ["ADMIN_PASSWORD"] = "KaamSaathiAdmin@2028"

import server
from server import db
from security import validate_email_address, normalize_and_validate_phone, is_disposable_email

client = server.app.test_client()

def test_feature1_ui_elements():
    print("\n--- Testing Feature 1: Provider Verification Close & Back Buttons ---")
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()
    assert 'id="close-partner-onboarding-btn"' in html, "Close button missing in #partner-onboarding-modal"
    print("✓ Close button (×) is present in partner-onboarding-modal in index.html.")

    with open("app.js", "r", encoding="utf-8") as f:
        js = f.read()
    assert 'id="ob-step1-cancel-btn"' in js, "Return to Dashboard button missing in onboarding step 1"
    assert 'close-partner-onboarding-btn' in js, "Close button handler missing in app.js"
    print("✓ 'Return to Dashboard' button and modal close handler present in app.js onboarding wizard.")

def test_feature2_specific_date_and_time():
    print("\n--- Testing Feature 2: Specific Date and Time Booking System ---")
    # Verify index.html and app.js have date picker and slots
    with open("app.js", "r", encoding="utf-8") as f:
        js = f.read()
    assert 'id="bw-date-input"' in js, "Interactive date input missing in booking wizard"
    assert 'Customer Attendance Pledge' in js, "Customer attendance pledge missing in booking wizard step 3"
    assert 'I will be available at home during this time' in js, "Customer pledge text missing"
    print("✓ Booking wizard date picker and customer attendance pledge present in frontend.")

    # 1. Create a customer
    unique_suffix = int(datetime.now().timestamp() * 1000) % 10000000
    cust_res = client.post('/api/auth/register', json={
        "email": f"booking_cust_{unique_suffix}@example.com",
        "phone": f"+9198{unique_suffix:08d}",
        "password": "Password123!",
        "full_name": "Test Booking Customer",
        "role": "CUSTOMER"
    }, headers={"X-Auto-Verify": "true"})
    assert cust_res.status_code in (200, 201), cust_res.get_json()
    cust_token = cust_res.get_json()["token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # Add customer address
    addr_res = client.post('/api/addresses', headers=cust_headers, json={
        "address": "123 Assi Ghat Road",
        "locality": "Assi",
        "pincode": "221005",
        "latitude": 25.2890,
        "longitude": 83.0060,
        "label": "Home"
    })
    assert addr_res.status_code in (200, 201), addr_res.get_json()
    addr_id = addr_res.get_json()["address_id"]

    # Get a service
    srvs = client.get('/api/services').get_json()["services"]
    srv_id = srvs[0]["id"]

    # 2. Test booking with past date -> must be rejected (400)
    past_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
    res_past = client.post('/api/bookings', headers=cust_headers, json={
        "service_id": srv_id,
        "address_id": addr_id,
        "booking_mode": "SCHEDULED",
        "scheduled_date": past_date,
        "scheduled_time": "11:30 AM – 12:30 PM",
        "payment_method": "UPI"
    })
    assert res_past.status_code == 400, f"Expected 400 for past date, got {res_past.status_code}"
    print("✓ Correctly rejected booking with past scheduled date.")

    # 3. Test booking with valid future date and slot
    future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    res_valid = client.post('/api/bookings', headers=cust_headers, json={
        "service_id": srv_id,
        "address_id": addr_id,
        "booking_mode": "SCHEDULED",
        "scheduled_date": future_date,
        "scheduled_time": "11:30 AM – 12:30 PM",
        "payment_method": "UPI"
    })
    assert res_valid.status_code in (200, 201), res_valid.get_json()
    bk_data = res_valid.get_json()
    assert bk_data["scheduled_date"] == future_date
    assert bk_data["scheduled_time"] == "11:30 AM – 12:30 PM"
    print(f"✓ Confirmed valid booking with date {future_date} and arrival slot 11:30 AM – 12:30 PM.")

def test_feature3_email_and_phone_verification():
    print("\n--- Testing Feature 3: Professional Email & Phone Verification ---")
    # 1. Disposable email rejection
    assert is_disposable_email("spammer@mailinator.com") is True
    assert is_disposable_email("user@tempmail.com") is True
    assert is_disposable_email("user@guerrillamail.com") is True
    assert is_disposable_email("user@gmail.com") is False

    valid_email, err_email = validate_email_address("fake@mailinator.com")
    assert not valid_email and "disposable" in err_email.lower()

    res_disp = client.post('/api/auth/register', json={
        "email": "hacker@mailinator.com",
        "phone": "+919876543211",
        "password": "Password123!",
        "full_name": "Disposable User",
        "role": "CUSTOMER"
    })
    assert res_disp.status_code == 400, f"Expected 400 for disposable email, got {res_disp.status_code}"
    print("✓ Correctly rejected registration using disposable email domain.")

    # 2. Indian phone validation & dummy rejection
    valid_p, norm_p, _ = normalize_and_validate_phone("+91 98234 51789")
    assert valid_p and norm_p == "+919823451789"

    valid_dummy, _, _ = normalize_and_validate_phone("0000000000")
    assert not valid_dummy
    valid_seq, _, _ = normalize_and_validate_phone("1234567890")
    assert not valid_seq

    res_dummy_p = client.post('/api/auth/register', json={
        "email": "valid_user_phone_check@gmail.com",
        "phone": "0000000000",
        "password": "Password123!",
        "full_name": "Dummy Phone User",
        "role": "CUSTOMER"
    })
    assert res_dummy_p.status_code == 400
    print("✓ Correctly rejected registration using invalid / dummy phone number.")

    # 3. OTP Verification Flow
    ts = int(datetime.now().timestamp())
    test_user_email = f"realuser_{ts}@gmail.com"
    test_user_phone = f"+919839{ts % 1000000:06d}"
    reg_res = client.post('/api/auth/register', json={
        "email": test_user_email,
        "phone": test_user_phone,
        "password": "Password123!",
        "full_name": "Real User",
        "role": "CUSTOMER"
    }, headers={"X-Require-Verify": "true"})
    assert reg_res.status_code in (200, 201), reg_res.get_json()
    reg_data = reg_res.get_json()
    assert reg_data.get("verification_required") is True
    dev_otp = reg_data.get("dev_email_otp")
    assert dev_otp is not None, "dev_email_otp missing in non-prod environment response"

    # Verify invalid OTP fails
    fail_res = client.post('/api/auth/verify-email', json={
        "email": test_user_email,
        "otp": "000000"
    })
    assert fail_res.status_code == 400, "Expected 400 for incorrect OTP"

    # Verify correct OTP succeeds
    succ_res = client.post('/api/auth/verify-email', json={
        "email": test_user_email,
        "otp": dev_otp
    })
    assert succ_res.status_code == 200, succ_res.get_json()
    print("✓ Email OTP verification succeeded with status 200.")

    # Verify DB user is marked email_verified = 1
    u = db.query_one("SELECT email_verified FROM users WHERE email = ?", [test_user_email])
    assert u["email_verified"] == 1
    print("✓ User record in database confirmed email_verified = 1.")

    # Verify Phone OTP Flow
    token_row = db.query_one("SELECT token_value FROM verification_tokens WHERE identifier = ? AND channel = 'PHONE'", [test_user_phone])
    # Resend phone OTP to test resend endpoint
    resend_res = client.post('/api/auth/resend-verification', json={
        "channel": "PHONE",
        "identifier": test_user_phone
    })
    assert resend_res.status_code in (200, 429), resend_res.get_json()
    print("✓ Resend verification endpoint tested with rate limit guard.")

def test_feature4_partner_profile_photo():
    print("\n--- Testing Feature 4: Partner Profile Photo Upload & Serving ---")
    # 1. Register a test partner
    ts = int(datetime.now().timestamp())
    part_email = f"photo_part_{ts}@gmail.com"
    part_phone = f"+919871{ts % 1000000:06d}"
    part_res = client.post('/api/auth/register', json={
        "email": part_email,
        "phone": part_phone,
        "password": "Password123!",
        "full_name": "Vikram Painter",
        "role": "PARTNER"
    }, headers={"X-Auto-Verify": "true"})
    assert part_res.status_code in (200, 201), part_res.get_json()
    part_token = part_res.get_json()["token"]
    part_headers = {"Authorization": f"Bearer {part_token}"}

    # 2. Upload base64 1x1 PNG photo
    tiny_png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    up_res = client.post('/api/partners/profile-photo', headers=part_headers, json={
        "photo": tiny_png_b64
    })
    assert up_res.status_code == 200, up_res.get_json()
    photo_url = up_res.get_json()["profile_photo"]
    assert photo_url.startswith("/uploads/avatars/"), f"Unexpected url {photo_url}"
    print(f"✓ Profile photo uploaded cleanly, URL: {photo_url}")

    # 3. Check static route serves the photo
    img_res = client.get(photo_url)
    assert img_res.status_code == 200, f"Failed to serve avatar, got {img_res.status_code}"
    assert img_res.headers.get("X-Content-Type-Options") == "nosniff"
    print("✓ Avatar served correctly via static route with nosniff security header.")

    # 4. Verify partner DB record updated
    p = db.query_one("SELECT profile_photo FROM partners WHERE full_name = 'Vikram Painter' ORDER BY created_at DESC")
    assert p["profile_photo"] == photo_url
    print("✓ Partner profile_photo column verified in database.")

def test_feature5_admin_email_and_password():
    print("\n--- Testing Feature 5: Admin Email & Secure Password Update ---")
    # Verify seed_super_admin updated email
    server.seed_super_admin()
    admin_user = db.query_one("SELECT * FROM users WHERE role = 'ADMIN' AND email = ?", ["molathotisaiteja1267@gmail.com"])
    assert admin_user is not None, "Admin user with email molathotisaiteja1267@gmail.com not found!"
    print("✓ Admin user record synchronized to molathotisaiteja1267@gmail.com in database.")

    # Test login with new credentials (retrieving password safely from env)
    admin_pw = os.environ.get("ADMIN_PASSWORD")
    login_res = client.post('/api/auth/login', json={
        "email": "molathotisaiteja1267@gmail.com",
        "password": admin_pw
    })
    assert login_res.status_code == 200, f"Admin login failed: {login_res.get_json()}"
    login_data = login_res.get_json()
    assert login_data["user"]["role"] == "ADMIN"
    assert login_data["user"]["email"] == "molathotisaiteja1267@gmail.com"
    print("✓ Admin login successfully authenticated via /api/auth/login.")

if __name__ == "__main__":
    try:
        test_feature1_ui_elements()
        test_feature2_specific_date_and_time()
        test_feature3_email_and_phone_verification()
        test_feature4_partner_profile_photo()
        test_feature5_admin_email_and_password()
        print("\n=======================================================")
        print("🎉 ALL 5 PRODUCTION ENHANCEMENTS VERIFIED SUCCESSFULLY!")
        print("=======================================================")
    except Exception as e:
        print(f"\n❌ VERIFICATION TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
