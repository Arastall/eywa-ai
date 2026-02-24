/**
 * Cron Scheduler Service
 * 
 * Manages scheduled tasks for the Review Service using node-cron.
 * 
 * Default schedule:
 * - Daily sync at 3:00 AM UTC
 */

import cron from 'node-cron';
import * as reviewSync from './review-sync.js';

// Store scheduled tasks for management
const scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

/**
 * Initialize all scheduled tasks
 */
export function initializeScheduler(): void {
  console.log('🕐 Initializing cron scheduler...');
  
  // Daily review sync at 3:00 AM UTC
  scheduleTask(
    'daily-review-sync',
    '0 3 * * *', // 3:00 AM every day
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
      } catch (error) {
        console.error('❌ Daily sync failed:', error);
      }
    }
  );
  
  // Hourly health check (optional - for monitoring)
  scheduleTask(
    'sync-health-check',
    '0 * * * *', // Every hour
    async () => {
      try {
        const hotelsNeedingSync = await reviewSync.getHotelsDueForSync(1);
        const recentJobs = await reviewSync.getRecentSyncJobs(1);
        
        const lastJob = recentJobs[0];
        const pendingHotels = hotelsNeedingSync.length > 0;
        
        if (lastJob && lastJob.status === 'failed' && pendingHotels) {
          console.warn('⚠️ Last sync job failed and hotels are pending. Check logs.');
        }
      } catch (error) {
        // Silent fail for health check
      }
    }
  );
  
  console.log('✅ Cron scheduler initialized with', scheduledTasks.size, 'tasks');
}

/**
 * Schedule a task with the given cron expression
 */
export function scheduleTask(
  taskName: string,
  cronExpression: string,
  task: () => void | Promise<void>
): void {
  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
  
  // Stop existing task if any
  const existingTask = scheduledTasks.get(taskName);
  if (existingTask) {
    existingTask.stop();
  }
  
  // Schedule new task
  const scheduledTask = cron.schedule(cronExpression, async () => {
    try {
      await task();
    } catch (error) {
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
export function stopTask(taskName: string): boolean {
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
export function stopAllTasks(): void {
  for (const [name, task] of scheduledTasks) {
    task.stop();
    console.log(`🛑 Stopped task '${name}'`);
  }
  scheduledTasks.clear();
}

/**
 * Get status of all scheduled tasks
 */
export function getSchedulerStatus(): Array<{
  name: string;
  running: boolean;
}> {
  return Array.from(scheduledTasks.entries()).map(([name, task]) => ({
    name,
    running: task.running !== undefined ? task.running : true,
  }));
}

/**
 * Manually trigger a sync job (for testing or admin use)
 */
export async function triggerManualSync(
  triggeredBy: string,
  hotelIds?: string[]
): Promise<reviewSync.SyncJobResult> {
  console.log(`🔄 Manual sync triggered by ${triggeredBy}`);
  return reviewSync.runSyncJob({
    triggeredBy,
    jobType: hotelIds ? 'manual' : 'bulk',
    hotelIds,
  });
}
