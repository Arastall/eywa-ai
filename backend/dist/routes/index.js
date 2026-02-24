"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
// Controllers
const auth = __importStar(require("../controllers/auth.js"));
const hotels = __importStar(require("../controllers/hotels.js"));
const bookings = __importStar(require("../controllers/bookings.js"));
const pms = __importStar(require("../controllers/pms.js"));
const ai = __importStar(require("../controllers/ai.js"));
const reviews = __importStar(require("../controllers/reviews.js"));
const analytics = __importStar(require("../controllers/analytics.js"));
const admin = __importStar(require("../controllers/admin.js"));
// PMS Gateway
const pms_1 = __importDefault(require("./pms"));
const router = (0, express_1.Router)();
// Health check
router.get('/health', (_, res) => res.json({ status: 'ok', service: 'eywa-api' }));
// Auth routes (public)
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', auth_js_1.authenticate, auth.me);
// Hotel routes (protected)
router.get('/hotel', auth_js_1.authenticate, hotels.getHotel);
router.patch('/hotel', auth_js_1.authenticate, hotels.updateHotel);
router.get('/hotel/stats', auth_js_1.authenticate, hotels.getHotelStats);
// Bookings routes
router.get('/bookings', auth_js_1.authenticate, bookings.listBookings);
router.get('/bookings/stats', auth_js_1.authenticate, bookings.getBookingStats);
router.get('/bookings/:id', auth_js_1.authenticate, bookings.getBooking);
router.get('/channels', auth_js_1.authenticate, bookings.getChannels);
// PMS routes
router.get('/pms/types', auth_js_1.authenticate, pms.getPMSTypes);
router.get('/pms/connection', auth_js_1.authenticate, pms.getConnection);
router.post('/pms/connect', auth_js_1.authenticate, pms.connectPMS);
router.post('/pms/test', auth_js_1.authenticate, pms.testEndpoint);
router.get('/pms/logs', auth_js_1.authenticate, pms.getApiLogs);
// AI routes
router.get('/ai/providers', auth_js_1.authenticate, ai.getProviders);
router.get('/ai/stats', auth_js_1.authenticate, ai.getAIStats);
router.get('/ai/sessions', auth_js_1.authenticate, ai.getAISessions);
router.get('/ai/roi', auth_js_1.authenticate, ai.getROIMetrics);
router.get('/ai/compare', auth_js_1.authenticate, ai.compareProviders);
// Reviews & Ratings routes
router.get('/hotels/:id/ratings', auth_js_1.authenticate, reviews.getRatings);
router.get('/hotels/:id/reviews', auth_js_1.authenticate, reviews.getReviews);
router.post('/hotels/:id/link-reviews', auth_js_1.authenticate, reviews.linkReviewSources);
router.post('/hotels/:id/refresh-ratings', auth_js_1.authenticate, reviews.refreshRatings);
router.get('/hotels/:id/review-sources', auth_js_1.authenticate, reviews.getReviewSources);
router.post('/hotels/:id/search-places', auth_js_1.authenticate, reviews.searchPlaces);
router.get('/hotels/:id/competitors', auth_js_1.authenticate, reviews.getCompetitors);
// Analytics routes
router.get('/hotels/:id/analytics/summary', auth_js_1.authenticate, analytics.getSummary);
router.get('/hotels/:id/analytics/timeline', auth_js_1.authenticate, analytics.getTimeline);
router.get('/hotels/:id/analytics/review-sentiment', auth_js_1.authenticate, analytics.getReviewSentiment);
router.get('/hotels/:id/analytics/alerts', auth_js_1.authenticate, analytics.getAlerts);
router.get('/hotels/:id/competitors', auth_js_1.authenticate, analytics.getCompetitors);
router.get('/hotels/:id/market-position', auth_js_1.authenticate, analytics.getMarketPosition);
// Portfolio routes (aggregated stats)
router.get('/portfolio/stats', auth_js_1.authenticate, analytics.getPortfolioStats);
router.get('/portfolio/trends', auth_js_1.authenticate, analytics.getPortfolioTrends);
// Sync status and auto-link routes
router.get('/hotels/:id/sync-status', auth_js_1.authenticate, admin.getHotelSyncStatus);
router.post('/hotels/:id/auto-link', auth_js_1.authenticate, admin.autoLinkHotel);
// Admin routes (require admin role)
router.post('/admin/sync/trigger', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.triggerBulkSync);
router.post('/admin/sync/hotels', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.syncSpecificHotels);
router.get('/admin/sync/jobs', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.getSyncJobs);
router.get('/admin/sync/jobs/:id/errors', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.getSyncJobErrors);
router.get('/admin/sync/pending', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.getPendingSyncHotels);
router.get('/admin/scheduler/status', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.getSchedulerStatus);
router.post('/admin/hotels/auto-link-batch', auth_js_1.authenticate, (0, auth_js_1.requireRole)('admin'), admin.autoLinkHotelsBatch);
// PMS Gateway routes (public for testing)
router.use(pms_1.default);
exports.default = router;
