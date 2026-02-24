/**
 * Unit tests for Cron Scheduler Service
 */

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn((expr, task, opts) => ({
    start: jest.fn(),
    stop: jest.fn(),
    running: true,
  })),
  validate: jest.fn().mockReturnValue(true),
}));

// Mock review-sync
jest.mock('../services/review-sync.js', () => ({
  runSyncJob: jest.fn().mockResolvedValue({
    jobId: 'job-123',
    status: 'completed',
    hotelsTotal: 10,
    hotelsSuccess: 10,
    hotelsFailed: 0,
    duration: 1000,
    errors: [],
  }),
  getHotelsDueForSync: jest.fn().mockResolvedValue([]),
  getRecentSyncJobs: jest.fn().mockResolvedValue([]),
}));

import * as cron from 'node-cron';
import * as cronScheduler from '../services/cron-scheduler.js';
import * as reviewSync from '../services/review-sync.js';

const mockSchedule = cron.schedule as jest.Mock;
const mockValidate = cron.validate as jest.Mock;
const mockRunSyncJob = reviewSync.runSyncJob as jest.Mock;

describe('Cron Scheduler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset scheduler state between tests
    cronScheduler.stopAllTasks();
  });

  describe('initializeScheduler', () => {
    test('initializes all scheduled tasks', () => {
      cronScheduler.initializeScheduler();

      // Should schedule at least 2 tasks (daily sync + health check)
      expect(mockSchedule).toHaveBeenCalledTimes(2);

      // Check daily sync schedule (3:00 AM UTC)
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 3 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'UTC' })
      );
    });
  });

  describe('scheduleTask', () => {
    test('validates cron expression', () => {
      mockValidate.mockReturnValueOnce(false);

      expect(() => {
        cronScheduler.scheduleTask('test-task', 'invalid', () => {});
      }).toThrow('Invalid cron expression');
    });

    test('schedules task with valid expression', () => {
      cronScheduler.scheduleTask('test-task', '0 * * * *', () => {});

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 * * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'UTC' })
      );
    });

    test('replaces existing task with same name', () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        running: true,
      };
      mockSchedule.mockReturnValue(mockTask);

      cronScheduler.scheduleTask('test-task', '0 * * * *', () => {});
      cronScheduler.scheduleTask('test-task', '30 * * * *', () => {});

      // Second call should have stopped the first task
      expect(mockSchedule).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopTask', () => {
    test('stops and removes task', () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn(),
        running: true,
      };
      mockSchedule.mockReturnValue(mockTask);

      cronScheduler.scheduleTask('test-task', '0 * * * *', () => {});
      const result = cronScheduler.stopTask('test-task');

      expect(result).toBe(true);
      expect(mockTask.stop).toHaveBeenCalled();
    });

    test('returns false for non-existent task', () => {
      const result = cronScheduler.stopTask('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('stopAllTasks', () => {
    test('stops all scheduled tasks', () => {
      const mockTask1 = { start: jest.fn(), stop: jest.fn(), running: true };
      const mockTask2 = { start: jest.fn(), stop: jest.fn(), running: true };
      
      mockSchedule
        .mockReturnValueOnce(mockTask1)
        .mockReturnValueOnce(mockTask2);

      cronScheduler.scheduleTask('task-1', '0 * * * *', () => {});
      cronScheduler.scheduleTask('task-2', '30 * * * *', () => {});
      cronScheduler.stopAllTasks();

      expect(mockTask1.stop).toHaveBeenCalled();
      expect(mockTask2.stop).toHaveBeenCalled();
    });
  });

  describe('getSchedulerStatus', () => {
    test('returns status of all tasks', () => {
      const mockTask = { start: jest.fn(), stop: jest.fn(), running: true };
      mockSchedule.mockReturnValue(mockTask);

      cronScheduler.scheduleTask('test-task', '0 * * * *', () => {});
      const status = cronScheduler.getSchedulerStatus();

      expect(status).toHaveLength(1);
      expect(status[0].name).toBe('test-task');
      expect(status[0].running).toBe(true);
    });
  });

  describe('triggerManualSync', () => {
    test('triggers sync job for all hotels', async () => {
      const result = await cronScheduler.triggerManualSync('test-user');

      expect(mockRunSyncJob).toHaveBeenCalledWith({
        triggeredBy: 'test-user',
        jobType: 'bulk',
        hotelIds: undefined,
      });
      expect(result.status).toBe('completed');
    });

    test('triggers sync job for specific hotels', async () => {
      const hotelIds = ['hotel-1', 'hotel-2'];
      const result = await cronScheduler.triggerManualSync('test-user', hotelIds);

      expect(mockRunSyncJob).toHaveBeenCalledWith({
        triggeredBy: 'test-user',
        jobType: 'manual',
        hotelIds,
      });
    });
  });
});
