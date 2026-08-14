-- Migration 001: Initial Core Relational Schema
-- Supports PostgreSQL and SQLite

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(32),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK(role IN ('CUSTOMER', 'PARTNER', 'ADMIN')),
    email_verified INTEGER DEFAULT 1,
    phone_verified INTEGER DEFAULT 1,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret VARCHAR(64),
    account_status VARCHAR(32) DEFAULT 'ACTIVE' CHECK(account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETED')),
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    expires_at VARCHAR(64) NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    expires_at VARCHAR(64) NOT NULL,
    used INTEGER DEFAULT 0,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    profile_photo VARCHAR(255) DEFAULT '',
    preferred_language VARCHAR(64) DEFAULT 'Hindi',
    bio TEXT DEFAULT '',
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partners (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    initials VARCHAR(8) DEFAULT 'KP',
    profile_photo VARCHAR(255) DEFAULT '',
    avatar_bg VARCHAR(128) DEFAULT 'linear-gradient(135deg,#1d4545,#c98965)',
    bio TEXT DEFAULT '',
    experience_years INTEGER DEFAULT 1,
    service_city VARCHAR(128) DEFAULT 'Varanasi',
    service_locality VARCHAR(128) DEFAULT 'Lanka',
    service_radius VARCHAR(64) DEFAULT '5 km',
    verification_status VARCHAR(32) DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED')),
    rating REAL DEFAULT 5.0,
    rating_count INTEGER DEFAULT 0,
    completed_jobs INTEGER DEFAULT 0,
    response_rate VARCHAR(32) DEFAULT '100%',
    on_time_rate VARCHAR(32) DEFAULT '100%',
    starting_price INTEGER DEFAULT 149,
    is_online INTEGER DEFAULT 1,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    base_price INTEGER NOT NULL,
    active INTEGER DEFAULT 1,
    icon VARCHAR(32) DEFAULT '⚡',
    color VARCHAR(32) DEFAULT '#fff1cf',
    created_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_services (
    id VARCHAR(64) PRIMARY KEY,
    partner_id VARCHAR(64) NOT NULL,
    service_id VARCHAR(64) NOT NULL,
    experience_years INTEGER DEFAULT 1,
    price INTEGER NOT NULL,
    verified INTEGER DEFAULT 1,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    label VARCHAR(64) DEFAULT 'Home',
    address TEXT NOT NULL,
    locality VARCHAR(128) NOT NULL,
    city VARCHAR(128) NOT NULL DEFAULT 'Varanasi',
    state VARCHAR(128) NOT NULL DEFAULT 'Uttar Pradesh',
    pincode VARCHAR(16) NOT NULL,
    landmark VARCHAR(255) DEFAULT '',
    latitude REAL DEFAULT 25.2677,
    longitude REAL DEFAULT 82.9913,
    is_default INTEGER DEFAULT 0,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verifications (
    id VARCHAR(64) PRIMARY KEY,
    partner_id VARCHAR(64) NOT NULL,
    verification_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'INFO_REQUESTED')),
    provider_reference VARCHAR(128),
    masked_identifier VARCHAR(255),
    reviewed_by VARCHAR(64),
    reviewed_at VARCHAR(64),
    notes TEXT,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(64) PRIMARY KEY,
    booking_reference VARCHAR(64) UNIQUE NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    partner_id VARCHAR(64),
    service_id VARCHAR(64) NOT NULL,
    address_id VARCHAR(64),
    description TEXT,
    scheduled_date VARCHAR(64) NOT NULL,
    scheduled_time VARCHAR(128) NOT NULL,
    estimated_price INTEGER NOT NULL,
    final_price INTEGER NOT NULL,
    platform_fee INTEGER DEFAULT 20,
    tax INTEGER DEFAULT 36,
    total_amount INTEGER NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PARTNER_ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED')),
    cancellation_reason TEXT,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE SET NULL,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS booking_status_history (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) NOT NULL,
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    changed_by VARCHAR(64) NOT NULL,
    notes TEXT,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    amount INTEGER NOT NULL,
    payment_method VARCHAR(64) NOT NULL,
    transaction_reference VARCHAR(128) UNIQUE NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'REFUNDED', 'FAILED')),
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) UNIQUE NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    partner_id VARCHAR(64) NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    category VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
    resolution TEXT,
    resolved_by VARCHAR(64),
    created_at VARCHAR(64) NOT NULL,
    resolved_at VARCHAR(64),
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    ticket_reference VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    booking_id VARCHAR(64),
    category VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    admin_response TEXT DEFAULT '',
    resolved_by VARCHAR(64),
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(64) DEFAULT 'info',
    read_status INTEGER DEFAULT 0,
    created_at VARCHAR(64) NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    admin_id VARCHAR(64),
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64),
    description TEXT NOT NULL,
    created_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at VARCHAR(64) NOT NULL
);
