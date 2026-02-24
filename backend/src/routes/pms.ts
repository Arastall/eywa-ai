// Eywa AI - PMS Gateway Routes
import { Router, Request, Response } from 'express';
import { pmsRouter, PMSType, PMS_LIST, createAdapter } from '../services/pms-router';
import { parseCommand, executeCommand } from '../services/telegram-commands';

const router = Router();

// List all supported PMS
router.get('/pms/list', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: PMS_LIST.length,
    coverage: '~90%',
    pms: PMS_LIST
  });
});

// Test PMS connection
router.post('/pms/test', async (req: Request, res: Response) => {
  try {
    const { pmsType, credentials } = req.body;
    
    if (!pmsType || !credentials) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing pmsType or credentials' 
      });
    }

    const result = await pmsRouter.testConnection(pmsType as PMSType, credentials);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Connect a PMS
router.post('/pms/connect', async (req: Request, res: Response) => {
  try {
    const { hotelId, pmsType, credentials, environment = 'sandbox' } = req.body;
    
    if (!hotelId || !pmsType || !credentials) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing hotelId, pmsType, or credentials' 
      });
    }

    // Test connection first
    const testResult = await pmsRouter.testConnection(pmsType as PMSType, credentials);
    
    if (!testResult.success) {
      return res.status(400).json(testResult);
    }

    // Register connection
    pmsRouter.registerConnection({
      id: `conn_${Date.now()}`,
      hotelId,
      pmsType: pmsType as PMSType,
      credentials,
      environment,
      isActive: true,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: `Connected ${hotelId} to ${pmsType}`,
      hotel: testResult.data
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get connection status
router.get('/pms/status', (req: Request, res: Response) => {
  const connections = pmsRouter.listConnections();
  res.json({
    success: true,
    count: connections.length,
    connections: connections.map(c => ({
      hotelId: c.hotelId,
      pmsType: c.pmsType,
      environment: c.environment,
      isActive: c.isActive,
      createdAt: c.createdAt,
      lastSyncAt: c.lastSyncAt
    }))
  });
});

// Get hotel configuration
router.get('/pms/:hotelId/config', async (req: Request, res: Response) => {
  try {
    const config = await pmsRouter.getConfiguration(req.params.hotelId);
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get availability
router.get('/pms/:hotelId/availability', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, roomTypeId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing startDate or endDate' 
      });
    }

    const availability = await pmsRouter.getAvailability(req.params.hotelId, {
      startDate: startDate as string,
      endDate: endDate as string,
      roomTypeId: roomTypeId as string
    });

    res.json({ success: true, count: availability.length, data: availability });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get reservations
router.get('/pms/:hotelId/reservations', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status } = req.query;

    const reservations = await pmsRouter.getReservations(req.params.hotelId, {
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string
    });

    res.json({ success: true, count: reservations.length, data: reservations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get room types
router.get('/pms/:hotelId/rooms', async (req: Request, res: Response) => {
  try {
    const roomTypes = await pmsRouter.getRoomTypes(req.params.hotelId);
    res.json({ success: true, count: roomTypes.length, data: roomTypes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get rates
router.get('/pms/:hotelId/rates', async (req: Request, res: Response) => {
  try {
    const rates = await pmsRouter.getRates(req.params.hotelId);
    res.json({ success: true, count: rates.length, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Telegram webhook / command handler
router.post('/pms/telegram', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Missing message' });
    }

    const parsed = parseCommand(message);
    
    if (!parsed) {
      return res.json({ success: true, response: null }); // Not an /eywa command
    }

    const response = await executeCommand(parsed.command, parsed.args);
    res.json({ success: true, response });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
