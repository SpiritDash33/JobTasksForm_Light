-- File Name: ProjectDocuments_WIP/db/custom_postgres.sql
-- Created Date: 2025-09-03
-- Modified Date: 2025-09-03
-- Version: 2.0.0
-- Description: PostgreSQL-specific features for Job Ticket System (no table definitions).
-- Comments:
-- • Contains only PostgreSQL extensions, functions, triggers, indexes, and views
-- • Table creation is handled by Django migrations, not this file
-- • Used by Django migration 0002_add_postgres_features.py
-- Update Notes:
-- • 2025-09-03 (v2.0.0): Removed table creation statements to fix migration conflicts

-- Enable pgcrypto for encryption of sensitive data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Trigger function to create alerts for ticket_entries
CREATE OR REPLACE FUNCTION create_alert_on_ticket_entry() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.job_materials_needed IS NOT NULL THEN
        INSERT INTO alerts (entry_id, alert_type, severity, message, created_at)
        VALUES (NEW.entry_id, 'job-related', 'medium', 'Materials needed for job', CURRENT_TIMESTAMP);
    END IF;
    IF NEW.job_access_needed IS NOT NULL THEN
        INSERT INTO alerts (entry_id, alert_type, severity, message, created_at)
        VALUES (NEW.entry_id, 'job-related', 'medium', 'Access needed for job', CURRENT_TIMESTAMP);
    END IF;
    IF NEW.job_programming_changes IS NOT NULL THEN
        INSERT INTO alerts (entry_id, alert_type, severity, message, created_at)
        VALUES (NEW.entry_id, 'job-related', 'medium', 'Programming changes required', CURRENT_TIMESTAMP);
    END IF;
    IF NEW.job_followup_required = TRUE THEN
        INSERT INTO alerts (entry_id, alert_type, severity, message, created_at)
        VALUES (NEW.entry_id, 'job-related', 'high', 'Follow-up required for job', CURRENT_TIMESTAMP);
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
        JOIN devices d2 ON b.id = d2.building_id 
        JOIN ticket_entry_devices ted ON d2.id = ted.device_id 
        WHERE ted.entry_id = NEW.entry_id LIMIT 1) THEN
        RAISE EXCEPTION 'Device must be from the same building as other devices in this ticket entry';
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
    user_role_admin BOOLEAN;
    user_role_manager BOOLEAN;
    is_authorized BOOLEAN;
BEGIN
    SELECT user_is_admin, user_is_manager INTO user_role_admin, user_role_manager
    FROM users WHERE id = NEW.user_id;

    is_authorized = FALSE;
    IF NEW.action = 'DELETE' THEN
        IF user_role_admin THEN
            is_authorized = TRUE;
        ELSIF user_role_manager THEN
            is_authorized = TRUE;
        END IF;
    ELSIF NEW.action = 'UPDATE' THEN
        IF user_role_admin THEN
            is_authorized = TRUE;
        ELSIF user_role_manager THEN
            is_authorized = TRUE;
        END IF;
    END IF;

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
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

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
