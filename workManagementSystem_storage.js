// Work Management System - IndexedDB Storage Layer 🏗️
// Based on PostgreSQL schema: 1 Building → 1 Device → Many Tasks/Errors
// IndexedDB implementation compatible with task_ticket_entries table structure
class WMSStorage {
    constructor() {
        this.dbName = 'WorkManagementDB';
        this.version = 2; // Incremented to force schema update
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Buildings store
                if (!db.objectStoreNames.contains('buildings')) {
                    const buildingsStore = db.createObjectStore('buildings', { keyPath: 'building_id', autoIncrement: true });
                    buildingsStore.createIndex('building_name', 'building_name', { unique: false });
                    buildingsStore.createIndex('building_uuid', 'building_uuid', { unique: true });
                    buildingsStore.createIndex('building_site_code', 'building_site_code', { unique: true });
                }

                // Devices store
                if (!db.objectStoreNames.contains('devices')) {
                    const devicesStore = db.createObjectStore('devices', { keyPath: 'device_id', autoIncrement: true });
                    devicesStore.createIndex('building_id', 'building_id', { unique: false });
                    devicesStore.createIndex('device_name', 'device_name', { unique: false });
                    devicesStore.createIndex('device_uuid', 'device_uuid', { unique: true });
                }

                // Tickets store
                if (!db.objectStoreNames.contains('tickets')) {
                    const ticketsStore = db.createObjectStore('tickets', { keyPath: 'ticket_id', autoIncrement: true });
                    ticketsStore.createIndex('ticket_number', 'ticket_number', { unique: true });
                    ticketsStore.createIndex('building_id', 'building_id', { unique: false });
                    ticketsStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Main ticket entries store (jobs) - updated to match schema
                if (!db.objectStoreNames.contains('task_ticket_entries')) {
                    const entriesStore = db.createObjectStore('task_ticket_entries', { keyPath: 'entry_id', autoIncrement: true });
                    entriesStore.createIndex('ticket_id', 'ticket_id', { unique: false });
                    entriesStore.createIndex('job_start_date', 'job_start_date', { unique: false });
                    entriesStore.createIndex('job_name', 'job_name', { unique: false });
                    entriesStore.createIndex('created_at', 'created_at', { unique: false });
                    entriesStore.createIndex('email_parse_title_validation_status', 'email_parse_title_validation_status', { unique: false });
                }

                // Device associations for entries
                if (!db.objectStoreNames.contains('task_ticket_entry_devices')) {
                    const assocStore = db.createObjectStore('task_ticket_entry_devices', { keyPath: 'id', autoIncrement: true });
                    assocStore.createIndex('task_ticket_entry_id', 'task_ticket_entry_id', { unique: false });
                    assocStore.createIndex('device_id', 'device_id', { unique: false });
                }

                // History store for auditing
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'history_id', autoIncrement: true });
                    historyStore.createIndex('table_name', 'table_name', { unique: false });
                    historyStore.createIndex('record_id', 'record_id', { unique: false });
                    historyStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Import/Export logs
                if (!db.objectStoreNames.contains('import_export_logs')) {
                    const logsStore = db.createObjectStore('import_export_logs', { keyPath: 'log_id', autoIncrement: true });
                    logsStore.createIndex('operation_type', 'operation_type', { unique: false });
                    logsStore.createIndex('created_at', 'created_at', { unique: false });
                }
            };
        });
    }

    // Generic database operation wrapper
    async _performDBOperation(storeName, operation, data = null, key = null) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = operation === 'add' ? store.add(data) :
                       operation === 'put' ? store.put(data) :
                       operation === 'get' ? store.get(key) :
                       operation === 'delete' ? store.delete(key) :
                       operation === 'getAll' ? store.getAll() :
                       operation === 'getAllIndexed' ? store.index(key.index).getAll(key.value) : null;

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Buildings operations
    async saveBuilding(buildingData) {
        const existingBuilding = await this.getBuildingByName(buildingData.building_name);
        if (existingBuilding && (!buildingData.building_id || existingBuilding.building_id !== buildingData.building_id)) {
            throw new Error(`Building with name "${buildingData.building_name}" already exists`);
        }
        const savedId = await this._performDBOperation('buildings', 'put', buildingData);
        // Return the full building object with the assigned ID
        const savedBuilding = { ...buildingData, building_id: savedId };
        return savedBuilding;
    }

    async getAllBuildings() {
        return await this._performDBOperation('buildings', 'getAll');
    }

    async getBuildingById(id) {
        return await this._performDBOperation('buildings', 'get', null, id);
    }

    async getBuildingByName(name) {
        const buildings = await this._performDBOperation('buildings', 'getAllIndexed', null, { index: 'building_name', value: name });
        return buildings.length > 0 ? buildings[0] : null;
    }

    // Devices operations
    async saveDevice(deviceData) {
        // Ensure building exists
        const building = await this.getBuildingById(deviceData.building_id);
        if (!building) {
            throw new Error(`Building with ID ${deviceData.building_id} does not exist`);
        }

        const existingDevice = await this.getDeviceByNameAndBuilding(deviceData.device_name, deviceData.building_id);
        if (existingDevice && (!deviceData.device_id || existingDevice.device_id !== deviceData.device_id)) {
            throw new Error(`Device with name "${deviceData.device_name}" already exists in this building`);
        }

        const savedId = await this._performDBOperation('devices', 'put', deviceData);
        // Return the full device object with the assigned ID
        const savedDevice = { ...deviceData, device_id: savedId };
        return savedDevice;
    }

    async getAllDevices() {
        return await this._performDBOperation('devices', 'getAll');
    }

    async getDeviceById(id) {
        return await this._performDBOperation('devices', 'get', null, id);
    }

    async getDeviceByNameAndBuilding(deviceName, buildingId) {
        const devices = await this._performDBOperation('devices', 'getAllIndexed', null, { index: 'building_id', value: buildingId });
        return devices.find(device => device.device_name === deviceName);
    }

    async getDevicesByBuilding(buildingId) {
        return await this._performDBOperation('devices', 'getAllIndexed', null, { index: 'building_id', value: buildingId });
    }

    // Tickets operations
    async saveTicket(ticketData) {
        const existingTicket = await this.getTicketByNumber(ticketData.ticket_number);
        if (existingTicket && (!ticketData.ticket_id || existingTicket.ticket_id !== ticketData.ticket_id)) {
            throw new Error(`Ticket with number "${ticketData.ticket_number}" already exists`);
        }
        const savedId = await this._performDBOperation('tickets', 'put', ticketData);
        // Return the full ticket object with the assigned ID
        const savedTicket = { ...ticketData, ticket_id: savedId };
        return savedTicket;
    }

    async getAllTickets() {
        return await this._performDBOperation('tickets', 'getAll');
    }

    async getTicketById(id) {
        return await this._performDBOperation('tickets', 'get', null, id);
    }

    async getTicketByNumber(number) {
        const tickets = await this._performDBOperation('tickets', 'getAllIndexed', null, { index: 'ticket_number', value: number });
        return tickets.length > 0 ? tickets[0] : null;
    }

    // Task ticket entries operations (main job data) - updated table names
    async saveTicketEntry(entryData) {
        const ticket = await this.getTicketById(entryData.ticket_id);
        if (!ticket) {
            throw new Error(`Ticket with ID ${entryData.ticket_id} does not exist`);
        }
        return await this._performDBOperation('task_ticket_entries', 'put', entryData);
    }

    async getAllTicketEntries() {
        return await this._performDBOperation('task_ticket_entries', 'getAll');
    }

    async getTicketEntryById(id) {
        return await this._performDBOperation('task_ticket_entries', 'get', null, id);
    }

    async getTicketEntriesByDate(date) {
        return await this._performDBOperation('task_ticket_entries', 'getAllIndexed', null, { index: 'job_start_date', value: date });
    }

    async getTicketEntriesByTicket(ticketId) {
        return await this._performDBOperation('task_ticket_entries', 'getAllIndexed', null, { index: 'ticket_id', value: ticketId });
    }

    async deleteTicketEntry(id) {
        return await this._performDBOperation('task_ticket_entries', 'delete', null, id);
    }

    // Device associations - updated table names
    async associateDeviceWithEntry(entryId, deviceIds) {
        // Remove existing associations
        const transaction = this.db.transaction(['task_ticket_entry_devices'], 'readwrite');
        const store = transaction.objectStore('task_ticket_entry_devices');
        const index = store.index('task_ticket_entry_id');
        const existingAssocs = await new Promise(resolve => {
            const request = index.getAll(entryId);
            request.onsuccess = () => resolve(request.result);
        });

        for (const assoc of existingAssocs) {
            await new Promise(resolve => {
                const request = store.delete(assoc.id);
                request.onsuccess = () => resolve();
            });
        }

        // Add new associations
        for (const deviceId of deviceIds) {
            await new Promise(resolve => {
                const request = store.add({ task_ticket_entry_id: entryId, device_id: deviceId });
                request.onsuccess = () => resolve();
            });
        }
    }

    async getDevicesForEntry(entryId) {
        return await this._performDBOperation('task_ticket_entry_devices', 'getAllIndexed', null, { index: 'task_ticket_entry_id', value: entryId });
    }

    // History logging
    async logHistory(tableName, recordId, action, changes = null) {
        const historyData = {
            table_name: tableName,
            record_id: recordId,
            action: action,
            changes: changes,
            created_at: new Date().toISOString()
        };
        return await this._performDBOperation('history', 'add', historyData);
    }

    // Import/Export logging
    async logImportExport(operationType, fileType, status, details = null) {
        const logData = {
            operation_type: operationType,
            file_type: fileType,
            status: status,
            details: details,
            created_at: new Date().toISOString()
        };
        return await this._performDBOperation('import_export_logs', 'add', logData);
    }

    // Helper: Convert legacy job format to new structure
    async migrateLegacyJob(legacyJobData) {
        // Create or find building
        let building = await this.getBuildingByName(legacyJobData.building_code || 'Default Building');
        if (!building) {
            building = await this.saveBuilding({
                building_name: legacyJobData.building_code || 'Default Building',
                description: legacyJobData.building_address || null
            });
        }

        // Create ticket
        const ticketNumber = legacyJobData.job_number || `AUTO-${Date.now()}`;
        let ticket = await this.getTicketByNumber(ticketNumber);
        if (!ticket) {
            ticket = await this.saveTicket({
                ticket_number: ticketNumber,
                building_id: building.building_id,
                created_at: legacyJobData.created_at || new Date().toISOString()
            });
        }

        // Create device if specified
        let deviceId = null;
        if (legacyJobData.device_id) {
            let device = await this.getDeviceByNameAndBuilding(legacyJobData.device_id, building.building_id);
            if (!device) {
                device = await this.saveDevice({
                    building_id: building.building_id,
                    device_name: legacyJobData.device_id,
                    device_type: legacyJobData.device_type || null,
                    description: legacyJobData.job_device_details || null
                });
            }
            deviceId = device.device_id;
        }

        // Convert legacy fields to ticket_entry format
        const entryData = {
            ticket_id: ticket.ticket_id,
            job_name: legacyJobData.job_name || 'Unnamed Job',
            job_start_date: legacyJobData.job_start_date || new Date().toISOString().split('T')[0],
            job_start_time: legacyJobData.job_start_time || '08:00',
            job_end_time: legacyJobData.job_end_time || '17:00',
            job_participants: legacyJobData.job_participants || legacyJobData.job_with_who || null,
            job_reference_number: legacyJobData.job_reference_number || null,
            job_escort_delay: legacyJobData.job_escort_delay || null,
            job_hindrances: legacyJobData.job_hindrances || null,
            job_materials_used: legacyJobData.job_materials_used || null,
            job_materials_needed: legacyJobData.job_materials_needed || null,
            job_access_needed: legacyJobData.job_access_needed || null,
            job_programming_changes: legacyJobData.job_programming_changes || null,
            job_dispatch_type: legacyJobData.job_dispatch_type || 'Spontaneous',
            job_field_status: legacyJobData.job_field_status || 'pending',
            job_filed_status_notes: legacyJobData.job_filed_status_notes || null,
            job_followup_required: legacyJobData.job_followup_required === 'yes',
            job_device_details: legacyJobData.job_device_details || null,
            job_trouble_type: legacyJobData.job_trouble_type || 'other',
            job_trouble_description: legacyJobData.job_trouble_description || '',
            job_work_description: legacyJobData.job_work_description || '',
            job_technical_details: legacyJobData.job_technical_details || null,
            // Validation fields - default to valid for legacy data (no validation performed)
            email_parse_title_validation_flag: legacyJobData.email_parse_title_validation_flag || {},
            email_parse_title_validation_status: legacyJobData.email_parse_title_validation_status || 'unknown',
            created_at: legacyJobData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const entryId = await this.saveTicketEntry(entryData);

        // Associate device if created
        if (deviceId) {
            await this.associateDeviceWithEntry(entryId, [deviceId]);
        }

        return entryId;
    }

    // Clear all data (for testing/reset)
    async clearAllData() {
        const stores = ['buildings', 'devices', 'tickets', 'task_ticket_entries', 'task_ticket_entry_devices', 'history', 'import_export_logs'];
        for (const storeName of stores) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await new Promise(resolve => {
                const request = store.clear();
                request.onsuccess = () => resolve();
            });
        }
    }
}
