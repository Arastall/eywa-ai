"use strict";
// Eywa AI - PMS Router Service
// Routes requests to the correct PMS adapter based on hotel config
Object.defineProperty(exports, "__esModule", { value: true });
exports.PMS_LIST = exports.pmsRouter = exports.PMSRouter = void 0;
exports.createAdapter = createAdapter;
// Stub adapters for now - will connect to real ones when credentials are provided
class StubAdapter {
    name;
    config;
    constructor(name, config) {
        this.name = name;
        this.config = config;
    }
    async authenticate() {
        return 'stub_token';
    }
    async getConfiguration() {
        return {
            id: this.config.hotelId || this.config.propertyId || 'stub_hotel',
            name: `${this.name} Hotel (Stub)`,
            timezone: 'UTC',
            currency: 'USD'
        };
    }
    async getAvailability(params) {
        return [{
                date: params.startDate,
                roomTypeId: 'room_1',
                available: 5,
                rate: 150
            }];
    }
    async getReservations() {
        return [{
                id: 'res_stub_1',
                guestName: 'Test Guest',
                roomTypeId: 'room_1',
                checkIn: '2024-03-01',
                checkOut: '2024-03-03',
                status: 'confirmed',
                totalAmount: 300,
                currency: 'USD'
            }];
    }
    async getRoomTypes() {
        return [{
                id: 'room_1',
                name: 'Standard Room',
                capacity: 2,
                description: 'Stub room type'
            }];
    }
    async getRates() {
        return [{
                id: 'rate_1',
                name: 'Best Available Rate',
                roomTypeId: 'room_1',
                price: 150,
                currency: 'USD'
            }];
    }
}
// Adapter factory - uses StubAdapter for testing, will integrate real adapters with credentials
function createAdapter(pmsType, credentials) {
    const pmsInfo = exports.PMS_LIST.find(p => p.type === pmsType);
    const name = pmsInfo?.name || pmsType;
    // For now, return stub adapter - real adapters will be integrated when credentials are available
    // TODO: Import and use real adapters from ../../../src/adapters/
    return new StubAdapter(name, credentials);
}
// PMS Router - main service class
class PMSRouter {
    connections = new Map();
    adapterCache = new Map();
    // Register a hotel's PMS connection
    registerConnection(connection) {
        this.connections.set(connection.hotelId, connection);
        // Clear cached adapter if exists
        this.adapterCache.delete(connection.hotelId);
    }
    // Get adapter for a hotel
    getAdapter(hotelId) {
        // Check cache first
        const cached = this.adapterCache.get(hotelId);
        if (cached)
            return cached;
        // Get connection
        const connection = this.connections.get(hotelId);
        if (!connection) {
            throw new Error(`No PMS connection found for hotel: ${hotelId}`);
        }
        if (!connection.isActive) {
            throw new Error(`PMS connection is inactive for hotel: ${hotelId}`);
        }
        // Create and cache adapter
        const adapter = createAdapter(connection.pmsType, connection.credentials);
        this.adapterCache.set(hotelId, adapter);
        return adapter;
    }
    // Get connection info
    getConnection(hotelId) {
        return this.connections.get(hotelId);
    }
    // List all connections
    listConnections() {
        return Array.from(this.connections.values());
    }
    // Remove connection
    removeConnection(hotelId) {
        this.adapterCache.delete(hotelId);
        return this.connections.delete(hotelId);
    }
    // === Unified API methods ===
    async getConfiguration(hotelId) {
        const adapter = this.getAdapter(hotelId);
        return adapter.getConfiguration();
    }
    async getAvailability(hotelId, params) {
        const adapter = this.getAdapter(hotelId);
        return adapter.getAvailability(params);
    }
    async getReservations(hotelId, params) {
        const adapter = this.getAdapter(hotelId);
        return adapter.getReservations(params);
    }
    async getRoomTypes(hotelId) {
        const adapter = this.getAdapter(hotelId);
        return adapter.getRoomTypes();
    }
    async getRates(hotelId) {
        const adapter = this.getAdapter(hotelId);
        return adapter.getRates();
    }
    // Test connection
    async testConnection(pmsType, credentials) {
        try {
            const adapter = createAdapter(pmsType, credentials);
            await adapter.authenticate();
            const config = await adapter.getConfiguration();
            return {
                success: true,
                message: `Connected to ${config.name}`,
                data: config
            };
        }
        catch (error) {
            return {
                success: false,
                message: error.message || 'Connection failed'
            };
        }
    }
}
exports.PMSRouter = PMSRouter;
// Singleton instance
exports.pmsRouter = new PMSRouter();
// Available PMS list with info
exports.PMS_LIST = [
    { type: 'mews', name: 'Mews', authType: 'token', region: 'Global' },
    { type: 'cloudbeds', name: 'Cloudbeds', authType: 'oauth2', region: 'Americas' },
    { type: 'apaleo', name: 'Apaleo', authType: 'oauth2', region: 'Europe' },
    { type: 'opera', name: 'Opera Cloud', authType: 'oauth2', region: 'Global' },
    { type: 'protel', name: 'Protel', authType: 'apikey', region: 'Europe' },
    { type: 'guestline', name: 'Guestline', authType: 'apikey', region: 'UK' },
    { type: 'roomraccoon', name: 'RoomRaccoon', authType: 'apikey', region: 'Europe' },
    { type: 'clockpms', name: 'Clock PMS', authType: 'apikey', region: 'Eastern Europe' },
    { type: 'hotelogix', name: 'Hotelogix', authType: 'apikey', region: 'Asia' },
    { type: 'ezee', name: 'eZee', authType: 'apikey', region: 'Asia' },
    { type: 'littlehotelier', name: 'Little Hotelier', authType: 'apikey', region: 'APAC' },
    { type: 'stayntouch', name: 'StayNTouch', authType: 'oauth2', region: 'US' },
    { type: 'webrezpro', name: 'WebRezPro', authType: 'apikey', region: 'US' },
    { type: 'inforhms', name: 'Infor HMS', authType: 'oauth2', region: 'Global' },
    { type: 'hostaway', name: 'Hostaway', authType: 'oauth2', region: 'Global' },
    { type: 'beds24', name: 'Beds24', authType: 'apikey', region: 'Global' },
    { type: 'guesty', name: 'Guesty', authType: 'oauth2', region: 'Global' },
];
