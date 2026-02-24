"use strict";
/**
 * Cron Scheduler Service
 *
 * Manages scheduled tasks for the Review Service using node-cron.
 *
 * Default schedule:
 * - Daily sync at 3:00 AM UTC
 */
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
exports.initializeScheduler = initializeScheduler;
exports.scheduleTask = scheduleTask;
exports.stopTask = stopTask;
exports.stopAllTasks = stopAllTasks;
exports.getSchedulerStatus = getSchedulerStatus;
exports.triggerManualSync = triggerManualSync;
const node_cron_1 = __importDefault(require("node-cron"));
const reviewSync = __importStar(require("./review-sync.js"));
// Store scheduled tasks for management
const scheduledTasks = new Map();
/**
 * Initialize all scheduled tasks
 */
function initializeScheduler() {
    console.log('🕐 Initializing cron scheduler...');
    // Daily review sync at 3:00 AM UTC
    scheduleTask('daily-review-sync', '0 3 * * *', // 3:00 AM every day
    async () => {
        console.log('🔄 Starting scheduled daily review sync...');
        try {
            const result = await reviewSync.runSyncJob({
                triggeredBy: 'cron',
                jobType: 'scheduled',
            });
            console.log(`✅ Daily sync completed: ${result.hotelsSuccess}/${result.hotelsTotal} hotels synced in ${result.duration}ms`);
            if (result.hotelsFailed > 0) {
                console.warn(`⚠️ ${result.hotelsFailed} hotels failed to sync`);
            }
        }
        catch (error) {
            console.error('❌ Daily sync failed:', error);
        }
    });
    // Hourly health check (optional - for monitoring)
    scheduleTask('sync-health-check', '0 * * * *', // Every hour
    async () => {
        try {
            const hotelsNeedingSync = await reviewSync.getHotelsDueForSync(1);
            const recentJobs = await reviewSync.getRecentSyncJobs(1);
            const lastJob = recentJobs[0];
            const pendingHotels = hotelsNeedingSync.length > 0;
            if (lastJob && lastJob.status === 'failed' && pendingHotels) {
                console.warn('⚠️ Last sync job failed and hotels are pending. Check logs.');
            }
        }
        catch (error) {
            // Silent fail for health check
        }
    });
    console.log('✅ Cron scheduler initialized with', scheduledTasks.size, 'tasks');
}
/**
 * Schedule a task with the given cron expression
 */
function scheduleTask(taskName, cronExpression, task) {
    // Validate cron expression
    if (!node_cron_1.default.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    // Stop existing task if any
    const existingTask = scheduledTasks.get(taskName);
    if (existingTask) {
        existingTask.stop();
    }
    // Schedule new task
    const scheduledTask = node_cron_1.default.schedule(cronExpression, async () => {
        try {
            await task();
        }
        catch (error) {
            console.error(`Error in scheduled task '${taskName}':`, error);
        }
    }, {
        scheduled: true,
        timezone: 'UTC',
    });
    scheduledTasks.set(taskName, scheduledTask);
    console.log(`📅 Scheduled task '${taskName}' with cron: ${cronExpression}`);
}
/**
 * Stop a scheduled task
 */
function stopTask(taskName) {
    const task = scheduledTasks.get(taskName);
    if (task) {
        task.stop();
        scheduledTasks.delete(taskName);
        console.log(`🛑 Stopped task '${taskName}'`);
        return true;
    }
    return false;
}
/**
 * Stop all scheduled tasks
 */
function stopAllTasks() {
    for (const [name, task] of scheduledTasks) {
        task.stop();
        console.log(`🛑 Stopped task '${name}'`);
    }
    scheduledTasks.clear();
}
/**
 * Get status of all scheduled tasks
 */
function getSchedulerStatus() {
    return Array.from(scheduledTasks.entries()).map(([name, task]) => ({
        name,
        running: task.running !== undefined ? task.running : true,
    }));
}
/**
 * Manually trigger a sync job (for testing or admin use)
 */
async function triggerManualSync(triggeredBy, hotelIds) {
    console.log(`🔄 Manual sync triggered by ${triggeredBy}`);
    return reviewSync.runSyncJob({
        triggeredBy,
        jobType: hotelIds ? 'manual' : 'bulk',
        hotelIds,
    });
}
