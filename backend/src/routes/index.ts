import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

// Controllers
import * as auth from '../controllers/auth.js';
import * as hotels from '../controllers/hotels.js';
import * as bookings from '../controllers/bookings.js';
import * as pms from '../controllers/pms.js';
import * as ai from '../controllers/ai.js';
import * as reviews from '../controllers/reviews.js';
import * as analytics from '../controllers/analytics.js';
import * as admin from '../controllers/admin.js';

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

// Reviews & Ratings routes
router.get('/hotels/:id/ratings', authenticate, reviews.getRatings);
router.get('/hotels/:id/reviews', authenticate, reviews.getReviews);
router.post('/hotels/:id/link-reviews', authenticate, reviews.linkReviewSources);
router.post('/hotels/:id/refresh-ratings', authenticate, reviews.refreshRatings);
router.get('/hotels/:id/review-sources', authenticate, reviews.getReviewSources);
router.post('/hotels/:id/search-places', authenticate, reviews.searchPlaces);
router.get('/hotels/:id/competitors', authenticate, reviews.getCompetitors);

// Analytics routes
router.get('/hotels/:id/analytics/summary', authenticate, analytics.getSummary);
router.get('/hotels/:id/analytics/timeline', authenticate, analytics.getTimeline);
router.get('/hotels/:id/analytics/review-sentiment', authenticate, analytics.getReviewSentiment);
router.get('/hotels/:id/analytics/alerts', authenticate, analytics.getAlerts);
router.get('/hotels/:id/competitors', authenticate, analytics.getCompetitors);
router.get('/hotels/:id/market-position', authenticate, analytics.getMarketPosition);

// Portfolio routes (aggregated stats)
router.get('/portfolio/stats', authenticate, analytics.getPortfolioStats);
router.get('/portfolio/trends', authenticate, analytics.getPortfolioTrends);

// Sync status and auto-link routes
router.get('/hotels/:id/sync-status', authenticate, admin.getHotelSyncStatus);
router.post('/hotels/:id/auto-link', authenticate, admin.autoLinkHotel);

// Admin routes (require admin role)
router.post('/admin/sync/trigger', authenticate, requireRole('admin'), admin.triggerBulkSync);
router.post('/admin/sync/hotels', authenticate, requireRole('admin'), admin.syncSpecificHotels);
router.get('/admin/sync/jobs', authenticate, requireRole('admin'), admin.getSyncJobs);
router.get('/admin/sync/jobs/:id/errors', authenticate, requireRole('admin'), admin.getSyncJobErrors);
router.get('/admin/sync/pending', authenticate, requireRole('admin'), admin.getPendingSyncHotels);
router.get('/admin/scheduler/status', authenticate, requireRole('admin'), admin.getSchedulerStatus);
router.post('/admin/hotels/auto-link-batch', authenticate, requireRole('admin'), admin.autoLinkHotelsBatch);

// PMS Gateway routes (public for testing)
router.use(pmsGateway);

export default router;
