"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../utils/db.js");
const register = async (req, res) => {
    try {
        const { email, password, first_name, last_name, hotel_name, hotel_slug } = req.body;
        // Check if user exists
        const existing = await (0, db_js_1.query)('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Create hotel first
        const hotelResult = await (0, db_js_1.query)(`INSERT INTO hotels (name, slug) VALUES ($1, $2) RETURNING id`, [hotel_name, hotel_slug || hotel_name.toLowerCase().replace(/\s+/g, '-')]);
        const hotel_id = hotelResult.rows[0].id;
        // Create licence (trial)
        await (0, db_js_1.query)(`INSERT INTO licences (hotel_id, plan, status, start_date, trial_ends_at) 
       VALUES ($1, 'starter', 'trial', NOW(), NOW() + INTERVAL '14 days')`, [hotel_id]);
        // Hash password and create user
        const password_hash = await bcryptjs_1.default.hash(password, 10);
        const userResult = await (0, db_js_1.query)(`INSERT INTO users (hotel_id, email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5, 'admin') RETURNING id, email, role`, [hotel_id, email, password_hash, first_name, last_name]);
        const user = userResult.rows[0];
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, hotel_id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, role: user.role },
            hotel: { id: hotel_id, name: hotel_name }
        });
    }
    catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await (0, db_js_1.query)(`SELECT u.id, u.email, u.password_hash, u.hotel_id, u.role, u.first_name, u.last_name,
              h.name as hotel_name, h.slug as hotel_slug
       FROM users u
       JOIN hotels h ON u.hotel_id = h.id
       WHERE u.email = $1 AND u.is_active = true`, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Update last login
        await (0, db_js_1.query)('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, hotel_id: user.hotel_id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                first_name: user.first_name,
                last_name: user.last_name
            },
            hotel: {
                id: user.hotel_id,
                name: user.hotel_name,
                slug: user.hotel_slug
            }
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.login = login;
const me = async (req, res) => {
    try {
        const result = await (0, db_js_1.query)(`SELECT u.id, u.email, u.role, u.first_name, u.last_name,
              h.id as hotel_id, h.name as hotel_name, h.slug as hotel_slug,
              l.plan, l.status as licence_status, l.trial_ends_at
       FROM users u
       JOIN hotels h ON u.hotel_id = h.id
       LEFT JOIN licences l ON h.id = l.hotel_id
       WHERE u.id = $1`, [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.me = me;
