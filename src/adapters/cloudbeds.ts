// Eywa AI - Cloudbeds PMS Adapter

import {
  IPMSAdapter,
  HotelConfiguration,
  Availability,
  AvailabilityParams,
  Reservation,
  ReservationParams,
  RoomType,
  Rate
} from './types';

const CLOUDBEDS_API_BASE = 'https://api.cloudbeds.com/api/v1.2';

type CloudbedsAuthConfig = {
  baseUrl?: string;
  // Either set accessToken/apiKey or provide username/password to fetch one.
  accessToken?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  propertyId?: string;
};

type CloudbedsResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

type CloudbedsAuthResponse = {
  access_token?: string;
  accessToken?: string;
  token?: string;
};

type CloudbedsHotelDetails = {
  property_id?: string;
  property_name?: string;
  timezone?: string;
  currency?: string;
  address?: string;
};

type CloudbedsRoom = {
  room_type_id?: string;
  room_type_name?: string;
  max_occupancy?: number;
  description?: string;
};

type CloudbedsReservation = {
  reservation_id?: string;
  guest_name?: string;
  room_type_id?: string;
  checkin_date?: string;
  checkout_date?: string;
  status?: string;
  total?: number;
  currency?: string;
};

type CloudbedsRate = {
  rate_id?: string;
  rate_name?: string;
  room_type_id?: string;
  amount?: number;
  currency?: string;
};

type CloudbedsAvailability = {
  date?: string;
  room_type_id?: string;
  available?: number;
  rate?: number;
};

export class CloudbedsAdapter implements IPMSAdapter {
  name = 'Cloudbeds';
  private baseUrl: string;
  private accessToken?: string;
  private username?: string;
  private password?: string;
  private propertyId?: string;

  constructor(config: CloudbedsAuthConfig = {}) {
    this.baseUrl = config.baseUrl || CLOUDBEDS_API_BASE;
    this.accessToken = config.accessToken || config.apiKey;
    this.username = config.username;
    this.password = config.password;
    this.propertyId = config.propertyId;
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    if (!this.username || !this.password) {
      throw new Error('Cloudbeds authentication failed: missing access token or username/password.');
    }

    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password })
    });

    if (!response.ok) {
      throw new Error(`Cloudbeds auth error: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as CloudbedsResponse<CloudbedsAuthResponse> | CloudbedsAuthResponse;
    const token =
      (payload as CloudbedsResponse<CloudbedsAuthResponse>).data?.access_token ||
      (payload as CloudbedsResponse<CloudbedsAuthResponse>).data?.accessToken ||
      (payload as CloudbedsResponse<CloudbedsAuthResponse>).data?.token ||
      (payload as CloudbedsAuthResponse).access_token ||
      (payload as CloudbedsAuthResponse).accessToken ||
      (payload as CloudbedsAuthResponse).token;

    if (!token) {
      throw new Error('Cloudbeds authentication failed: access token missing in response.');
    }

    this.accessToken = token;
    return token;
  }

  private async request<T>(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const token = await this.authenticate();
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) searchParams.append(key, String(value));
    });

    // Cloudbeds API commonly accepts access_token as query string
    if (!searchParams.has('access_token')) searchParams.append('access_token', token);

    const url = `${this.baseUrl}${endpoint}?${searchParams.toString()}`;
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Cloudbeds API error: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as CloudbedsResponse<T> | T;
    if ((payload as CloudbedsResponse<T>).success === false) {
      const msg = (payload as CloudbedsResponse<T>).error || (payload as CloudbedsResponse<T>).message || 'Unknown error';
      throw new Error(`Cloudbeds API error: ${msg}`);
    }

    return (payload as CloudbedsResponse<T>).data ?? (payload as T);
  }

  // Cloudbeds-specific methods
  async getHotelDetails(): Promise<CloudbedsHotelDetails> {
    return this.request<CloudbedsHotelDetails>('/getHotelDetails', {
      property_id: this.propertyId
    });
  }

  async getRooms(): Promise<CloudbedsRoom[]> {
    return this.request<CloudbedsRoom[]>('/getRooms', {
      property_id: this.propertyId
    });
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const data = await this.request<CloudbedsReservation[]>('/getReservations', {
      property_id: this.propertyId,
      start_date: params.startDate,
      end_date: params.endDate,
      status: params.status
    });

    return (data || []).map((res) => ({
      id: res.reservation_id || '',
      guestName: res.guest_name || 'Guest',
      roomTypeId: res.room_type_id || '',
      checkIn: res.checkin_date || '',
      checkOut: res.checkout_date || '',
      status: res.status || 'confirmed',
      totalAmount: res.total || 0,
      currency: res.currency || 'USD'
    }));
  }

  async getRates(): Promise<Rate[]> {
    const data = await this.request<CloudbedsRate[]>('/getRates', {
      property_id: this.propertyId
    });

    return (data || []).map((rate) => ({
      id: rate.rate_id || '',
      name: rate.rate_name || 'Rate',
      roomTypeId: rate.room_type_id || '',
      price: rate.amount || 0,
      currency: rate.currency || 'USD'
    }));
  }

  // IPMSAdapter methods
  async getConfiguration(): Promise<HotelConfiguration> {
    const data = await this.getHotelDetails();
    return {
      id: data.property_id || '',
      name: data.property_name || '',
      timezone: data.timezone || 'UTC',
      currency: data.currency || 'USD',
      address: data.address
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const data = await this.request<CloudbedsAvailability[]>('/getAvailability', {
      property_id: this.propertyId,
      start_date: params.startDate,
      end_date: params.endDate,
      room_type_id: params.roomTypeId
    });

    return (data || []).map((item) => ({
      date: item.date || '',
      roomTypeId: item.room_type_id || '',
      available: item.available || 0,
      rate: item.rate || 0
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const data = await this.getRooms();
    return (data || []).map((room) => ({
      id: room.room_type_id || '',
      name: room.room_type_name || 'Room',
      capacity: room.max_occupancy || 2,
      description: room.description
    }));
  }
}
