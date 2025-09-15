-- ===========================================
-- Job Ticket System Database Schema
-- ===========================================
-- File Name: schema.sql
-- Created Date: 2025-09-12
-- Modified Date: 2025-09-12
-- Version: 1.0.0
-- Description: Complete PostgreSQL schema replicating what is installed to Docker
-- Comments:
-- • Includes pgcrypto extension
-- • Table definitions based on Django migrations 0001_initial and 0002_update_ticket_misc_entry_fields
-- • PostgreSQL functions, triggers, views, indexes from custom_postgres.sql
-- • Initial data insertions for groups
-- Update Notes:
-- • 2025-09-12 (v1.0.0): Initial creation combining Django migrations and PostgreSQL features
--

-- Enable pgcrypto for encryption of sensitive data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================
-- TABLES
-- ===========================================

-- Users table (custom User model based on Django migrations)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    password VARCHAR(255) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE NULL,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(254) NOT NULL UNIQUE,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_name VARCHAR(255) NOT NULL,
    user_alias VARCHAR(255) NULL,
    user_preferred_color VARCHAR(50) NULL,
    user_preferred_landing_page VARCHAR(255) NULL,
    user_preferred_profile_picture TEXT NULL,
    user_preferred_light_or_dark_mode_mobile VARCHAR(10) DEFAULT 'dark' NOT NULL,
    user_preferred_light_or_dark_mode_desktop VARCHAR(10) DEFAULT 'light' NOT NULL,
    user_preferred_enable_alerts JSONB NULL,
    user_preferred_enable_notifications JSONB NULL,
    user_is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    user_is_manager BOOLEAN NOT NULL DEFAULT FALSE,
    user_is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    user_preferred_timezone VARCHAR(50) DEFAULT 'America/Los_Angeles' NOT NULL,
    user_agreed_to_terms BOOLEAN NOT NULL DEFAULT FALSE,
    oauth_provider VARCHAR(50) NULL,
    oauth_id VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Buildings table
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    building_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    building_name VARCHAR(255) NOT NULL,
    description TEXT NULL
);

-- Groups table
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL UNIQUE
);

-- Devices table
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    device_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NULL,
    description TEXT NULL,
    UNIQUE(building_id, device_name)
);

-- Tickets table
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Ticket entries table
CREATE TABLE ticket_entries (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    job_name VARCHAR(255) NOT NULL,
    job_start_date DATE NOT NULL,
    job_start_time TIME WITHOUT TIME ZONE NOT NULL,
    job_end_time TIME WITHOUT TIME ZONE NOT NULL,
    job_participants VARCHAR(255) NULL,
    job_reference_number VARCHAR(50) NULL,
    job_escort_delay TIME WITHOUT TIME ZONE NULL,
    job_hindrances TEXT NULL,
    job_materials_used TEXT NULL,
    job_materials_needed TEXT NULL,
    job_access_needed TEXT NULL,
    job_programming_changes TEXT NULL,
    job_dispatch_type VARCHAR(50) NOT NULL,
    job_field_status VARCHAR(50) NOT NULL,
    job_filed_status_notes TEXT NULL,
    job_followup_required BOOLEAN NOT NULL,
    job_device_details TEXT NULL,
    job_trouble_type VARCHAR(50) NOT NULL,
    job_trouble_description TEXT NOT NULL,
    job_work_description TEXT NOT NULL,
    job_technical_details TEXT NULL,
    job_changed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Ticket entry devices junction table
CREATE TABLE ticket_entry_devices (
    id BIGSERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES ticket_entries(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    UNIQUE(entry_id, device_id)
);

-- User groups junction table
CREATE TABLE user_groups (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(user_id, group_id)
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_origin VARCHAR(255) NOT NULL,
    token VARCHAR(512) NOT NULL UNIQUE,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    device_info VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL
);

-- User interaction logs table
CREATE TABLE user_interaction_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    page_name VARCHAR(255) NULL,
    widget_name VARCHAR(255) NULL,
    action_details JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    group_id INTEGER NULL REFERENCES groups(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Login attempts table
CREATE TABLE login_attempts (
    id SERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NULL,
    ip_address VARCHAR(45) NOT NULL,
    login_origin VARCHAR(255) NULL,
    success BOOLEAN NOT NULL,
    attempt_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Import export logs table
CREATE TABLE import_export_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('IMPORT', 'EXPORT')),
    file_type VARCHAR(50) NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
    details TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- History table
CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    changes JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Email verification tokens table
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NULL REFERENCES ticket_entries(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    group_id INTEGER NULL REFERENCES groups(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    trigger_field VARCHAR(50) NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE NULL,
    escalation_level VARCHAR(20) NOT NULL DEFAULT 'initial' CHECK (escalation_level IN ('initial', 'escalated', 'critical')),
    last_escalated_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Alert acknowledgments table
CREATE TABLE alert_acknowledgments (
    id BIGSERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alert_id, user_id)
);

-- Ticket misc entries table (updated with additional fields from migration 0002)
CREATE TABLE ticket_misc_entries (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    misc_name VARCHAR(255) NOT NULL,
    misc_start_date DATE NOT NULL,
    misc_start_time TIME WITHOUT TIME ZONE NOT NULL,
    misc_description TEXT NULL,
    misc_location VARCHAR(255) NULL,
    misc_duration INTEGER NULL,
    misc_priority VARCHAR(50) NULL,
    misc_participants VARCHAR(255) NULL,
    misc_notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Trigger function to create alerts for ticket_entries
CREATE OR REPLACE FUNCTION create_alert_on_ticket_entry() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.job_materials_needed IS NOT NULL THEN
        INSERT INTO alerts (entry_id, alert_type, severity, trigger_field, message, created_at)
        VALUES (NEW.id, 'job-related', 'medium', 'job_materials_needed', 'Materials needed for job', CURRENT_TIMESTAMP);
    END IF;
    IF NEW.job_access_needed IS NOT NULL THEN
        INSERT INTO alerts (entry_id, alert_type, severity, trigger_field, message, created_at)
        VALUES (NEW.id, 'job-related', 'medium', 'job_access_needed', 'Access needed for job', CURRENT_TIMESTAMP);
    END IF;
    IF NEW.job_programming_changes IS NOT NULL THEN
        INSERT INTO alerts (entry_id, alert_type, severity, trigger_field, message, created_at)
        VALUES (NEW.id, 'job-related', 'medium', 'job_programming_changes', 'Programming changes required', CURRENT_TIMESTAMP);
    END IF;
    IF NEW.job_followup_required = TRUE THEN
        INSERT INTO alerts (entry_id, alert_type, severity, trigger_field, message, created_at)
        VALUES (NEW.id, 'job-related', 'high', 'job_followup_required', 'Follow-up required for job', CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ticket entry alerts
CREATE TRIGGER ticket_entry_alert_trigger
    AFTER INSERT OR UPDATE ON ticket_entries
    FOR EACH ROW EXECUTE FUNCTION create_alert_on_ticket_entry();

-- Function to ensure device building_id matches ticket building_id
CREATE OR REPLACE FUNCTION check_ticket_entry_device_building() RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT d.building_id FROM devices d WHERE d.id = NEW.device_id) !=
       (SELECT b.id FROM buildings b
        JOIN tickets t ON b.id = t.building_id
        JOIN ticket_entries te ON t.id = te.ticket_id
        WHERE te.id = NEW.entry_id LIMIT 1) THEN
        RAISE EXCEPTION 'Device must be from the same building as the ticket entry';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ticket entry device building validation
CREATE TRIGGER ticket_entry_device_building_check
    BEFORE INSERT OR UPDATE ON ticket_entry_devices
    FOR EACH ROW EXECUTE FUNCTION check_ticket_entry_device_building();

-- Security function - Failed login alerts
CREATE OR REPLACE FUNCTION check_failed_logins() RETURNS TRIGGER AS $$
DECLARE
    failed_count INTEGER;
BEGIN
    IF NEW.success = FALSE THEN
        SELECT COUNT(*) INTO failed_count
        FROM login_attempts
        WHERE email = NEW.email
          AND ip_address = NEW.ip_address
          AND success = FALSE
          AND attempt_time > CURRENT_TIMESTAMP - INTERVAL '5 minutes';
        IF failed_count >= 5 THEN
            INSERT INTO alerts (user_id, alert_type, severity, message, created_at)
            VALUES (NEW.user_id, 'security', 'high',
                    CONCAT('Multiple failed login attempts detected for email: ', NEW.email, ' from IP: ', NEW.ip_address),
                    CURRENT_TIMESTAMP);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for failed login alerts
CREATE TRIGGER failed_login_alert_trigger
    AFTER INSERT ON login_attempts
    FOR EACH ROW EXECUTE FUNCTION check_failed_logins();

-- Security function - Suspicious IP activity alerts
CREATE OR REPLACE FUNCTION check_suspicious_ip_activity() RETURNS TRIGGER AS $$
DECLARE
    failed_count INTEGER;
BEGIN
    IF NEW.success = FALSE THEN
        SELECT COUNT(*) INTO failed_count
        FROM login_attempts
        WHERE ip_address = NEW.ip_address
          AND success = FALSE
          AND attempt_time > CURRENT_TIMESTAMP - INTERVAL '5 minutes';

        IF failed_count >= 10 THEN
            INSERT INTO alerts (alert_type, severity, message, created_at)
            VALUES ('security', 'high',
                    CONCAT('Suspicious IP activity detected from IP: ', NEW.ip_address, ' with multiple failed login attempts across accounts'),
                    CURRENT_TIMESTAMP);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for suspicious IP activity alerts
CREATE TRIGGER suspicious_ip_alert_trigger
    AFTER INSERT ON login_attempts
    FOR EACH ROW EXECUTE FUNCTION check_suspicious_ip_activity();

-- Security function - Unauthorized access alerts
CREATE OR REPLACE FUNCTION check_unauthorized_access() RETURNS TRIGGER AS $$
DECLARE
    is_authorized BOOLEAN;
BEGIN
    -- Simplified check based on user roles
    is_authorized = FALSE;
    IF NEW.action = 'DELETE' THEN
        -- Admins and managers can delete
        IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND (user_is_admin = TRUE OR user_is_manager = TRUE)) THEN
            is_authorized = TRUE;
        END IF;
    ELSIF NEW.action = 'UPDATE' THEN
        -- Admins and managers can update
        IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND (user_is_admin = TRUE OR user_is_manager = TRUE)) THEN
            is_authorized = TRUE;
        END IF;
    END IF;

    -- Create alert if unauthorized
    IF NOT is_authorized THEN
        INSERT INTO alerts (user_id, alert_type, severity, message, created_at)
        VALUES (NEW.user_id, 'security', 'critical',
                CONCAT('Unauthorized access attempt by user: ', NEW.user_id, ' on table: ', NEW.table_name, ', action: ', NEW.action),
                CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for unauthorized access alerts
CREATE TRIGGER unauthorized_access_alert_trigger
    AFTER INSERT ON history
    FOR EACH ROW EXECUTE FUNCTION check_unauthorized_access();

-- ===========================================
-- VIEWS
-- ===========================================

-- View to enforce notification limits (5 non-critical alerts per day per user)
CREATE VIEW daily_alert_counts AS
SELECT user_id, DATE(created_at) AS alert_date, COUNT(*) AS alert_count
FROM alerts
WHERE alert_type != 'critical'
GROUP BY user_id, DATE(created_at);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users (oauth_provider, oauth_id) WHERE oauth_id IS NOT NULL;

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- Login attempt indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempt_time ON login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip ON login_attempts(email, ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempt_time);

-- Ticket entry indexes
CREATE INDEX IF NOT EXISTS idx_ticket_entries_user_id ON ticket_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_ticket_id ON ticket_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entries_job_start_date ON ticket_entries(job_start_date);

-- Miscellaneous entry indexes
CREATE INDEX IF NOT EXISTS idx_ticket_misc_entries_user_id ON ticket_misc_entries(user_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_group_id ON notifications(group_id);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_alerts_entry_id ON alerts(entry_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_group_id ON alerts(group_id);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts (alert_type, severity) WHERE is_resolved = FALSE;

-- Junction table indexes
CREATE INDEX IF NOT EXISTS idx_ticket_entry_devices_entry_id ON ticket_entry_devices(entry_id);
CREATE INDEX IF NOT EXISTS idx_ticket_entry_devices_device_id ON ticket_entry_devices(device_id);

-- ===========================================
-- INITIAL DATA
-- ===========================================

-- Initialize groups with default roles
INSERT INTO groups (group_name) VALUES ('field'), ('manager'), ('admin')
ON CONFLICT (group_name) DO NOTHING;
