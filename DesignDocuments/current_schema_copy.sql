-- Work Management System - Current Schema Copy
-- Based on PostgreSQL schema from Database_schema.txt
-- Adapted for browser-based implementation with IndexedDB
--
-- ARCHITECTURAL STRUCTURE:
-- 1 Building -> 1 Device -> Many Possible Errors/Tasks
-- Each building contains one or more devices, and each device can have multiple task entries (trouble tickets)

-- Core lookup tables for buildings and devices
CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    building_uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    building_name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    device_uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    building_id INTEGER NOT NULL REFERENCES buildings(building_id),
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50),
    description TEXT,
    CONSTRAINT unique_device_name_per_building UNIQUE (building_id, device_name)
);

-- Tickets table for unique ticket numbers
CREATE TABLE tickets (
    ticket_id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    building_id INTEGER NOT NULL REFERENCES buildings(building_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Main job entries (equivalent to current JobTicketSystem form)
CREATE TABLE ticket_entries (
    entry_id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(ticket_id),
    job_name VARCHAR(255) NOT NULL,
    job_start_date DATE NOT NULL,
    job_start_time TIME NOT NULL,
    job_end_time TIME NOT NULL,
    job_participants VARCHAR(255),
    job_reference_number VARCHAR(50),
    job_escort_delay TIME,
    job_hindrances TEXT,
    job_materials_used TEXT,
    job_materials_needed TEXT,
    job_access_needed TEXT,
    job_programming_changes TEXT,
    job_dispatch_type VARCHAR(50) NOT NULL,
    job_field_status VARCHAR(50) NOT NULL,
    job_filed_status_notes TEXT,
    job_followup_required BOOLEAN NOT NULL,
    job_device_details TEXT,
    job_trouble_type VARCHAR(50) NOT NULL,
    job_trouble_description TEXT NOT NULL,
    job_work_description TEXT NOT NULL,
    job_technical_details TEXT,
    email_parse_title_validation_flag JSONB,          -- Stores cross-validation results between email titles and body content
    email_parse_title_validation_status VARCHAR(20) DEFAULT 'unknown' CHECK (email_parse_title_validation_status IN ('valid', 'warning', 'error', 'unknown')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Device associations for jobs (many-to-many)
CREATE TABLE ticket_entry_devices (
    entry_id INTEGER NOT NULL REFERENCES ticket_entries(entry_id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES devices(device_id) ON DELETE RESTRICT,
    PRIMARY KEY (entry_id, device_id)
);

-- Basic history for auditing local changes
CREATE TABLE history (
    history_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simple export/import logging
CREATE TABLE import_export_logs (
    log_id SERIAL PRIMARY KEY,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('IMPORT', 'EXPORT')),
    file_type VARCHAR(50),
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
