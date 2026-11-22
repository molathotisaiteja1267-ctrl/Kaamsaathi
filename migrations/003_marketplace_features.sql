-- Migration 003: Advanced Marketplace Features Schema
-- Supports Service Provider Onboarding, Document Verification, Progressive Notifications,
-- Availability Management, Booking Journey Tracking, and In-App Chat.

-- 1. Extend partners table with complete profile, shop, address, and skills fields
ALTER TABLE partners ADD COLUMN onboarding_completed INTEGER DEFAULT 0;
ALTER TABLE partners ADD COLUMN dob VARCHAR(32) DEFAULT '';
ALTER TABLE partners ADD COLUMN address_line TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN state VARCHAR(128) DEFAULT 'Uttar Pradesh';
ALTER TABLE partners ADD COLUMN pincode VARCHAR(16) DEFAULT '221005';
ALTER TABLE partners ADD COLUMN latitude REAL DEFAULT 25.2677;
ALTER TABLE partners ADD COLUMN longitude REAL DEFAULT 82.9913;
ALTER TABLE partners ADD COLUMN shop_name VARCHAR(255) DEFAULT '';
ALTER TABLE partners ADD COLUMN shop_address TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN shop_photo VARCHAR(255) DEFAULT '';
ALTER TABLE partners ADD COLUMN is_home_based INTEGER DEFAULT 1;
ALTER TABLE partners ADD COLUMN primary_skill VARCHAR(128) DEFAULT '';
ALTER TABLE partners ADD COLUMN secondary_skill VARCHAR(128) DEFAULT '';
ALTER TABLE partners ADD COLUMN tertiary_skill VARCHAR(128) DEFAULT '';
ALTER TABLE partners ADD COLUMN rejection_reason TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN current_latitude REAL DEFAULT 25.2677;
ALTER TABLE partners ADD COLUMN current_longitude REAL DEFAULT 82.9913;
ALTER TABLE partners ADD COLUMN location_updated_at VARCHAR(64) DEFAULT '';
ALTER TABLE partners ADD COLUMN is_sharing_location INTEGER DEFAULT 0;

-- 2. Extend bookings table for urgent vs scheduled modes, progressive search, and coordinates
ALTER TABLE bookings ADD COLUMN booking_mode VARCHAR(32) DEFAULT 'URGENT';
ALTER TABLE bookings ADD COLUMN search_radius_km REAL DEFAULT 10.0;
ALTER TABLE bookings ADD COLUMN notification_stage INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN customer_latitude REAL DEFAULT 25.2677;
ALTER TABLE bookings ADD COLUMN customer_longitude REAL DEFAULT 82.9913;

-- 3. Secure Verification Documents Table (Encrypted/Restricted access for Aadhaar & Trade Licenses)
CREATE TABLE IF NOT EXISTS partner_documents (
    id VARCHAR(64) PRIMARY KEY,
    partner_id VARCHAR(64) NOT NULL,
    doc_type VARCHAR(64) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size INTEGER DEFAULT 0,
    mime_type VARCHAR(128),
    verification_status VARCHAR(32) DEFAULT 'PENDING',
    admin_notes TEXT DEFAULT '',
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- 4. Partner Weekly Availability Schedule Table
CREATE TABLE IF NOT EXISTS partner_availability (
    id VARCHAR(64) PRIMARY KEY,
    partner_id VARCHAR(64) NOT NULL,
    day_of_week INTEGER NOT NULL,
    is_available INTEGER DEFAULT 1,
    start_time VARCHAR(16) DEFAULT '09:00',
    end_time VARCHAR(16) DEFAULT '18:00',
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- 5. Partner Date-Specific Availability & Slots / Exceptions
CREATE TABLE IF NOT EXISTS partner_availability_exceptions (
    id VARCHAR(64) PRIMARY KEY,
    partner_id VARCHAR(64) NOT NULL,
    specific_date VARCHAR(32) NOT NULL,
    is_available INTEGER DEFAULT 0,
    start_time VARCHAR(16) DEFAULT '09:00',
    end_time VARCHAR(16) DEFAULT '18:00',
    notes TEXT DEFAULT '',
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- 6. Progressive Radius Booking Notifications Table
CREATE TABLE IF NOT EXISTS booking_notifications (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) NOT NULL,
    partner_id VARCHAR(64) NOT NULL,
    stage_radius_km REAL NOT NULL DEFAULT 10.0,
    status VARCHAR(32) DEFAULT 'SENT',
    response_timeout_at VARCHAR(64) NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    responded_at VARCHAR(64),
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- 7. Booking-Specific In-App Chat & Communication Table
CREATE TABLE IF NOT EXISTS booking_chats (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    sender_role VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_partner_docs_partner ON partner_documents(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_avail_partner ON partner_availability(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_avail_day ON partner_availability(partner_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_partner_avail_exc ON partner_availability_exceptions(partner_id, specific_date);
CREATE INDEX IF NOT EXISTS idx_booking_notifs_bkg ON booking_notifications(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifs_partner ON booking_notifications(partner_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifs_status ON booking_notifications(status);
CREATE INDEX IF NOT EXISTS idx_booking_chats_bkg ON booking_chats(booking_id);
