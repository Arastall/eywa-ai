"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Eywa AI - PMS Gateway Routes
const express_1 = require("express");
const pms_router_1 = require("../services/pms-router");
const telegram_commands_1 = require("../services/telegram-commands");
const router = (0, express_1.Router)();
// List all supported PMS
router.get('/pms/list', (req, res) => {
    res.json({
        success: true,
        count: pms_router_1.PMS_LIST.length,
        coverage: '~90%',
        pms: pms_router_1.PMS_LIST
    });
});
// Test PMS connection
router.post('/pms/test', async (req, res) => {
    try {
        const { pmsType, credentials } = req.body;
        if (!pmsType || !credentials) {
            return res.status(400).json({
                success: false,
                error: 'Missing pmsType or credentials'
            });
        }
        const result = await pms_router_1.pmsRouter.testConnection(pmsType, credentials);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Connect a PMS
router.post('/pms/connect', async (req, res) => {
    try {
        const { hotelId, pmsType, credentials, environment = 'sandbox' } = req.body;
        if (!hotelId || !pmsType || !credentials) {
            return res.status(400).json({
                success: false,
                error: 'Missing hotelId, pmsType, or credentials'
            });
        }
        // Test connection first
        const testResult = await pms_router_1.pmsRouter.testConnection(pmsType, credentials);
        if (!testResult.success) {
            return res.status(400).json(testResult);
        }
        // Register connection
        pms_router_1.pmsRouter.registerConnection({
            id: `conn_${Date.now()}`,
            hotelId,
            pmsType: pmsType,
            credentials,
            environment,
            isActive: true,
            createdAt: new Date()
        });
        res.json({
            success: true,
            message: `Connected ${hotelId} to ${pmsType}`,
            hotel: testResult.data
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Get connection status
router.get('/pms/status', (req, res) => {
    const connections = pms_router_1.pmsRouter.listConnections();
    res.json({
        success: true,
        count: connections.length,
        connections: connections.map(c => ({
            hotelId: c.hotelId,
            pmsType: c.pmsType,
            environment: c.environment,
            isActive: c.isActive,
            createdAt: c.createdAt,
            lastSyncAt: c.lastSyncAt
        }))
    });
});
// Get hotel configuration
router.get('/pms/:hotelId/config', async (req, res) => {
    try {
        const config = await pms_router_1.pmsRouter.getConfiguration(req.params.hotelId);
        res.json({ success: true, data: config });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get availability
router.get('/pms/:hotelId/availability', async (req, res) => {
    try {
        const { startDate, endDate, roomTypeId } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing startDate or endDate'
            });
        }
        const availability = await pms_router_1.pmsRouter.getAvailability(req.params.hotelId, {
            startDate: startDate,
            endDate: endDate,
            roomTypeId: roomTypeId
        });
        res.json({ success: true, count: availability.length, data: availability });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get reservations
router.get('/pms/:hotelId/reservations', async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const reservations = await pms_router_1.pmsRouter.getReservations(req.params.hotelId, {
            startDate: startDate,
            endDate: endDate,
            status: status
        });
        res.json({ success: true, count: reservations.length, data: reservations });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get room types
router.get('/pms/:hotelId/rooms', async (req, res) => {
    try {
        const roomTypes = await pms_router_1.pmsRouter.getRoomTypes(req.params.hotelId);
        res.json({ success: true, count: roomTypes.length, data: roomTypes });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get rates
router.get('/pms/:hotelId/rates', async (req, res) => {
    try {
        const rates = await pms_router_1.pmsRouter.getRates(req.params.hotelId);
        res.json({ success: true, count: rates.length, data: rates });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Telegram webhook / command handler
router.post('/pms/telegram', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'Missing message' });
        }
        const parsed = (0, telegram_commands_1.parseCommand)(message);
        if (!parsed) {
            return res.json({ success: true, response: null }); // Not an /eywa command
        }
        const response = await (0, telegram_commands_1.executeCommand)(parsed.command, parsed.args);
        res.json({ success: true, response });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
