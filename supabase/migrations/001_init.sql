-- ============================================================
-- Event Check-In, Multi-Day Dining & Organizer Dashboard
-- Migration: 001_init.sql
-- Multi-Day Dining: October 8 – 11 (9 meal sessions)
-- Concurrency-safe with row-level locking for 5+ mobile scanners
-- ============================================================

-- 1. Participants Table
CREATE TABLE IF NOT EXISTS event_participants (
    participant_id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    mobile_number VARCHAR(32),
    organization VARCHAR(255),

    -- Stage 1: Main Desk Registration
    is_registered BOOLEAN DEFAULT FALSE NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NULL,
    registered_by VARCHAR(64) DEFAULT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Multi-Day Meal Redemptions Table
CREATE TABLE IF NOT EXISTS meal_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id VARCHAR(64) NOT NULL REFERENCES event_participants(participant_id) ON DELETE CASCADE,
    meal_session VARCHAR(32) NOT NULL, -- e.g. OCT_08_DINNER, OCT_09_BREAKFAST, OCT_09_LUNCH, OCT_09_DINNER, etc.
    redeemed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    scanned_by VARCHAR(64) DEFAULT 'gate-scanner',
    gate_id VARCHAR(64) DEFAULT NULL,

    -- Ensure each participant can only redeem once per meal session
    CONSTRAINT unique_participant_meal_session UNIQUE (participant_id, meal_session)
);

-- Indexes for rapid lookup & analytics
CREATE INDEX IF NOT EXISTS idx_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_registered ON event_participants(is_registered);
CREATE INDEX IF NOT EXISTS idx_participants_mobile ON event_participants(mobile_number);
CREATE INDEX IF NOT EXISTS idx_participants_name ON event_participants(name);
CREATE INDEX IF NOT EXISTS idx_meal_redemptions_participant ON meal_redemptions(participant_id);
CREATE INDEX IF NOT EXISTS idx_meal_redemptions_session ON meal_redemptions(meal_session);
CREATE INDEX IF NOT EXISTS idx_meal_redemptions_redeemed_at ON meal_redemptions(redeemed_at);

-- 3. Stage 1 RPC: Main Desk Registration Check-In
CREATE OR REPLACE FUNCTION register_attendee(
    p_id VARCHAR,
    scanner_id VARCHAR DEFAULT 'desk-scanner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    guest RECORD;
BEGIN
    SELECT * INTO guest
    FROM event_participants
    WHERE participant_id = p_id
    FOR UPDATE;

    -- Not found
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'INVALID',
            'message', 'Ticket Not Found — Participant does not exist in the system'
        );
    END IF;

    -- Already registered
    IF guest.is_registered = TRUE THEN
        RETURN jsonb_build_object(
            'status', 'ALREADY_REGISTERED',
            'name', guest.name,
            'organization', guest.organization,
            'registered_at', guest.registered_at
        );
    END IF;

    -- Register now
    UPDATE event_participants
    SET
        is_registered = TRUE,
        registered_at = NOW(),
        registered_by = scanner_id
    WHERE participant_id = p_id;

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'name', guest.name,
        'organization', guest.organization,
        'registered_at', NOW()
    );
END;
$$;

-- 4. Stage 2 RPC: Multi-Day Meal Access Verification
CREATE OR REPLACE FUNCTION verify_meal_access(
    p_id VARCHAR,
    p_meal_session VARCHAR,
    scanner_id VARCHAR DEFAULT 'gate-scanner',
    p_gate_id VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    guest RECORD;
    redemption RECORD;
BEGIN
    SELECT * INTO guest
    FROM event_participants
    WHERE participant_id = p_id
    FOR UPDATE;

    -- Not found
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'INVALID',
            'message', 'Ticket Not Found — Participant does not exist in the system'
        );
    END IF;

    -- Not registered at desk yet
    IF guest.is_registered = FALSE THEN
        RETURN jsonb_build_object(
            'status', 'NOT_REGISTERED',
            'name', guest.name,
            'organization', guest.organization,
            'meal_session', p_meal_session,
            'message', 'Must check in at Main Desk first'
        );
    END IF;

    -- Check if meal already redeemed for this session
    SELECT * INTO redemption
    FROM meal_redemptions
    WHERE participant_id = p_id AND meal_session = p_meal_session;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'status', 'ALREADY_USED',
            'name', guest.name,
            'organization', guest.organization,
            'meal_session', p_meal_session,
            'redeemed_at', redemption.redeemed_at
        );
    END IF;

    -- Record meal redemption
    INSERT INTO meal_redemptions (participant_id, meal_session, redeemed_at, scanned_by, gate_id)
    VALUES (p_id, p_meal_session, NOW(), scanner_id, p_gate_id);

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'name', guest.name,
        'organization', guest.organization,
        'meal_session', p_meal_session,
        'redeemed_at', NOW()
    );
END;
$$;

-- 5. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_redemptions;
