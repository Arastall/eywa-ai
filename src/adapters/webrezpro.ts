// Eywa AI - WebRezPro PMS Adapter
// WebRezPro - US Independent Hotels
// Docs: https://www.webrezpro.com/

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

const WEBREZPRO_API_BASE = 'https://api.webrezpro.com/v1';

type QueryValue = string | number | boolean | undefined;

export interface WebRezProAdapterConfig {
  apiKey: string;
  propertyCode: string;
  baseUrl?: string;
}

export interface WebRezProApiErrorBody {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export class WebRezProApiError extends Error {
  readonly status: number;
  readonly body?: WebRezProApiErrorBody;

  constructor(message: string, status: number, body?: WebRezProApiErrorBody) {
    super(message);
    this.name = 'WebRezProApiError';
    this.status = status;
    this.body = body;
  }
}

export interface WebRezProProperty {
  propertyCode?: string;
  propertyId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
  [key: string]: unknown;
}

export interface WebRezProRoomType {
  roomTypeId?: string;
  code?: string;
  name?: string;
  description?: string;
  maxOccupancy?: number;
  [key: string]: unknown;
}

export interface WebRezProRate {
  rateId?: string;
  code?: string;
  name?: string;
  roomTypeId?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface WebRezProAvailability {
  date?: string;
  roomTypeId?: string;
  available?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface WebRezProGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface WebRezProReservation {
  reservationId?: string;
  confirmationNumber?: string;
  status?: string;
  guest?: WebRezProGuest;
  roomTypeId?: string;
  arrival?: string;
  departure?: string;
  totalAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export class WebRezProAdapter implements IPMSAdapter {
  name = 'WebRezPro';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly propertyCode: string;

  constructor(config: WebRezProAdapterConfig) {
    if (!config.apiKey || !config.propertyCode) {
      throw new Error('WebRezProAdapter requires apiKey and propertyCode.');
    }
    this.baseUrl = config.baseUrl ?? WEBREZPRO_API_BASE;
    this.apiKey = config.apiKey;
    this.propertyCode = config.propertyCode;
  }

  async authenticate(): Promise<string> {
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ property?: WebRezProProperty; data?: WebRezProProperty }>(
      `/properties/${this.propertyCode}`
    );
    const property = response.property || response.data;
    if (!property) throw new Error('WebRezPro: no property data returned.');

    const addressParts = [property.address?.street, property.address?.city, property.address?.state, property.address?.zip, property.address?.country].filter(Boolean);

    return {
      id: property.propertyCode || property.propertyId || this.propertyCode,
      name: property.name || 'WebRezPro Property',
      timezone: property.timezone || 'America/New_York',
      currency: property.currency || 'USD',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: WebRezProAvailability[]; data?: WebRezProAvailability[] }>(
      `/properties/${this.propertyCode}/availability`,
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
    const response = await this.request<{ reservations?: WebRezProReservation[]; data?: WebRezProReservation[] }>(
      `/properties/${this.propertyCode}/reservations`,
      { startDate: params.startDate, endDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.reservationId || res.confirmationNumber || '',
      guestName: res.guest ? [res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ') : 'Guest',
      roomTypeId: res.roomTypeId || '',
      checkIn: res.arrival || '',
      checkOut: res.departure || '',
      status: res.status || 'confirmed',
      totalAmount: res.totalAmount ?? 0,
      currency: res.currency || 'USD'
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<{ roomTypes?: WebRezProRoomType[]; data?: WebRezProRoomType[] }>(
      `/properties/${this.propertyCode}/roomTypes`
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
    const response = await this.request<{ rates?: WebRezProRate[]; data?: WebRezProRate[] }>(
      `/properties/${this.propertyCode}/rates`
    );
    const rates = response.rates || response.data || [];
    return rates.map(rate => ({
      id: rate.rateId || rate.code || '',
      name: rate.name || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.amount || 0,
      currency: rate.currency || 'USD'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${this.apiKey}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new WebRezProApiError(payload.message || `WebRezPro API error (${response.status})`, response.status, payload);
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
