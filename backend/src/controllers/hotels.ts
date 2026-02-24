import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { query } from '../utils/db.js';

export const getHotel = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT h.*, l.plan, l.status as licence_status, l.monthly_fee, l.trial_ends_at
       FROM hotels h
       LEFT JOIN licences l ON h.id = l.hotel_id
       WHERE h.id = $1`,
      [req.user?.hotel_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateHotel = async (req: AuthRequest, res: Response) => {
  try {
    const { name, country, city, address, rooms_count, timezone, currency } = req.body;

    const result = await query(
      `UPDATE hotels 
       SET name = COALESCE($1, name),
           country = COALESCE($2, country),
           city = COALESCE($3, city),
           address = COALESCE($4, address),
           rooms_count = COALESCE($5, rooms_count),
           timezone = COALESCE($6, timezone),
           currency = COALESCE($7, currency),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, country, city, address, rooms_count, timezone, currency, req.user?.hotel_id]
    );

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getHotelStats = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotel_id;

    // Get various stats
    const [bookings, revenue, aiSessions, channels] = await Promise.all([
      query(
        `SELECT COUNT(*) as total, 
                SUM(CASE WHEN channel_id IN (SELECT id FROM channels WHERE slug = 'direct') THEN 1 ELSE 0 END) as direct,
                SUM(CASE WHEN ai_assisted THEN 1 ELSE 0 END) as ai_assisted
         FROM bookings WHERE hotel_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [hotelId]
      ),
      query(
        `SELECT COALESCE(SUM(total_revenue), 0) as total,
                COALESCE(SUM(net_revenue), 0) as net,
                COALESCE(SUM(commission_paid), 0) as commissions
         FROM bookings WHERE hotel_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [hotelId]
      ),
      query(
        `SELECT COUNT(*) as total,
                COALESCE(SUM(cost), 0) as total_cost,
                SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions
         FROM ai_sessions WHERE hotel_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [hotelId]
      ),
      query(
        `SELECT c.name, c.slug, COUNT(b.id) as bookings, COALESCE(SUM(b.total_revenue), 0) as revenue
         FROM channels c
         LEFT JOIN bookings b ON c.id = b.channel_id AND b.hotel_id = $1 AND b.created_at > NOW() - INTERVAL '30 days'
         GROUP BY c.id ORDER BY revenue DESC`,
        [hotelId]
      )
    ]);

    res.json({
      period: 'last_30_days',
      bookings: bookings.rows[0],
      revenue: revenue.rows[0],
      ai: aiSessions.rows[0],
      channels: channels.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
