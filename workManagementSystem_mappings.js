// Work Management System - Data Mapping Engine 🏗️
// Based on: 1 Building → 1 Device → Many Tasks/Errors
// Handles transformation between database fields and export formats

const EXPORT_MAPPINGS = {
    // Clipboard format - matches existing TicketCopyPaste_Template.txt
    clipboard: {
        template: `Job Name: {{job_name}}
Job Number: {{job_number}} Building: {{building_code}}
Address: {{building_address}}

REF#:
Escort Delay: {{job_escort_delay_formatted}}
Start: {{job_start_time_formatted}}
End: {{job_end_time_formatted}}
Participants: {{job_participants}}

Material Used: {{job_materials_used}}
Material Needed: {{job_materials_needed}}

Hinderance: {{job_hindrances}}
Access Needed: {{job_access_needed}}
Programming Changes: {{job_programming_changes}}

Dispatched: {{job_dispatch_type}}
Field Status: {{job_field_status}}
Status Notes: {{job_filed_status_notes}}

Device Name: {{device_id}}
Problem Description: {{job_trouble_description}}
Trouble Type: {{job_trouble_type}}
Device Details: {{job_device_details}}

Related Tickets: {{related_tickets}}

Work Description: {{job_work_description}}

Technical Details: {{job_technical_details}}

Date Completed: {{job_start_date_formatted}}
Ticket #: {{job_number}}`,
        transformations: {
            // Transform database fields for export
            job_escort_delay_formatted: (value) => value ? formatTimeForDisplay(value) : '',
            job_start_time_formatted: (value) => value ? formatTimeForDisplay(value) : '',
            job_end_time_formatted: (value) => value ? formatTimeForDisplay(value) : '',
            job_start_date_formatted: (value) => value ? formatDateForDisplay(value) : '',
            building_code: (value, jobData) => value || extractBuildingCode(jobData.job_name),
            building_address: (value, jobData) => value || '',
            device_id: (value, jobData) => value || extractDeviceId(jobData.job_name),
            related_tickets: (value) => value || ''
        }
    },

    // Summary format for quick reference
    summary: {
        template: `• {{job_name}} ({{building_code}}) - {{device_id}}
  Status: {{job_field_status}} | Time: {{job_start_time_formatted}}-{{job_end_time_formatted}}
  {{job_trouble_description_short}}`,
        transformations: {
            job_trouble_description_short: (value) => value ? (value.length > 50 ? value.substring(0, 47) + '...' : value) : 'No description',
            job_start_time_formatted: (value) => value ? formatTimeShort(value) : '',
            job_end_time_formatted: (value) => value ? formatTimeShort(value) : '',
            building_code: (value, jobData) => value || extractBuildingCode(jobData.job_name),
            device_id: (value, jobData) => value || extractDeviceId(jobData.job_name)
        }
    },

    // JSON format for data interchange
    json: {
        structure: {
            ticket_number: '{{job_number}}',
            job_name: '{{job_name}}',
            building: {
                code: '{{building_code}}',
                address: '{{building_address}}'
            },
            device: {
                id: '{{device_id}}',
                type: '{{device_type}}',
                details: '{{job_device_details}}'
            },
            schedule: {
                date: '{{job_start_date}}',
                start_time: '{{job_start_time}}',
                end_time: '{{job_end_time}}',
                escort_delay: '{{job_escort_delay}}'
            },
            team: {
                participants: '{{job_participants}}'
            },
            dispatch: {
                type: '{{job_dispatch_type}}',
                status: '{{job_field_status}}',
                followup_required: '{{job_followup_required}}'
            },
            materials: {
                used: '{{job_materials_used}}',
                needed: '{{job_materials_needed}}'
            },
            issues: {
                trouble_type: '{{job_trouble_type}}',
                trouble_description: '{{job_trouble_description}}',
                hindrances: '{{job_hindrances}}',
                access_needed: '{{job_access_needed}}',
                programming_changes: '{{job_programming_changes}}'
            },
            resolution: {
                work_description: '{{job_work_description}}',
                technical_details: '{{job_technical_details}}',
                field_notes: '{{job_filed_status_notes}}'
            },
            metadata: {
                created_at: '{{created_at}}',
                updated_at: '{{updated_at}}'
            }
        }
    },

    // CSV format for spreadsheet import
    csv: {
        headers: [
            'Ticket Number',
            'Job Name',
            'Building Code',
            'Building Address',
            'Device ID',
            'Device Type',
            'Start Date',
            'Start Time',
            'End Time',
            'Participants',
            'Dispatch Type',
            'Field Status',
            'Follow-up Required',
            'Trouble Type',
            'Trouble Description',
            'Work Description',
            'Materials Used',
            'Materials Needed',
            'Access Needed',
            'Programming Changes',
            'Hindrances',
            'Technical Details',
            'Field Notes',
            'Reference Number',
            'Escort Delay'
        ],
        fields: [
            '{{job_number}}',
            '{{job_name}}',
            '{{building_code}}',
            '{{building_address}}',
            '{{device_id}}',
            '{{device_type}}',
            '{{job_start_date}}',
            '{{job_start_time}}',
            '{{job_end_time}}',
            '{{job_participants}}',
            '{{job_dispatch_type}}',
            '{{job_field_status}}',
            '{{job_followup_required}}',
            '{{job_trouble_type}}',
            '{{job_trouble_description}}',
            '{{job_work_description}}',
            '{{job_materials_used}}',
            '{{job_materials_needed}}',
            '{{job_access_needed}}',
            '{{job_programming_changes}}',
            '{{job_hindrances}}',
            '{{job_technical_details}}',
            '{{job_filed_status_notes}}',
            '{{job_reference_number}}',
            '{{job_escort_delay}}'
        ],
        transformations: {
            building_code: (value, jobData) => value || extractBuildingCode(jobData.job_name),
            building_address: (value, jobData) => value || '',
            device_id: (value, jobData) => value || extractDeviceId(jobData.job_name),
            job_followup_required: (value) => value ? 'Yes' : 'No'
        }
    }
};

// Mapping engine class
class DataMappingEngine {
    static async enrichJobData(jobData) {
        // Get complete job data with related information
        const enriched = { ...jobData };

        try {
            // Get ticket information
            if (jobData.ticket_id && window.wmsStorage) {
                const ticket = await window.wmsStorage.getTicketById(jobData.ticket_id);
                if (ticket) {
                    enriched.job_number = ticket.ticket_number;

                    // Get building information
                    const building = await window.wmsStorage.getBuildingById(ticket.building_id);
                    if (building) {
                        enriched.building_code = building.building_site_code;
                        enriched.building_address = building.building_address;
                    }

                    // Get device associations
                    const deviceAssocs = await window.wmsStorage.getDevicesForEntry(jobData.entry_id);
                    if (deviceAssocs.length > 0) {
                        const device = await window.wmsStorage.getDeviceById(deviceAssocs[0].device_id);
                        if (device) {
                            enriched.device_id = device.device_name;
                            enriched.device_type = device.device_type;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to enrich job data:', error);
        }

        return enriched;
    }

    static applyTemplate(template, jobData, transformations = {}) {
        let result = template;

        // Apply transformations first
        const transformedData = { ...jobData };
        for (const [field, transformFn] of Object.entries(transformations)) {
            if (transformedData.hasOwnProperty(field)) {
                transformedData[field] = transformFn(transformedData[field], jobData);
            }
        }

        // Replace template variables
        const variableRegex = /\{\{(\w+)\}\}/g;
        result = result.replace(variableRegex, (match, fieldName) => {
            return transformedData[fieldName] || '';
        });

        return result;
    }

    static async exportToFormat(formatName, jobData, multipleJobs = false) {
        const mapping = EXPORT_MAPPINGS[formatName];
        if (!mapping) {
            throw new Error(`Unknown export format: ${formatName}`);
        }

        const enrichedJob = await this.enrichJobData(jobData);

        switch (formatName) {
            case 'clipboard':
                return this.applyTemplate(mapping.template, enrichedJob, mapping.transformations);

            case 'summary':
                return this.applyTemplate(mapping.template, enrichedJob, mapping.transformations);

            case 'json':
                if (multipleJobs) {
                    // For multiple jobs, create an array in the structure
                    return multipleJobs.map(job => this.buildJSONObject(job, mapping.structure)).join('\n---\n');
                } else {
                    return JSON.stringify(this.buildJSONObject(enrichedJob, mapping.structure), null, 2);
                }

            case 'csv':
                if (multipleJobs) {
                    const csvLines = [];
                    csvLines.push(mapping.headers.join(','));

                    for (const job of multipleJobs) {
                        const enriched = await this.enrichJobData(job);
                        const transformed = this.applyTransformations(enriched, mapping.transformations);
                        const row = mapping.fields.map(field => {
                            const value = this.applyTemplate(field, transformed, {});
                            return `"${value.replace(/"/g, '""')}"`; // Escape quotes
                        });
                        csvLines.push(row.join(','));
                    }

                    return csvLines.join('\n');
                } else {
                    const transformed = this.applyTransformations(enrichedJob, mapping.transformations);
                    return mapping.headers.join(',') + '\n' +
                           mapping.fields.map(field => `"${this.applyTemplate(field, transformed, {})}"`).join(',');
                }

            default:
                throw new Error(`Unsupported export format: ${formatName}`);
        }
    }

    static buildJSONObject(jobData, structure) {
        const result = {};

        for (const [key, value] of Object.entries(structure)) {
            if (typeof value === 'string') {
                result[key] = this.applyTemplate(value, jobData, {});
            } else if (typeof value === 'object' && value !== null) {
                result[key] = this.buildJSONObject(jobData, value);
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    static applyTransformations(jobData, transformations) {
        const transformed = { ...jobData };
        for (const [field, transformFn] of Object.entries(transformations)) {
            if (transformed.hasOwnProperty(field)) {
                transformed[field] = transformFn(transformed[field], jobData);
            }
        }
        return transformed;
    }

    // Get available export formats
    static getAvailableFormats() {
        return Object.keys(EXPORT_MAPPINGS);
    }

    // Validate data against format requirements
    static validateForFormat(formatName, jobData) {
        const mapping = EXPORT_MAPPINGS[formatName];
        if (!mapping) return { valid: false, errors: [`Unknown format: ${formatName}`] };

        const errors = [];

        // Format-specific validation
        switch (formatName) {
            case 'clipboard':
            case 'summary':
                if (!jobData.job_name) errors.push('Job name is required');
                if (!jobData.job_work_description) errors.push('Work description is required');
                break;

            case 'csv':
                // CSV can handle missing data
                break;
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Utility functions for data extraction and formatting
function formatTimeForDisplay(timeString) {
    if (!timeString) return '';
    try {
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
        return timeString;
    }
}

function formatTimeShort(timeString) {
    if (!timeString) return '';
    return timeString.substring(0, 5); // HH:MM format
}

function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function extractBuildingCode(jobName) {
    if (!jobName) return '';
    // Extract from patterns like "SEA28", "DWS5", etc.
    const match = jobName.match(/\b([A-Z]{3,}\d*)\b/);
    return match ? match[1] : '';
}

function extractDeviceId(jobName) {
    if (!jobName) return '';
    // Look for patterns at the end like "V1871560970", "P296563983"
    const match = jobName.match(/\b([VP]\d{9,})\b$/);
    return match ? match[1] : '';
}

function extractDeviceIds(jobName) {
    if (!jobName) return [];
    // Extract multiple device IDs
    const matches = jobName.match(/\b([VP]\d{9,})\b/g);
    return matches || [];
}
