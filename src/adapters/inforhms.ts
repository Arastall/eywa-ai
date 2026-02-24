// Eywa AI - Infor HMS Adapter
// Infor Hospitality Management Solution - Enterprise Hotels
// Docs: https://www.infor.com/products/hms

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

const INFOR_API_BASE = 'https://api.infor.com/hms/v1';
const INFOR_AUTH_URL = 'https://auth.infor.com/oauth/token';

type QueryValue = string | number | boolean | undefined;

export interface InforHMSAdapterConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  hotelId: string;
  baseUrl?: string;
}

export interface InforHMSApiErrorBody {
  error?: string;
  message?: string;
  error_description?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export class InforHMSApiError extends Error {
  readonly status: number;
  readonly body?: InforHMSApiErrorBody;

  constructor(message: string, status: number, body?: InforHMSApiErrorBody) {
    super(message);
    this.name = 'InforHMSApiError';
    this.status = status;
    this.body = body;
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface InforHotel {
  hotelId?: string;
  hotelCode?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: { street?: string; city?: string; state?: string; country?: string; postalCode?: string };
  [key: string]: unknown;
}

export interface InforRoomType {
  roomTypeId?: string;
  code?: string;
  name?: string;
  description?: string;
  maxOccupancy?: number;
  [key: string]: unknown;
}

export interface InforRatePlan {
  ratePlanId?: string;
  code?: string;
  name?: string;
  roomTypeId?: string;
  baseAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface InforAvailability {
  date?: string;
  roomTypeId?: string;
  available?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface InforGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface InforReservation {
  reservationId?: string;
  confirmationNumber?: string;
  status?: string;
  guest?: InforGuest;
  roomTypeId?: string;
  arrivalDate?: string;
  departureDate?: string;
  totalAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export class InforHMSAdapter implements IPMSAdapter {
  name = 'Infor HMS';

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tenantId: string;
  private readonly hotelId: string;
  private tokenCache?: TokenCache;

  constructor(config: InforHMSAdapterConfig) {
    if (!config.clientId || !config.clientSecret || !config.tenantId || !config.hotelId) {
      throw new Error('InforHMSAdapter requires clientId, clientSecret, tenantId, and hotelId.');
    }
    this.baseUrl = config.baseUrl ?? INFOR_API_BASE;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantId = config.tenantId;
    this.hotelId = config.hotelId;
  }

  async authenticate(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.accessToken;
    }

    const response = await fetch(INFOR_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'hms'
      }).toString()
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new InforHMSApiError(payload.error_description || 'Auth failed', response.status, payload);
    }

    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAt: now + (payload.expires_in || 3600) * 1000
    };
    return this.tokenCache.accessToken;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ hotel?: InforHotel; data?: InforHotel }>(
      `/tenants/${this.tenantId}/hotels/${this.hotelId}`
    );
    const hotel = response.hotel || response.data;
    if (!hotel) throw new Error('Infor HMS: no hotel data returned.');

    const addressParts = [hotel.address?.street, hotel.address?.city, hotel.address?.state, hotel.address?.postalCode, hotel.address?.country].filter(Boolean);

    return {
      id: hotel.hotelId || hotel.hotelCode || this.hotelId,
      name: hotel.name || 'Infor HMS Hotel',
      timezone: hotel.timezone || 'UTC',
      currency: hotel.currency || 'USD',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: InforAvailability[]; data?: InforAvailability[] }>(
      `/tenants/${this.tenantId}/hotels/${this.hotelId}/availability`,
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
    const response = await this.request<{ reservations?: InforReservation[]; data?: InforReservation[] }>(
      `/tenants/${this.tenantId}/hotels/${this.hotelId}/reservations`,
      { startDate: params.startDate, endDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.reservationId || res.confirmationNumber || '',
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
    const response = await this.request<{ roomTypes?: InforRoomType[]; data?: InforRoomType[] }>(
      `/tenants/${this.tenantId}/hotels/${this.hotelId}/roomTypes`
    );
    const roomTypes = response.roomTypes || response.data || [];
    return roomTypes.map(rt => ({
      id: rt.roomTypeId || rt.code || '',
      name: rt.name || '',
      capacity: rt.maxOccupancy || 2,
      description: rt.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<{ ratePlans?: InforRatePlan[]; data?: InforRatePlan[] }>(
      `/tenants/${this.tenantId}/hotels/${this.hotelId}/ratePlans`
    );
    const rates = response.ratePlans || response.data || [];
    return rates.map(rate => ({
      id: rate.ratePlanId || rate.code || '',
      name: rate.name || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.baseAmount || 0,
      currency: rate.currency || 'USD'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}, retry = true): Promise<T> {
    const token = await this.authenticate();
    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Id': this.tenantId
      }
    });

    if (response.status === 401 && retry) {
      await this.authenticate(true);
      return this.request<T>(path, query, false);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new InforHMSApiError(payload.message || `Infor HMS API error (${response.status})`, response.status, payload);
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
