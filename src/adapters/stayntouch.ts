// Eywa AI - StayNTouch PMS Adapter
// StayNTouch Mobile PMS - US Market, Mobile-First
// Docs: https://stayntouch.com/

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

const STAYNTOUCH_API_BASE = 'https://api.stayntouch.com/v2';
const STAYNTOUCH_AUTH_URL = 'https://auth.stayntouch.com/oauth/token';

type QueryValue = string | number | boolean | undefined;

export interface StayNTouchAdapterConfig {
  clientId: string;
  clientSecret: string;
  hotelId: string;
  baseUrl?: string;
}

export interface StayNTouchApiErrorBody {
  error?: string;
  message?: string;
  error_description?: string;
  [key: string]: unknown;
}

export class StayNTouchApiError extends Error {
  readonly status: number;
  readonly body?: StayNTouchApiErrorBody;

  constructor(message: string, status: number, body?: StayNTouchApiErrorBody) {
    super(message);
    this.name = 'StayNTouchApiError';
    this.status = status;
    this.body = body;
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface StayNTouchHotel {
  id?: string;
  hotelId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: { street?: string; city?: string; state?: string; country?: string; zip?: string };
  [key: string]: unknown;
}

export interface StayNTouchRoomType {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  maxOccupancy?: number;
  [key: string]: unknown;
}

export interface StayNTouchRatePlan {
  id?: string;
  code?: string;
  name?: string;
  roomTypeId?: string;
  baseRate?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface StayNTouchAvailability {
  date?: string;
  roomTypeId?: string;
  available?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface StayNTouchGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface StayNTouchReservation {
  id?: string;
  confirmationNumber?: string;
  status?: string;
  guest?: StayNTouchGuest;
  roomTypeId?: string;
  arrivalDate?: string;
  departureDate?: string;
  totalAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export class StayNTouchAdapter implements IPMSAdapter {
  name = 'StayNTouch';

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly hotelId: string;
  private tokenCache?: TokenCache;

  constructor(config: StayNTouchAdapterConfig) {
    if (!config.clientId || !config.clientSecret || !config.hotelId) {
      throw new Error('StayNTouchAdapter requires clientId, clientSecret, and hotelId.');
    }
    this.baseUrl = config.baseUrl ?? STAYNTOUCH_API_BASE;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.hotelId = config.hotelId;
  }

  async authenticate(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.accessToken;
    }

    const response = await fetch(STAYNTOUCH_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString()
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new StayNTouchApiError(payload.error_description || 'Auth failed', response.status, payload);
    }

    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAt: now + (payload.expires_in || 3600) * 1000
    };
    return this.tokenCache.accessToken;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ hotel?: StayNTouchHotel; data?: StayNTouchHotel }>(
      `/hotels/${this.hotelId}`
    );
    const hotel = response.hotel || response.data;
    if (!hotel) throw new Error('StayNTouch: no hotel data returned.');

    const addressParts = [hotel.address?.street, hotel.address?.city, hotel.address?.state, hotel.address?.zip, hotel.address?.country].filter(Boolean);

    return {
      id: hotel.id || hotel.hotelId || this.hotelId,
      name: hotel.name || 'StayNTouch Hotel',
      timezone: hotel.timezone || 'America/New_York',
      currency: hotel.currency || 'USD',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: StayNTouchAvailability[]; data?: StayNTouchAvailability[] }>(
      `/hotels/${this.hotelId}/availability`,
      { startDate: params.startDate, endDate: params.endDate, roomTypeId: params.roomTypeId }
    );
    const items = response.availability || response.data || [];
    return items.map(item => ({
      date: item.date || params.startDate,
      roomTypeId: item.roomTypeId || params.roomTypeId || '',
      available: item.available ?? 0,
      rate: item.rate ?? 0
    }));
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const response = await this.request<{ reservations?: StayNTouchReservation[]; data?: StayNTouchReservation[] }>(
      `/hotels/${this.hotelId}/reservations`,
      { startDate: params.startDate, endDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.id || res.confirmationNumber || '',
      guestName: res.guest ? [res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ') : 'Guest',
      roomTypeId: res.roomTypeId || '',
      checkIn: res.arrivalDate || '',
      checkOut: res.departureDate || '',
      status: res.status || 'confirmed',
      totalAmount: res.totalAmount ?? 0,
      currency: res.currency || 'USD'
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<{ roomTypes?: StayNTouchRoomType[]; data?: StayNTouchRoomType[] }>(
      `/hotels/${this.hotelId}/roomTypes`
    );
    const roomTypes = response.roomTypes || response.data || [];
    return roomTypes.map(rt => ({
      id: rt.id || rt.code || '',
      name: rt.name || '',
      capacity: rt.maxOccupancy || 2,
      description: rt.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<{ ratePlans?: StayNTouchRatePlan[]; data?: StayNTouchRatePlan[] }>(
      `/hotels/${this.hotelId}/ratePlans`
    );
    const rates = response.ratePlans || response.data || [];
    return rates.map(rate => ({
      id: rate.id || rate.code || '',
      name: rate.name || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.baseRate || 0,
      currency: rate.currency || 'USD'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}, retry = true): Promise<T> {
    const token = await this.authenticate();
    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 && retry) {
      await this.authenticate(true);
      return this.request<T>(path, query, false);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new StayNTouchApiError(payload.message || `StayNTouch API error (${response.status})`, response.status, payload);
    }
    return payload as T;
  }

  private buildUrl(path: string, query: Record<string, QueryValue>): string {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v !== undefined) params.append(k, String(v)); });
    const qs = params.toString();
    return qs ? `${this.baseUrl}${path}?${qs}` : `${this.baseUrl}${path}`;
  }
}
