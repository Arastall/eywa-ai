// Eywa AI - Mews PMS Adapter

import { IPMSAdapter, HotelConfiguration, Availability, AvailabilityParams, Reservation, ReservationParams, RoomType, Rate } from './types';

const MEWS_DEMO_URL = 'https://api.mews-demo.com/api/connector/v1';

// Public demo credentials from Mews documentation
// Updated demo credentials from Mews docs (Gross Pricing - UK environment)
const DEMO_CREDENTIALS = {
  ClientToken: 'E0D439EE522F44368DC78E1BFB03710C-D24FB11DBE31D4621C4817E028D9E1D',
  AccessToken: 'C66EF7B239D24632943D115EDE9CB810-EA00F8FD8294692C940F6B5A8F9453D',
  Client: 'EywaAI'
};

export class MewsAdapter implements IPMSAdapter {
  name = 'Mews';
  private baseUrl: string;
  private credentials: typeof DEMO_CREDENTIALS;

  constructor(config?: { baseUrl?: string; clientToken?: string; accessToken?: string }) {
    this.baseUrl = config?.baseUrl || MEWS_DEMO_URL;
    this.credentials = {
      ClientToken: config?.clientToken || DEMO_CREDENTIALS.ClientToken,
      AccessToken: config?.accessToken || DEMO_CREDENTIALS.AccessToken,
      Client: 'EywaAI'
    };
  }

  private async request<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.credentials, ...body })
    });
    
    if (!response.ok) {
      throw new Error(`Mews API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const data = await this.request<any>('/configuration/get');
    return {
      id: data.Enterprise?.Id || '',
      name: data.Enterprise?.Name || '',
      timezone: data.Enterprise?.TimeZoneIdentifier || 'UTC',
      currency: data.Enterprise?.DefaultCurrency || 'EUR',
      address: data.Enterprise?.Address?.Line1
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const data = await this.request<any>('/services/getAvailability', {
      StartUtc: params.startDate,
      EndUtc: params.endDate,
      ServiceId: params.roomTypeId
    });
    
    // Transform Mews response to our format
    return data.CategoryAvailabilities?.map((cat: any) => ({
      date: cat.Date,
      roomTypeId: cat.CategoryId,
      available: cat.Availabilities?.[0]?.Value || 0,
      rate: 0 // Would need separate rate call
    })) || [];
  }

  async getReservations(params: ReservationParams): Promise<Reservation[]> {
    const data = await this.request<any>('/reservations/getAll', {
      StartUtc: params.startDate,
      EndUtc: params.endDate,
      States: params.status ? [params.status] : undefined
    });
    
    return data.Reservations?.map((res: any) => ({
      id: res.Id,
      guestName: res.GuestName || 'Guest',
      roomTypeId: res.RequestedCategoryId,
      checkIn: res.StartUtc,
      checkOut: res.EndUtc,
      status: res.State,
      totalAmount: res.TotalAmount?.Value || 0,
      currency: res.TotalAmount?.Currency || 'EUR'
    })) || [];
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const data = await this.request<any>('/resources/getAll', {
      Extent: { Categories: true }
    });
    
    return data.Categories?.map((cat: any) => ({
      id: cat.Id,
      name: cat.Name,
      capacity: cat.Capacity || 2,
      description: cat.Description
    })) || [];
  }

  async getRates(): Promise<Rate[]> {
    const data = await this.request<any>('/rates/getAll');
    
    return data.Rates?.map((rate: any) => ({
      id: rate.Id,
      name: rate.Name,
      roomTypeId: rate.ServiceId,
      price: rate.Price?.Value || 0,
      currency: rate.Price?.Currency || 'EUR'
    })) || [];
  }
}

// Test function
export async function testMewsConnection() {
  const adapter = new MewsAdapter();
  try {
    const config = await adapter.getConfiguration();
    console.log('✅ Mews connection successful!');
    console.log('Hotel:', config.name);
    console.log('Timezone:', config.timezone);
    return config;
  } catch (error) {
    console.error('❌ Mews connection failed:', error);
    throw error;
  }
}
