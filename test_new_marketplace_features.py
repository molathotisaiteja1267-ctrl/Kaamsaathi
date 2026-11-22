import os
import requests
import json
import sys
import uuid
import random

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================================")
    print("  KAAMSAATHI 8 MAJOR MARKETPLACE FEATURES VERIFICATION SUITE")
    print("==================================================================")
    s = requests.Session()
    run_id = uuid.uuid4().hex[:6]
    rand_phone1 = f"+91 98{random.randint(10000000, 99999999)}"
    rand_phone2 = f"+91 91{random.randint(10000000, 99999999)}"
    rand_phone3 = f"+91 93{random.randint(10000000, 99999999)}"

    # ------------------------------------------------------------------
    # Step 0: Health Check
    # ------------------------------------------------------------------
    print("\n[Step 0] Checking server health...")
    r = s.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print(f"✓ Health check OK: {r.json().get('status')}")

    # ------------------------------------------------------------------
    # Step 1: Feature 1 - Partner Registration & Onboarding Lifecycle
    # ------------------------------------------------------------------
    print("\n[Step 1] Testing Feature 1: Partner Onboarding & Verification Lifecycle...")
    partner_email = f"pro_{run_id}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": partner_email,
        "phone": rand_phone1,
        "password": "Password123!",
        "full_name": "Ramesh Kumar Sharma",
        "city": "Varanasi",
        "role": "PARTNER"
    })
    assert r.status_code in (200, 201), f"Partner registration failed: {r.text}"
    token_p = r.json().get("token")
    headers_p = {"Authorization": f"Bearer {token_p}"}
    print("✓ Partner registered successfully.")

    # Check initial profile status: must be PENDING and onboarding_completed = 0 (Profile Incomplete)
    r = s.get(f"{BASE_URL}/api/partners/profile/me", headers=headers_p)
    assert r.status_code == 200, f"Failed to get partner profile: {r.text}"
    p_data = r.json().get("partner")
    partner_id = p_data["id"]
    assert p_data["verification_status"] == "PENDING", f"Expected PENDING, got {p_data['verification_status']}"
    assert p_data["onboarding_completed"] == 0, f"Expected 0, got {p_data['onboarding_completed']}"
    print(f"✓ Initial partner verification status is '{p_data['verification_status']}' with onboarding_completed=0.")

    # Submit 5-step onboarding details
    r = s.post(f"{BASE_URL}/api/partners/onboarding", headers=headers_p, json={
        "dob": "1992-05-15",
        "address_line": "Shop 4, Lanka Crossing, Varanasi",
        "state": "Uttar Pradesh",
        "pincode": "221005",
        "latitude": 25.2677,
        "longitude": 82.9913,
        "shop_name": "Sharma Electricals & Repair",
        "shop_address": "Lanka Crossing, Varanasi",
        "is_home_based": 0,
        "primary_skill": "Electrician",
        "secondary_skill": "Appliance Repair",
        "tertiary_skill": "Cooler Repair",
        "experience_years": 6,
        "starting_price": 199,
        "service_locality": "Lanka",
        "service_radius": "10 km",
        "bio": "Certified electrician with 6+ years experience repairing domestic wiring, motors, and cooling systems.",
        "selected_services": ["srv-1"]
    })
    assert r.status_code == 200, f"Onboarding submission failed: {r.text}"
    print(f"✓ Partner onboarding submitted: {r.json().get('message')}")

    # Check updated profile status: must now be UNDER_REVIEW and onboarding_completed = 1
    r = s.get(f"{BASE_URL}/api/partners/profile/me", headers=headers_p)
    p_data = r.json().get("partner")
    assert p_data["verification_status"] == "UNDER_REVIEW", f"Expected UNDER_REVIEW, got {p_data['verification_status']}"
    assert p_data["onboarding_completed"] == 1, f"Expected 1, got {p_data['onboarding_completed']}"
    assert p_data["shop_name"] == "Sharma Electricals & Repair"
    print("✓ Verification status updated to 'UNDER_REVIEW' with onboarding_completed=1.")

    # Test Document upload
    r = s.post(f"{BASE_URL}/api/partners/documents/upload", headers=headers_p, json={
        "document_type": "AADHAAR",
        "document_side": "FRONT",
        "file_url": "https://kaamsaathi.local/docs/aadhaar_front_sample.jpg",
        "masked_identifier": "XXXX-XXXX-9876"
    })
    assert r.status_code in (200, 201), f"Document upload failed: {r.text}"
    print("✓ Partner KYC document uploaded successfully.")

    # ------------------------------------------------------------------
    # Step 2: Feature 8 - Admin KYC Audit & Verification
    # ------------------------------------------------------------------
    print("\n[Step 2] Testing Feature 8: Admin Verification Review & Approval...")
    # Login as Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "molathotisaiteja1267@gmail.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "KaamSaathiAdmin@2028")
    r = s.post(f"{BASE_URL}/api/admin/login", json={
        "email": admin_email,
        "password": admin_pw
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    token_adm = r.json().get("token")
    headers_adm = {"Authorization": f"Bearer {token_adm}"}
    print("✓ Admin authenticated.")

    # Inspect Pending Verifications queue
    r = s.get(f"{BASE_URL}/api/admin/verifications", headers=headers_adm)
    assert r.status_code == 200, f"Failed to fetch admin verifications: {r.text}"
    vers = r.json().get("verifications", [])
    matching_ver = next((v for v in vers if v["partner_id"] == partner_id), None)
    assert matching_ver is not None, "Submitted partner verification not found in Admin queue"
    print(f"✓ Admin successfully audited pending partner application (ID: {matching_ver['id']}).")
    assert len(matching_ver.get("documents", [])) > 0, "Uploaded documents missing from admin audit view"
    print(f"✓ Admin inspected {len(matching_ver['documents'])} uploaded documents for partner.")

    # Admin decides: Approve partner
    r = s.post(f"{BASE_URL}/api/admin/verifications/{matching_ver['id']}/decide", headers=headers_adm, json={
        "decision": "VERIFIED",
        "notes": "Audited via Admin Desk. Documents verified."
    })
    assert r.status_code == 200, f"Admin decision failed: {r.text}"
    print(f"✓ Admin approved partner KYC: {r.json().get('message')}")

    # Verify partner profile is now VERIFIED
    r = s.get(f"{BASE_URL}/api/partners/profile/me", headers=headers_p)
    p_data = r.json().get("partner")
    assert p_data["verification_status"] == "VERIFIED", f"Expected VERIFIED, got {p_data['verification_status']}"
    print("✓ Partner profile status confirmed as 'VERIFIED'.")

    # ------------------------------------------------------------------
    # Step 3: Feature 4 - Partner Availability System
    # ------------------------------------------------------------------
    print("\n[Step 3] Testing Feature 4: Partner Availability (Online Toggle & Weekly Schedule)...")
    # Immediate Online Toggle
    r = s.post(f"{BASE_URL}/api/partners/availability/status", headers=headers_p, json={"is_online": 1})
    assert r.status_code == 200, f"Online toggle failed: {r.text}"
    print(f"✓ Partner Online toggle updated: {r.json().get('message')}")

    # Set Weekly Schedule (Mon-Sun)
    weekly_schedule = [
        {"day_of_week": 1, "is_available": 1, "start_time": "08:00", "end_time": "20:00"},
        {"day_of_week": 2, "is_available": 1, "start_time": "08:00", "end_time": "20:00"},
        {"day_of_week": 3, "is_available": 1, "start_time": "08:00", "end_time": "20:00"},
        {"day_of_week": 4, "is_available": 1, "start_time": "08:00", "end_time": "20:00"},
        {"day_of_week": 5, "is_available": 1, "start_time": "08:00", "end_time": "20:00"},
        {"day_of_week": 6, "is_available": 1, "start_time": "09:00", "end_time": "18:00"},
        {"day_of_week": 0, "is_available": 0, "start_time": "00:00", "end_time": "00:00"}  # Sunday off
    ]
    r = s.post(f"{BASE_URL}/api/partners/availability/weekly", headers=headers_p, json={"schedule": weekly_schedule})
    assert r.status_code == 200, f"Weekly schedule update failed: {r.text}"
    print("✓ 7-day weekly schedule saved.")

    # Add Date Exception (Holiday)
    r = s.post(f"{BASE_URL}/api/partners/availability/exception", headers=headers_p, json={
        "exception_date": "2026-12-25",
        "reason": "Christmas Day Holiday",
        "is_unavailable": 1
    })
    assert r.status_code in (200, 201), f"Exception addition failed: {r.text}"
    ex_id = r.json().get("exception_id")
    print(f"✓ Date exception registered (ID: {ex_id}).")

    # Fetch Availability
    r = s.get(f"{BASE_URL}/api/partners/availability", headers=headers_p)
    assert r.status_code == 200
    avail_data = r.json()
    assert len(avail_data.get("schedule", [])) >= 7, "Weekly schedule missing days"
    assert any(ex["id"] == ex_id for ex in avail_data.get("exceptions", [])), "Exception not found"
    print("✓ Availability verification confirmed (7 days + holiday exception).")

    # ------------------------------------------------------------------
    # Step 4: Feature 6 - Provider Discovery & Public Profile
    # ------------------------------------------------------------------
    print("\n[Step 4] Testing Feature 6: Provider Discovery & Public Profile...")
    r = s.get(f"{BASE_URL}/api/partners/search?locality=Lanka&online_only=1")
    assert r.status_code == 200, f"Search failed: {r.text}"
    search_results = r.json().get("partners", [])
    found_pro = next((p for p in search_results if p["id"] == partner_id), None)
    assert found_pro is not None, "Newly verified and online pro not found in search"
    print(f"✓ Pro discovered in search: {found_pro['full_name']} (Rating: ★{found_pro['rating']})")

    # Fetch Public Profile
    r = s.get(f"{BASE_URL}/api/partners/{partner_id}/public-profile")
    assert r.status_code == 200, f"Public profile fetch failed: {r.text}"
    prof_resp = r.json()
    assert prof_resp["partner"]["id"] == partner_id
    assert len(prof_resp.get("availability", [])) >= 7
    print(f"✓ Public profile loaded with bio, availability schedule, and services.")

    # ------------------------------------------------------------------
    # Step 5: Feature 2 & 7 - Two Booking Modes & Progressive Dispatch
    # ------------------------------------------------------------------
    print("\n[Step 5] Testing Features 2 & 7: Two Booking Modes, Progressive Dispatch & Atomic Acceptance...")
    # Register/Login customer
    cust_email = f"customer_{run_id}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": cust_email,
        "phone": rand_phone2,
        "password": "Password123!",
        "full_name": "Ananya Verma",
        "city": "Varanasi",
        "role": "CUSTOMER"
    })
    token_c = r.json().get("token")
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # Add Customer Address
    r = s.post(f"{BASE_URL}/api/addresses", headers=headers_c, json={
        "address": "B-12 Sankat Mochan Road, Lanka",
        "locality": "Lanka",
        "pincode": "221005",
        "label": "Home"
    })
    addr_id = r.json().get("address_id")

    # Fetch active service
    r_srv = s.get(f"{BASE_URL}/api/services")
    services_list = r_srv.json().get("services", [])
    active_srv_id = services_list[0]["id"] if services_list else "srv_a027a962"

    # Mode A: URGENT BOOKING
    r = s.post(f"{BASE_URL}/api/bookings", headers=headers_c, json={
        "service_id": active_srv_id,
        "address_id": addr_id,
        "description": "Ceiling fan regulator sparking and humming loudly",
        "booking_mode": "URGENT",
        "scheduled_date": "Today",
        "scheduled_time": "Immediate (15–20 min)",
        "payment_method": "UPI"
    })
    assert r.status_code in (200, 201), f"Urgent booking creation failed: {r.text}"
    b_urgent = r.json()
    urgent_booking_id = b_urgent.get("booking_id")
    print(f"✓ Mode A (Urgent Booking) placed: Ref {b_urgent.get('booking_reference')}, Stage {b_urgent.get('notification_stage', 1)} (Radius: {b_urgent.get('search_radius_km', 12)} km)")

    # Test Progressive Expansion
    r = s.post(f"{BASE_URL}/api/bookings/{urgent_booking_id}/expand-search", headers=headers_c)
    assert r.status_code == 200, f"Expansion failed: {r.text}"
    print(f"✓ Progressive notification expansion: {r.json().get('message')} (New Radius: {r.json().get('new_radius_km')} km)")

    # Partner accepts booking atomically
    r = s.post(f"{BASE_URL}/api/bookings/{urgent_booking_id}/accept", headers=headers_p)
    assert r.status_code == 200, f"Partner acceptance failed: {r.text}"
    print("✓ Partner successfully accepted booking.")

    # Atomic Conflict Guard: Attempt second acceptance on already-accepted booking
    # Register a second partner to test collision prevention
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": f"partner2_{run_id}@example.com",
        "phone": rand_phone3,
        "password": "Password123!",
        "full_name": "Vikram Singh",
        "city": "Varanasi",
        "role": "PARTNER"
    })
    assert r.status_code == 201, f"Partner 2 registration failed: {r.status_code} {r.text}"
    token_p2 = r.json().get("token")
    headers_p2 = {"Authorization": f"Bearer {token_p2}"}

    # Onboard and verify partner2 so they are a verified partner
    s.post(f"{BASE_URL}/api/partners/onboarding", headers=headers_p2, json={
        "primary_skill": "Electrician",
        "experience_years": 5,
        "service_locality": "Lanka"
    })
    r_ver2 = s.get(f"{BASE_URL}/api/admin/verifications", headers=headers_adm)
    approved_p2 = False
    for v in r_ver2.json().get("verifications", []):
        if v.get("partner_email") == f"partner2_{run_id}@example.com" or v.get("email") == f"partner2_{run_id}@example.com":
            r_dec = s.post(f"{BASE_URL}/api/admin/verifications/{v['id']}/decide", headers=headers_adm, json={
                "decision": "VERIFIED",
                "notes": "Approved for conflict test"
            })
            assert r_dec.status_code == 200, f"Failed to approve partner 2: {r_dec.text}"
            approved_p2 = True
            break
    assert approved_p2, f"Partner 2 verification application not found in admin queue: {r_ver2.text}"

    r = s.post(f"{BASE_URL}/api/bookings/{urgent_booking_id}/accept", headers=headers_p2)
    assert r.status_code == 409, f"Expected 409 Conflict, got {r.status_code}: {r.text}"
    print(f"✓ Conflict Guard passed: Competing verified partner received 409 Conflict ('{r.json().get('error')}')")

    # Mode B: SCHEDULED APPOINTMENT
    r = s.post(f"{BASE_URL}/api/bookings", headers=headers_c, json={
        "service_id": active_srv_id,
        "partner_id": partner_id,
        "address_id": addr_id,
        "description": "Scheduled maintenance of electrical switchboards",
        "booking_mode": "SCHEDULED",
        "scheduled_date": "Tomorrow",
        "scheduled_time": "05:00 PM – 07:00 PM",
        "payment_method": "Cash"
    })
    assert r.status_code in (200, 201), f"Scheduled booking creation failed: {r.text}"
    b_sched = r.json()
    print(f"✓ Mode B (Scheduled Appointment) placed: Partner pre-assigned ({partner_id}), Time slot {b_sched.get('booking_reference')}")

    # ------------------------------------------------------------------
    # Step 6: Feature 3 - Live Tracking & In-App Booking Chat
    # ------------------------------------------------------------------
    print("\n[Step 6] Testing Feature 3: Live Tracking (8 Milestones) & In-App Booking Chat...")
    # Partner enables location sharing
    s.post(f"{BASE_URL}/api/partners/location/toggle-sharing", headers=headers_p, json={"is_sharing": 1})
    s.post(f"{BASE_URL}/api/partners/location/update", headers=headers_p, json={"latitude": 25.2750, "longitude": 82.9980})

    # Partner advances job status to ON_THE_WAY
    s.post(f"{BASE_URL}/api/bookings/{urgent_booking_id}/status", headers=headers_p, json={"status": "ON_THE_WAY"})

    # Customer fetches live tracking
    r = s.get(f"{BASE_URL}/api/bookings/{urgent_booking_id}/tracking", headers=headers_c)
    assert r.status_code == 200, f"Tracking fetch failed: {r.text}"
    trk = r.json()
    milestones = trk.get("milestones", [])
    assert len(milestones) == 8, f"Expected 8 milestones, got {len(milestones)}"
    active_m = next((m for m in milestones if m["active"]), None)
    assert active_m is not None and active_m["key"] == "ON_THE_WAY", f"Expected active milestone ON_THE_WAY, got {active_m}"
    assert trk.get("distance_km") is not None, "Distance calculation missing"
    assert trk.get("eta_minutes") is not None, "ETA calculation missing"
    print(f"✓ 8-step journey verified. Current Active Milestone: {active_m['title']} ({trk['distance_km']} km away, ETA ~{trk['eta_minutes']} mins)")

    # In-App Chat: Customer sends message
    r = s.post(f"{BASE_URL}/api/bookings/{urgent_booking_id}/chat", headers=headers_c, json={
        "message": "Hi, I am near the Sankat Mochan temple lane. Please call if you cannot find the gate."
    })
    assert r.status_code in (200, 201), f"Customer chat send failed: {r.text}"
    print("✓ Customer sent in-app message.")

    # Partner replies to chat
    r = s.post(f"{BASE_URL}/api/bookings/{urgent_booking_id}/chat", headers=headers_p, json={
        "message": "Understood! I have reached Lanka Crossing, arriving in 5 minutes."
    })
    assert r.status_code in (200, 201), f"Partner chat send failed: {r.text}"
    print("✓ Partner replied to in-app message.")

    # Verify chat history
    r = s.get(f"{BASE_URL}/api/bookings/{urgent_booking_id}/chat", headers=headers_c)
    msgs = r.json().get("messages", [])
    assert len(msgs) >= 2, f"Expected at least 2 chat messages, got {len(msgs)}"
    print(f"✓ Chat history verified ({len(msgs)} messages exchanged).")

    # IDOR Protection: Third party (partner2) attempts to read booking chat
    r = s.get(f"{BASE_URL}/api/bookings/{urgent_booking_id}/chat", headers=headers_p2)
    assert r.status_code == 403, f"Expected 403 Forbidden for non-participant, got {r.status_code}"
    print("✓ IDOR protection verified: Non-participant blocked with 403 Forbidden.")

    # ------------------------------------------------------------------
    # Step 7: Feature 5 - AI Assistant Natural Multi-Turn Conversation
    # ------------------------------------------------------------------
    print("\n[Step 7] Testing Feature 5: AI Assistant Clarifying Questions & Pro Discovery...")
    # Ambiguous short query
    r = s.post(f"{BASE_URL}/api/assistant/chat", json={
        "message": "cooler",
        "history": []
    })
    assert r.status_code == 200, f"Assistant chat failed: {r.text}"
    resp_ambig = r.json()
    assert resp_ambig.get("action") in ("CLARIFYING_QUESTION", "CLARIFICATION_REQUESTED"), f"Expected clarification, got {resp_ambig.get('action')}"
    assert len(resp_ambig.get("suggestions", [])) > 0, "Clarifying suggestions missing"
    print(f"✓ AI asked clarifying question for 'cooler':\n  '{resp_ambig.get('reply')[:80]}...'")
    print(f"  Suggestions provided: {resp_ambig.get('suggestions')}")

    # Specific query discovering real providers
    r = s.post(f"{BASE_URL}/api/assistant/chat", json={
        "message": "I need an electrician for my fan repair in Lanka",
        "history": []
    })
    assert r.status_code == 200, f"Assistant chat failed: {r.text}"
    resp_match = r.json()
    assert resp_match.get("action") == "SERVICE_MATCHED"
    rec_pros = resp_match.get("action_data", {}).get("recommended_providers", [])
    assert len(rec_pros) > 0, "No real recommended providers returned by AI Assistant"
    print(f"✓ AI matched service and discovered {len(rec_pros)} real verified pros in Varanasi:\n  Top Pro: {rec_pros[0]['full_name']} (★ {rec_pros[0]['rating']} · ₹{rec_pros[0]['starting_price']})")

    print("\n==================================================================")
    print("  ALL 8 MARKETPLACE FEATURES VERIFIED & OPERATIONAL (100% PASS)")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
