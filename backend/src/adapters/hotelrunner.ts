// HotelRunner Channel Manager Adapter
// API: https://developers.hotelrunner.com
// Covers 10,000+ Turkish hotels
// Contact: Arden Agopyan (CEO), Istanbul

import axios, { AxiosInstance } from 'axios';

interface HotelRunnerConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface HotelRunnerProperty {
  id: string;
  name: string;
  rooms: number;
  address: string;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  status: string;
}

export interface HotelRunnerRoomType {
  id: string;
  propertyId: string;
  name: string;
  nameEn: string;
  code: string;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  baseRate: number;
}

export interface HotelRunnerRate {
  roomTypeId: string;
  date: string;
  rate: number;
  currency: string;
  availability: number;
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}

export interface HotelRunnerBooking {
  id: string;
  propertyId: string;
  confirmationNumber: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  roomCount: number;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  status: 'confirmed' | 'cancelled' | 'pending' | 'no_show';
  source: string;
  channelBookingId: string;
  createdAt: string;
  updatedAt: string;
  specialRequests?: string;
}

export class HotelRunnerAdapter {
  private client: AxiosInstance;
  private config: HotelRunnerConfig;

  constructor(config: HotelRunnerConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl || 'https://api.hotelrunner.com/v2',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('[HotelRunner] API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Property Management
  async getProperties(): Promise<HotelRunnerProperty[]> {
    const response = await this.client.get('/properties');
    return response.data.properties || response.data;
  }

  async getProperty(propertyId: string): Promise<HotelRunnerProperty> {
    const response = await this.client.get(`/properties/${propertyId}`);
    return response.data;
  }

  // Room Types
  async getRoomTypes(propertyId: string): Promise<HotelRunnerRoomType[]> {
    const response = await this.client.get(`/properties/${propertyId}/room-types`);
    return response.data.roomTypes || response.data;
  }

  async getRoomType(propertyId: string, roomTypeId: string): Promise<HotelRunnerRoomType> {
    const response = await this.client.get(`/properties/${propertyId}/room-types/${roomTypeId}`);
    return response.data;
  }

  // Availability & Rates
  async getAvailability(
    propertyId: string, 
    startDate: string, 
    endDate: string,
    roomTypeIds?: string[]
  ): Promise<HotelRunnerRate[]> {
    const response = await this.client.get(`/properties/${propertyId}/availability`, {
      params: { 
        start_date: startDate, 
        end_date: endDate,
        room_type_ids: roomTypeIds?.join(',')
      }
    });
    return response.data.rates || response.data;
  }

  async updateRates(propertyId: string, rates: HotelRunnerRate[]): Promise<void> {
    await this.client.put(`/properties/${propertyId}/rates`, { rates });
  }

  async updateSingleRate(
    propertyId: string, 
    roomTypeId: string, 
    date: string, 
    rate: Partial<HotelRunnerRate>
  ): Promise<void> {
    await this.client.put(`/properties/${propertyId}/rates/${roomTypeId}/${date}`, rate);
  }

  // Inventory
  async getInventory(propertyId: string, startDate: string, endDate: string): Promise<any[]> {
    const response = await this.client.get(`/properties/${propertyId}/inventory`, {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data.inventory || response.data;
  }

  async updateInventory(propertyId: string, inventory: any[]): Promise<void> {
    await this.client.put(`/properties/${propertyId}/inventory`, { inventory });
  }

  // Bookings
  async getBookings(
    propertyId: string, 
    startDate: string, 
    endDate: string,
    status?: string
  ): Promise<HotelRunnerBooking[]> {
    const response = await this.client.get(`/properties/${propertyId}/bookings`, {
      params: { 
        start_date: startDate, 
        end_date: endDate,
        status
      }
    });
    return response.data.bookings || response.data;
  }

  async getBooking(propertyId: string, bookingId: string): Promise<HotelRunnerBooking> {
    const response = await this.client.get(`/properties/${propertyId}/bookings/${bookingId}`);
    return response.data;
  }

  async getNewBookings(propertyId: string, since: string): Promise<HotelRunnerBooking[]> {
    const response = await this.client.get(`/properties/${propertyId}/bookings/new`, {
      params: { since }
    });
    return response.data.bookings || response.data;
  }

  // Channels
  async getConnectedChannels(propertyId: string): Promise<any[]> {
    const response = await this.client.get(`/properties/${propertyId}/channels`);
    return response.data.channels || response.data;
  }

  // Sync operations
  async syncAllRates(propertyId: string): Promise<void> {
    await this.client.post(`/properties/${propertyId}/sync/rates`);
  }

  async syncAllAvailability(propertyId: string): Promise<void> {
    await this.client.post(`/properties/${propertyId}/sync/availability`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export default HotelRunnerAdapter;
