"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookingStats = exports.getChannels = exports.getBooking = exports.listBookings = void 0;
const db_js_1 = require("../utils/db.js");
const listBookings = async (req, res) => {
    try {
        const { limit = 50, offset = 0, channel, status, from, to } = req.query;
        const hotelId = req.user?.hotel_id;
        let sql = `
      SELECT b.*, c.name as channel_name, c.slug as channel_slug
      FROM bookings b
      LEFT JOIN channels c ON b.channel_id = c.id
      WHERE b.hotel_id = $1
    `;
        const params = [hotelId];
        let paramIndex = 2;
        if (channel) {
            sql += ` AND c.slug = $${paramIndex++}`;
            params.push(channel);
        }
        if (status) {
            sql += ` AND b.booking_status = $${paramIndex++}`;
            params.push(status);
        }
        if (from) {
            sql += ` AND b.check_in >= $${paramIndex++}`;
            params.push(from);
        }
        if (to) {
            sql += ` AND b.check_out <= $${paramIndex++}`;
            params.push(to);
        }
        sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(Number(limit), Number(offset));
        const result = await (0, db_js_1.query)(sql, params);
        // Get total count
        const countResult = await (0, db_js_1.query)('SELECT COUNT(*) FROM bookings WHERE hotel_id = $1', [hotelId]);
        res.json({
            data: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: Number(limit),
            offset: Number(offset)
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.listBookings = listBookings;
const getBooking = async (req, res) => {
    try {
        const result = await (0, db_js_1.query)(`SELECT b.*, c.name as channel_name, c.slug as channel_slug,
              a.id as ai_session_id, ap.name as ai_provider
       FROM bookings b
       LEFT JOIN channels c ON b.channel_id = c.id
       LEFT JOIN ai_sessions a ON b.ai_session_id = a.id
       LEFT JOIN ai_providers ap ON a.provider_id = ap.id
       WHERE b.id = $1 AND b.hotel_id = $2`, [req.params.id, req.user?.hotel_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getBooking = getBooking;
const getChannels = async (_req, res) => {
    try {
        const result = await (0, db_js_1.query)('SELECT * FROM channels WHERE is_active = true ORDER BY name');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getChannels = getChannels;
const getBookingStats = async (req, res) => {
    try {
        const hotelId = req.user?.hotel_id;
        const { period = '30' } = req.query;
        const result = await (0, db_js_1.query)(`SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_bookings,
        SUM(total_revenue) as revenue,
        SUM(net_revenue) as net_revenue,
        SUM(commission_paid) as commissions,
        AVG(total_revenue / room_nights) as adr
       FROM bookings 
       WHERE hotel_id = $1 AND created_at > NOW() - INTERVAL '${Number(period)} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`, [hotelId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getBookingStats = getBookingStats;
