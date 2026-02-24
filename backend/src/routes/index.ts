import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

// Controllers
import * as auth from '../controllers/auth.js';
import * as hotels from '../controllers/hotels.js';
import * as bookings from '../controllers/bookings.js';
import * as pms from '../controllers/pms.js';
import * as ai from '../controllers/ai.js';

// PMS Gateway
import pmsGateway from './pms';

const router = Router();

// Health check
router.get('/health', (_, res) => res.json({ status: 'ok', service: 'eywa-api' }));

// Auth routes (public)
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', authenticate, auth.me);

// Hotel routes (protected)
router.get('/hotel', authenticate, hotels.getHotel);
router.patch('/hotel', authenticate, hotels.updateHotel);
router.get('/hotel/stats', authenticate, hotels.getHotelStats);

// Bookings routes
router.get('/bookings', authenticate, bookings.listBookings);
router.get('/bookings/stats', authenticate, bookings.getBookingStats);
router.get('/bookings/:id', authenticate, bookings.getBooking);
router.get('/channels', authenticate, bookings.getChannels);

// PMS routes
router.get('/pms/types', authenticate, pms.getPMSTypes);
router.get('/pms/connection', authenticate, pms.getConnection);
router.post('/pms/connect', authenticate, pms.connectPMS);
router.post('/pms/test', authenticate, pms.testEndpoint);
router.get('/pms/logs', authenticate, pms.getApiLogs);

// AI routes
router.get('/ai/providers', authenticate, ai.getProviders);
router.get('/ai/stats', authenticate, ai.getAIStats);
router.get('/ai/sessions', authenticate, ai.getAISessions);
router.get('/ai/roi', authenticate, ai.getROIMetrics);
router.get('/ai/compare', authenticate, ai.compareProviders);

// PMS Gateway routes (public for testing)
router.use(pmsGateway);

export default router;
