// Eywa AI - PMS Router Service
// Routes requests to the correct PMS adapter based on hotel config

// Types inline to avoid complex imports
export interface HotelConfiguration {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  address?: string;
}

export interface Availability {
  date: string;
  roomTypeId: string;
  available: number;
  rate: number;
}

export interface AvailabilityParams {
  startDate: string;
  endDate: string;
  roomTypeId?: string;
}

export interface Reservation {
  id: string;
  guestName: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  currency: string;
}

export interface ReservationParams {
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface RoomType {
  id: string;
  name: string;
  capacity: number;
  description?: string;
}

export interface Rate {
  id: string;
  name: string;
  roomTypeId: string;
  price: number;
  currency: string;
}

export interface IPMSAdapter {
  name: string;
  authenticate(forceRefresh?: boolean): Promise<string>;
  getConfiguration(): Promise<HotelConfiguration>;
  getAvailability(params: AvailabilityParams): Promise<Availability[]>;
  getReservations(params?: ReservationParams): Promise<Reservation[]>;
  getRoomTypes(): Promise<RoomType[]>;
  getRates(): Promise<Rate[]>;
}

// Stub adapters for now - will connect to real ones when credentials are provided
class StubAdapter implements IPMSAdapter {
  name: string;
  private config: Record<string, string>;
  
  constructor(name: string, config: Record<string, string>) {
    this.name = name;
    this.config = config;
  }
  
  async authenticate(): Promise<string> {
    return 'stub_token';
  }
  
  async getConfiguration(): Promise<HotelConfiguration> {
    return {
      id: this.config.hotelId || this.config.propertyId || 'stub_hotel',
      name: `${this.name} Hotel (Stub)`,
      timezone: 'UTC',
      currency: 'USD'
    };
  }
  
  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    return [{
      date: params.startDate,
      roomTypeId: 'room_1',
      available: 5,
      rate: 150
    }];
  }
  
  async getReservations(): Promise<Reservation[]> {
    return [{
      id: 'res_stub_1',
      guestName: 'Test Guest',
      roomTypeId: 'room_1',
      checkIn: '2024-03-01',
      checkOut: '2024-03-03',
      status: 'confirmed',
      totalAmount: 300,
      currency: 'USD'
    }];
  }
  
  async getRoomTypes(): Promise<RoomType[]> {
    return [{
      id: 'room_1',
      name: 'Standard Room',
      capacity: 2,
      description: 'Stub room type'
    }];
  }
  
  async getRates(): Promise<Rate[]> {
    return [{
      id: 'rate_1',
      name: 'Best Available Rate',
      roomTypeId: 'room_1',
      price: 150,
      currency: 'USD'
    }];
  }
}

// PMS Connection stored in DB
export interface PMSConnection {
  id: string;
  hotelId: string;
  pmsType: PMSType;
  credentials: Record<string, string>;
  environment: 'sandbox' | 'production';
  isActive: boolean;
  createdAt: Date;
  lastSyncAt?: Date;
}

export type PMSType = 
  | 'mews' | 'cloudbeds' | 'apaleo' | 'opera' 
  | 'protel' | 'guestline' | 'roomraccoon' | 'clockpms'
  | 'hotelogix' | 'ezee' | 'littlehotelier'
  | 'stayntouch' | 'webrezpro' | 'inforhms'
  | 'hostaway' | 'beds24' | 'guesty';

// Adapter factory - uses StubAdapter for testing, will integrate real adapters with credentials
export function createAdapter(pmsType: PMSType, credentials: Record<string, string>): IPMSAdapter {
  const pmsInfo = PMS_LIST.find(p => p.type === pmsType);
  const name = pmsInfo?.name || pmsType;
  
  // For now, return stub adapter - real adapters will be integrated when credentials are available
  // TODO: Import and use real adapters from ../../../src/adapters/
  return new StubAdapter(name, credentials);
}

// PMS Router - main service class
export class PMSRouter {
  private connections: Map<string, PMSConnection> = new Map();
  private adapterCache: Map<string, IPMSAdapter> = new Map();

  // Register a hotel's PMS connection
  registerConnection(connection: PMSConnection): void {
    this.connections.set(connection.hotelId, connection);
    // Clear cached adapter if exists
    this.adapterCache.delete(connection.hotelId);
  }

  // Get adapter for a hotel
  getAdapter(hotelId: string): IPMSAdapter {
    // Check cache first
    const cached = this.adapterCache.get(hotelId);
    if (cached) return cached;

    // Get connection
    const connection = this.connections.get(hotelId);
    if (!connection) {
      throw new Error(`No PMS connection found for hotel: ${hotelId}`);
    }

    if (!connection.isActive) {
      throw new Error(`PMS connection is inactive for hotel: ${hotelId}`);
    }

    // Create and cache adapter
    const adapter = createAdapter(connection.pmsType, connection.credentials);
    this.adapterCache.set(hotelId, adapter);
    return adapter;
  }

  // Get connection info
  getConnection(hotelId: string): PMSConnection | undefined {
    return this.connections.get(hotelId);
  }

  // List all connections
  listConnections(): PMSConnection[] {
    return Array.from(this.connections.values());
  }

  // Remove connection
  removeConnection(hotelId: string): boolean {
    this.adapterCache.delete(hotelId);
    return this.connections.delete(hotelId);
  }

  // === Unified API methods ===

  async getConfiguration(hotelId: string): Promise<HotelConfiguration> {
    const adapter = this.getAdapter(hotelId);
    return adapter.getConfiguration();
  }

  async getAvailability(hotelId: string, params: AvailabilityParams): Promise<Availability[]> {
    const adapter = this.getAdapter(hotelId);
    return adapter.getAvailability(params);
  }

  async getReservations(hotelId: string, params?: ReservationParams): Promise<Reservation[]> {
    const adapter = this.getAdapter(hotelId);
    return adapter.getReservations(params);
  }

  async getRoomTypes(hotelId: string): Promise<RoomType[]> {
    const adapter = this.getAdapter(hotelId);
    return adapter.getRoomTypes();
  }

  async getRates(hotelId: string): Promise<Rate[]> {
    const adapter = this.getAdapter(hotelId);
    return adapter.getRates();
  }

  // Test connection
  async testConnection(pmsType: PMSType, credentials: Record<string, string>): Promise<{ success: boolean; message: string; data?: HotelConfiguration }> {
    try {
      const adapter = createAdapter(pmsType, credentials);
      await adapter.authenticate();
      const config = await adapter.getConfiguration();
      return {
        success: true,
        message: `Connected to ${config.name}`,
        data: config
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection failed'
      };
    }
  }
}

// Singleton instance
export const pmsRouter = new PMSRouter();

// Available PMS list with info
export const PMS_LIST = [
  { type: 'mews', name: 'Mews', authType: 'token', region: 'Global' },
  { type: 'cloudbeds', name: 'Cloudbeds', authType: 'oauth2', region: 'Americas' },
  { type: 'apaleo', name: 'Apaleo', authType: 'oauth2', region: 'Europe' },
  { type: 'opera', name: 'Opera Cloud', authType: 'oauth2', region: 'Global' },
  { type: 'protel', name: 'Protel', authType: 'apikey', region: 'Europe' },
  { type: 'guestline', name: 'Guestline', authType: 'apikey', region: 'UK' },
  { type: 'roomraccoon', name: 'RoomRaccoon', authType: 'apikey', region: 'Europe' },
  { type: 'clockpms', name: 'Clock PMS', authType: 'apikey', region: 'Eastern Europe' },
  { type: 'hotelogix', name: 'Hotelogix', authType: 'apikey', region: 'Asia' },
  { type: 'ezee', name: 'eZee', authType: 'apikey', region: 'Asia' },
  { type: 'littlehotelier', name: 'Little Hotelier', authType: 'apikey', region: 'APAC' },
  { type: 'stayntouch', name: 'StayNTouch', authType: 'oauth2', region: 'US' },
  { type: 'webrezpro', name: 'WebRezPro', authType: 'apikey', region: 'US' },
  { type: 'inforhms', name: 'Infor HMS', authType: 'oauth2', region: 'Global' },
  { type: 'hostaway', name: 'Hostaway', authType: 'oauth2', region: 'Global' },
  { type: 'beds24', name: 'Beds24', authType: 'apikey', region: 'Global' },
  { type: 'guesty', name: 'Guesty', authType: 'oauth2', region: 'Global' },
] as const;
