# EYWA AI - Database Schema

## 📊 Conceptual Data Model

### Main Entities

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     HOTEL       │       │     LICENCE     │       │      USER       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:1──│ id (PK)         │       │ id (PK)         │
│ name            │       │ hotel_id (FK)   │       │ hotel_id (FK)   │
│ slug            │       │ plan            │       │ email           │
│ country         │       │ status          │       │ password_hash   │
│ city            │       │ start_date      │       │ role            │
│ address         │       │ end_date        │       │ first_name      │
│ rooms_count     │       │ monthly_fee     │       │ last_name       │
│ pms_type        │       │ created_at      │       │ created_at      │
│ pms_api_key     │       │ updated_at      │       │ last_login      │
│ created_at      │       └─────────────────┘       └─────────────────┘
│ updated_at      │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  PMS_CONNECTION │       │   AI_PROVIDER   │       │  CHANNEL (OTA)  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ hotel_id (FK)   │       │ name            │       │ name            │
│ pms_type        │       │ slug            │       │ slug            │
│ endpoint_url    │       │ cost_per_1k_in  │       │ commission_rate │
│ client_token    │       │ cost_per_1k_out │       │ logo_url        │
│ access_token    │       │ is_active       │       └─────────────────┘
│ refresh_token   │       └─────────────────┘               │
│ last_sync       │               │                         │
│ status          │               │                         │
│ created_at      │               │ 1:N                     │ 1:N
└─────────────────┘               ▼                         ▼
                          ┌─────────────────┐       ┌─────────────────┐
                          │   AI_SESSION    │       │    BOOKING      │
                          ├─────────────────┤       ├─────────────────┤
                          │ id (PK)         │       │ id (PK)         │
                          │ hotel_id (FK)   │       │ hotel_id (FK)   │
                          │ provider_id(FK) │       │ channel_id (FK) │
                          │ tokens_in       │       │ pms_booking_id  │
                          │ tokens_out      │       │ guest_name      │
                          │ cost            │       │ check_in        │
                          │ conversion      │       │ check_out       │
                          │ created_at      │       │ room_nights     │
                          └─────────────────┘       │ total_revenue   │
                                                    │ commission_paid │
                                                    │ net_revenue     │
                                                    │ source          │
                                                    │ created_at      │
                                                    └─────────────────┘
```

---

## 📋 Logical Data Model (PostgreSQL)

### Tables

```sql
-- =====================
-- CORE ENTITIES
-- =====================

CREATE TABLE hotels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    country         VARCHAR(100),
    city            VARCHAR(100),
    address         TEXT,
    rooms_count     INTEGER DEFAULT 0,
    pms_type        VARCHAR(50), -- mews, opera, cloudbeds, etc.
    timezone        VARCHAR(50) DEFAULT 'UTC',
    currency        VARCHAR(3) DEFAULT 'EUR',
    logo_url        TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) DEFAULT 'viewer', -- admin, manager, viewer
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone           VARCHAR(50),
    avatar_url      TEXT,
    email_verified  BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE TABLE licences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID UNIQUE REFERENCES hotels(id) ON DELETE CASCADE,
    plan            VARCHAR(50) NOT NULL, -- starter, pro, enterprise
    status          VARCHAR(50) DEFAULT 'trial', -- trial, active, suspended, cancelled
    start_date      DATE NOT NULL,
    end_date        DATE,
    monthly_fee     DECIMAL(10,2) DEFAULT 0,
    trial_ends_at   TIMESTAMPTZ,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- PMS CONNECTIONS
-- =====================

CREATE TABLE pms_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    pms_type        VARCHAR(50) NOT NULL, -- mews, opera, cloudbeds, protel, etc.
    environment     VARCHAR(20) DEFAULT 'production', -- sandbox, production
    endpoint_url    TEXT,
    client_token    TEXT,
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,
    last_sync_at    TIMESTAMPTZ,
    sync_status     VARCHAR(50) DEFAULT 'pending', -- pending, syncing, synced, error
    sync_error      TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- AI PROVIDERS & SESSIONS
-- =====================

CREATE TABLE ai_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL, -- ChatGPT, Claude, Gemini
    slug            VARCHAR(50) UNIQUE NOT NULL,
    model           VARCHAR(100), -- gpt-4, claude-3-opus, etc.
    cost_per_1k_in  DECIMAL(10,6) DEFAULT 0,
    cost_per_1k_out DECIMAL(10,6) DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    provider_id     UUID REFERENCES ai_providers(id),
    session_type    VARCHAR(50), -- booking_assist, guest_support, upsell
    tokens_in       INTEGER DEFAULT 0,
    tokens_out      INTEGER DEFAULT 0,
    cost            DECIMAL(10,4) DEFAULT 0,
    converted       BOOLEAN DEFAULT false, -- did it lead to a booking?
    conversion_value DECIMAL(10,2),
    guest_rating    INTEGER, -- 1-5 stars
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- CHANNELS (OTAs) & BOOKINGS
-- =====================

CREATE TABLE channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL, -- Booking.com, Expedia, Agoda, Direct
    slug            VARCHAR(50) UNIQUE NOT NULL,
    channel_type    VARCHAR(50), -- ota, direct, metasearch, gds
    default_commission DECIMAL(5,2) DEFAULT 0, -- percentage
    logo_url        TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    channel_id      UUID REFERENCES channels(id),
    pms_booking_id  VARCHAR(255), -- ID from PMS
    confirmation_number VARCHAR(100),
    guest_name      VARCHAR(255),
    guest_email     VARCHAR(255),
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    room_nights     INTEGER NOT NULL,
    room_type       VARCHAR(100),
    total_revenue   DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    commission_paid DECIMAL(10,2) DEFAULT 0,
    net_revenue     DECIMAL(10,2) NOT NULL,
    booking_status  VARCHAR(50) DEFAULT 'confirmed', -- confirmed, cancelled, no_show, completed
    ai_assisted     BOOLEAN DEFAULT false,
    ai_session_id   UUID REFERENCES ai_sessions(id),
    source_detail   TEXT, -- more specific source info
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- STATISTICS & REPORTS
-- =====================

CREATE TABLE daily_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    occupancy_rate  DECIMAL(5,2), -- percentage
    adr             DECIMAL(10,2), -- Average Daily Rate
    revpar          DECIMAL(10,2), -- Revenue Per Available Room
    total_revenue   DECIMAL(12,2),
    direct_bookings INTEGER DEFAULT 0,
    ota_bookings    INTEGER DEFAULT 0,
    direct_revenue  DECIMAL(12,2) DEFAULT 0,
    ota_revenue     DECIMAL(12,2) DEFAULT 0,
    ai_interactions INTEGER DEFAULT 0,
    ai_conversions  INTEGER DEFAULT 0,
    ai_cost         DECIMAL(10,4) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hotel_id, date)
);

CREATE TABLE monthly_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    year_month      VARCHAR(7) NOT NULL, -- YYYY-MM
    total_revenue   DECIMAL(14,2),
    direct_revenue  DECIMAL(14,2),
    ota_revenue     DECIMAL(14,2),
    total_bookings  INTEGER,
    direct_bookings INTEGER,
    ota_bookings    INTEGER,
    avg_occupancy   DECIMAL(5,2),
    avg_adr         DECIMAL(10,2),
    avg_revpar      DECIMAL(10,2),
    ai_sessions     INTEGER,
    ai_conversions  INTEGER,
    ai_total_cost   DECIMAL(10,2),
    eywa_fee        DECIMAL(10,2),
    commission_saved DECIMAL(12,2), -- vs if all were OTA
    net_profit_boost DECIMAL(12,2),
    roi_percentage  DECIMAL(8,2),
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hotel_id, year_month)
);

CREATE TABLE roi_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    period_type     VARCHAR(20) NOT NULL, -- daily, weekly, monthly, quarterly
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    eywa_cost       DECIMAL(10,2), -- licence + AI costs
    revenue_gained  DECIMAL(12,2), -- direct bookings that would have been OTA
    commission_saved DECIMAL(12,2),
    time_saved_hrs  DECIMAL(8,2),
    roi_percentage  DECIMAL(8,2),
    vs_baseline     JSONB, -- comparison data
    calculated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- API LOGS & AUDIT
-- =====================

CREATE TABLE api_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint        VARCHAR(255) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    request_body    JSONB,
    response_code   INTEGER,
    response_body   JSONB,
    latency_ms      INTEGER,
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL, -- info, warning, alert, success
    category        VARCHAR(50), -- booking, sync, billing, system
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    action_url      TEXT,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_users_hotel ON users(hotel_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX idx_bookings_dates ON bookings(hotel_id, check_in, check_out);
CREATE INDEX idx_bookings_channel ON bookings(channel_id);
CREATE INDEX idx_daily_stats_hotel_date ON daily_stats(hotel_id, date);
CREATE INDEX idx_ai_sessions_hotel ON ai_sessions(hotel_id);
CREATE INDEX idx_api_logs_hotel ON api_logs(hotel_id, created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);

-- =====================
-- SEED DATA
-- =====================

-- AI Providers
INSERT INTO ai_providers (name, slug, model, cost_per_1k_in, cost_per_1k_out) VALUES
('ChatGPT', 'chatgpt', 'gpt-4-turbo', 0.01, 0.03),
('Claude', 'claude', 'claude-3-opus', 0.015, 0.075),
('Claude Sonnet', 'claude-sonnet', 'claude-3-sonnet', 0.003, 0.015),
('Gemini', 'gemini', 'gemini-1.5-pro', 0.007, 0.021);

-- Channels (OTAs)
INSERT INTO channels (name, slug, channel_type, default_commission) VALUES
('Direct', 'direct', 'direct', 0),
('Booking.com', 'booking', 'ota', 15),
('Expedia', 'expedia', 'ota', 18),
('Agoda', 'agoda', 'ota', 15),
('Hotels.com', 'hotels-com', 'ota', 18),
('Airbnb', 'airbnb', 'ota', 14),
('Google Hotels', 'google-hotels', 'metasearch', 10),
('TripAdvisor', 'tripadvisor', 'metasearch', 12);
```

---

## 🎯 MVP Features Mapping

| Feature | Tables Used |
|---------|-------------|
| **Login/Auth** | users, hotels |
| **Licence Management** | licences |
| **PMS Connection** | pms_connections |
| **Bookings Dashboard** | bookings, channels, daily_stats |
| **AI Performance** | ai_sessions, ai_providers |
| **ROI Calculator** | roi_metrics, monthly_reports |
| **API Playground** | api_logs |
| **Notifications** | notifications |

---

## 🔗 Relationships Summary

- **Hotel** 1:1 **Licence**
- **Hotel** 1:N **Users**
- **Hotel** 1:N **PMS Connections**
- **Hotel** 1:N **Bookings**
- **Hotel** 1:N **AI Sessions**
- **Hotel** 1:N **Daily Stats**
- **Booking** N:1 **Channel**
- **AI Session** N:1 **AI Provider**

---

## 📝 Notes

- UUIDs for all PKs (security + distributed-friendly)
- TIMESTAMPTZ for all dates (timezone-aware)
- JSONB for flexible data (vs_baseline, request/response)
- Soft delete via `is_active` flag instead of DELETE
- Indexes on frequently searched columns
