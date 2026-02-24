"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareProviders = exports.getROIMetrics = exports.getAISessions = exports.getAIStats = exports.getProviders = void 0;
const db_js_1 = require("../utils/db.js");
const getProviders = async (_req, res) => {
    try {
        const result = await (0, db_js_1.query)('SELECT * FROM ai_providers WHERE is_active = true ORDER BY name');
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getProviders = getProviders;
const getAIStats = async (req, res) => {
    try {
        const hotelId = req.user?.hotel_id;
        const { period = '30' } = req.query;
        const result = await (0, db_js_1.query)(`SELECT 
        ap.name as provider,
        ap.slug as provider_slug,
        COUNT(s.id) as sessions,
        SUM(s.tokens_in) as total_tokens_in,
        SUM(s.tokens_out) as total_tokens_out,
        SUM(s.cost) as total_cost,
        SUM(CASE WHEN s.converted THEN 1 ELSE 0 END) as conversions,
        SUM(s.conversion_value) as conversion_revenue,
        ROUND(AVG(s.guest_rating), 2) as avg_rating
       FROM ai_sessions s
       JOIN ai_providers ap ON s.provider_id = ap.id
       WHERE s.hotel_id = $1 AND s.created_at > NOW() - INTERVAL '${Number(period)} days'
       GROUP BY ap.id
       ORDER BY total_cost DESC`, [hotelId]);
        // Calculate ROI per provider
        const stats = result.rows.map(row => ({
            ...row,
            roi: row.total_cost > 0
                ? ((row.conversion_revenue - row.total_cost) / row.total_cost * 100).toFixed(2)
                : 0,
            conversion_rate: row.sessions > 0
                ? (row.conversions / row.sessions * 100).toFixed(2)
                : 0
        }));
        res.json(stats);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getAIStats = getAIStats;
const getAISessions = async (req, res) => {
    try {
        const { limit = 50, offset = 0, provider } = req.query;
        const hotelId = req.user?.hotel_id;
        let sql = `
      SELECT s.*, ap.name as provider_name, ap.slug as provider_slug
      FROM ai_sessions s
      JOIN ai_providers ap ON s.provider_id = ap.id
      WHERE s.hotel_id = $1
    `;
        const params = [hotelId];
        if (provider) {
            sql += ' AND ap.slug = $2';
            params.push(provider);
        }
        sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Number(limit), Number(offset));
        const result = await (0, db_js_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getAISessions = getAISessions;
const getROIMetrics = async (req, res) => {
    try {
        const hotelId = req.user?.hotel_id;
        // Get licence cost
        const licenceResult = await (0, db_js_1.query)('SELECT monthly_fee FROM licences WHERE hotel_id = $1', [hotelId]);
        const monthlyFee = licenceResult.rows[0]?.monthly_fee || 0;
        // Get AI costs
        const aiResult = await (0, db_js_1.query)(`SELECT COALESCE(SUM(cost), 0) as ai_cost
       FROM ai_sessions 
       WHERE hotel_id = $1 AND created_at > NOW() - INTERVAL '30 days'`, [hotelId]);
        const aiCost = parseFloat(aiResult.rows[0].ai_cost);
        // Get direct bookings revenue (that would have been OTA)
        const directResult = await (0, db_js_1.query)(`SELECT 
        COUNT(*) as direct_bookings,
        COALESCE(SUM(total_revenue), 0) as direct_revenue
       FROM bookings b
       JOIN channels c ON b.channel_id = c.id
       WHERE b.hotel_id = $1 
         AND c.slug = 'direct'
         AND b.ai_assisted = true
         AND b.created_at > NOW() - INTERVAL '30 days'`, [hotelId]);
        const directRevenue = parseFloat(directResult.rows[0].direct_revenue);
        const avgOTACommission = 0.15; // 15% average
        const commissionSaved = directRevenue * avgOTACommission;
        const totalEywaCost = monthlyFee + aiCost;
        const netGain = commissionSaved - totalEywaCost;
        const roi = totalEywaCost > 0 ? (netGain / totalEywaCost * 100) : 0;
        res.json({
            period: 'last_30_days',
            eywa_cost: {
                licence: monthlyFee,
                ai: aiCost,
                total: totalEywaCost
            },
            direct_bookings: parseInt(directResult.rows[0].direct_bookings),
            direct_revenue: directRevenue,
            commission_saved: commissionSaved,
            net_gain: netGain,
            roi_percentage: roi.toFixed(2)
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getROIMetrics = getROIMetrics;
const compareProviders = async (req, res) => {
    try {
        const hotelId = req.user?.hotel_id;
        const result = await (0, db_js_1.query)(`SELECT 
        ap.name,
        ap.slug,
        COUNT(s.id) as total_sessions,
        SUM(CASE WHEN s.converted THEN 1 ELSE 0 END) as conversions,
        ROUND(SUM(CASE WHEN s.converted THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(s.id), 0) * 100, 2) as conversion_rate,
        SUM(s.cost) as total_cost,
        SUM(s.conversion_value) as total_revenue,
        ROUND(SUM(s.conversion_value) / NULLIF(SUM(s.cost), 0), 2) as revenue_per_dollar,
        ROUND(AVG(s.guest_rating), 2) as avg_rating
       FROM ai_providers ap
       LEFT JOIN ai_sessions s ON ap.id = s.provider_id AND s.hotel_id = $1 AND s.created_at > NOW() - INTERVAL '30 days'
       WHERE ap.is_active = true
       GROUP BY ap.id
       ORDER BY conversion_rate DESC NULLS LAST`, [hotelId]);
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.compareProviders = compareProviders;
