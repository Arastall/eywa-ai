"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiLogs = exports.testEndpoint = exports.connectPMS = exports.getConnection = exports.getPMSTypes = void 0;
const db_js_1 = require("../utils/db.js");
// Supported PMS types and their endpoints
const PMS_ENDPOINTS = {
    mews: {
        name: 'Mews',
        sandbox: 'https://api.mews-demo.com',
        production: 'https://api.mews.com',
        endpoints: [
            { method: 'POST', path: '/api/connector/v1/configuration/get', name: 'Get Configuration' },
            { method: 'POST', path: '/api/connector/v1/services/getAll', name: 'Get Services' },
            { method: 'POST', path: '/api/connector/v1/resources/getAll', name: 'Get Resources (Rooms)' },
            { method: 'POST', path: '/api/connector/v1/reservations/getAll', name: 'Get Reservations' },
            { method: 'POST', path: '/api/connector/v1/rates/getAll', name: 'Get Rates' },
            { method: 'POST', path: '/api/connector/v1/customers/getAll', name: 'Get Customers' },
        ]
    },
    cloudbeds: {
        name: 'Cloudbeds',
        sandbox: 'https://api.cloudbeds.com/api/v1.2',
        production: 'https://api.cloudbeds.com/api/v1.2',
        endpoints: [
            { method: 'GET', path: '/getHotelDetails', name: 'Get Hotel Details' },
            { method: 'GET', path: '/getRooms', name: 'Get Rooms' },
            { method: 'GET', path: '/getReservations', name: 'Get Reservations' },
            { method: 'GET', path: '/getRates', name: 'Get Rates' },
        ]
    },
    opera: {
        name: 'Oracle Opera Cloud',
        sandbox: 'https://sandbox.opera-cloud.com',
        production: 'https://api.opera-cloud.com',
        endpoints: [
            { method: 'GET', path: '/v1/hotels/{hotelId}', name: 'Get Hotel' },
            { method: 'GET', path: '/v1/hotels/{hotelId}/rooms', name: 'Get Rooms' },
            { method: 'GET', path: '/v1/hotels/{hotelId}/reservations', name: 'Get Reservations' },
        ]
    }
};
const getPMSTypes = async (_req, res) => {
    res.json(Object.entries(PMS_ENDPOINTS).map(([slug, data]) => ({
        slug,
        name: data.name,
        endpoints: data.endpoints
    })));
};
exports.getPMSTypes = getPMSTypes;
const getConnection = async (req, res) => {
    try {
        const result = await (0, db_js_1.query)(`SELECT id, pms_type, environment, endpoint_url, last_sync_at, sync_status, sync_error, is_active, created_at
       FROM pms_connections
       WHERE hotel_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`, [req.user?.hotel_id]);
        if (result.rows.length === 0) {
            return res.json({ connected: false });
        }
        const conn = result.rows[0];
        res.json({
            connected: true,
            ...conn,
            pms_info: PMS_ENDPOINTS[conn.pms_type] || null
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getConnection = getConnection;
const connectPMS = async (req, res) => {
    try {
        const { pms_type, environment, client_token, access_token } = req.body;
        const hotelId = req.user?.hotel_id;
        if (!PMS_ENDPOINTS[pms_type]) {
            return res.status(400).json({ error: 'Unsupported PMS type' });
        }
        // Deactivate existing connections
        await (0, db_js_1.query)('UPDATE pms_connections SET is_active = false WHERE hotel_id = $1', [hotelId]);
        const endpoint_url = environment === 'sandbox'
            ? PMS_ENDPOINTS[pms_type].sandbox
            : PMS_ENDPOINTS[pms_type].production;
        const result = await (0, db_js_1.query)(`INSERT INTO pms_connections (hotel_id, pms_type, environment, endpoint_url, client_token, access_token, sync_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`, [hotelId, pms_type, environment, endpoint_url, client_token, access_token]);
        // Update hotel pms_type
        await (0, db_js_1.query)('UPDATE hotels SET pms_type = $1 WHERE id = $2', [pms_type, hotelId]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.connectPMS = connectPMS;
const testEndpoint = async (req, res) => {
    try {
        const { endpoint, method, body } = req.body;
        const hotelId = req.user?.hotel_id;
        // Get connection
        const connResult = await (0, db_js_1.query)('SELECT * FROM pms_connections WHERE hotel_id = $1 AND is_active = true LIMIT 1', [hotelId]);
        if (connResult.rows.length === 0) {
            return res.status(400).json({ error: 'No PMS connection configured' });
        }
        const conn = connResult.rows[0];
        const url = conn.endpoint_url + endpoint;
        const startTime = Date.now();
        // Make the actual API call
        const fetchOptions = {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };
        // Add auth based on PMS type
        if (conn.pms_type === 'mews') {
            fetchOptions.body = JSON.stringify({
                ClientToken: conn.client_token,
                AccessToken: conn.access_token,
                Client: 'EYWA AI',
                ...body
            });
        }
        else {
            fetchOptions.headers = {
                ...fetchOptions.headers,
                'Authorization': `Bearer ${conn.access_token}`
            };
            if (body)
                fetchOptions.body = JSON.stringify(body);
        }
        const response = await fetch(url, fetchOptions);
        const latency = Date.now() - startTime;
        const responseData = await response.json();
        // Log the API call
        await (0, db_js_1.query)(`INSERT INTO api_logs (hotel_id, user_id, endpoint, method, request_body, response_code, response_body, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [hotelId, req.user?.id, endpoint, method, body, response.status, responseData, latency]);
        res.json({
            success: response.ok,
            status: response.status,
            latency_ms: latency,
            data: responseData
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.testEndpoint = testEndpoint;
const getApiLogs = async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const result = await (0, db_js_1.query)(`SELECT id, endpoint, method, response_code, latency_ms, created_at
       FROM api_logs
       WHERE hotel_id = $1
       ORDER BY created_at DESC
       LIMIT $2`, [req.user?.hotel_id, Number(limit)]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getApiLogs = getApiLogs;
