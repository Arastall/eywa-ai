// Eywa AI - Clock PMS Adapter
// Clock PMS - Eastern Europe Market Leader
// Docs: https://clock-software.com/

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

const CLOCK_API_BASE = 'https://api.clock-software.com/v1';

type QueryValue = string | number | boolean | undefined;

export interface ClockPMSAdapterConfig {
  apiKey: string;
  propertyId: string;
  baseUrl?: string;
}

export interface ClockPMSApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  [key: string]: unknown;
}

export class ClockPMSApiError extends Error {
  readonly status: number;
  readonly body?: ClockPMSApiErrorBody;

  constructor(message: string, status: number, body?: ClockPMSApiErrorBody) {
    super(message);
    this.name = 'ClockPMSApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ClockProperty {
  id?: string;
  propertyId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: { street?: string; city?: string; country?: string; postalCode?: string };
  [key: string]: unknown;
}

export interface ClockRoomType {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  maxPersons?: number;
  [key: string]: unknown;
}

export interface ClockRatePlan {
  id?: string;
  code?: string;
  name?: string;
  roomTypeId?: string;
  price?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ClockAvailability {
  date?: string;
  roomTypeId?: string;
  available?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface ClockGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface ClockReservation {
  id?: string;
  confirmationNumber?: string;
  status?: string;
  guest?: ClockGuest;
  roomTypeId?: string;
  arrival?: string;
  departure?: string;
  totalAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export class ClockPMSAdapter implements IPMSAdapter {
  name = 'Clock PMS';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly propertyId: string;

  constructor(config: ClockPMSAdapterConfig) {
    if (!config.apiKey || !config.propertyId) {
      throw new Error('ClockPMSAdapter requires apiKey and propertyId.');
    }
    this.baseUrl = config.baseUrl ?? CLOCK_API_BASE;
    this.apiKey = config.apiKey;
    this.propertyId = config.propertyId;
  }

  async authenticate(): Promise<string> {
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ property?: ClockProperty; data?: ClockProperty }>(
      `/properties/${this.propertyId}`
    );
    const property = response.property || response.data;
    if (!property) throw new Error('Clock PMS: no property data returned.');

    const addressParts = [property.address?.street, property.address?.city, property.address?.postalCode, property.address?.country].filter(Boolean);

    return {
      id: property.id || property.propertyId || this.propertyId,
      name: property.name || 'Clock PMS Property',
      timezone: property.timezone || 'Europe/Sofia',
      currency: property.currency || 'EUR',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: ClockAvailability[]; data?: ClockAvailability[] }>(
      `/properties/${this.propertyId}/availability`,
      { fromDate: params.startDate, toDate: params.endDate, roomTypeId: params.roomTypeId }
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
    const response = await this.request<{ reservations?: ClockReservation[]; data?: ClockReservation[] }>(
      `/properties/${this.propertyId}/reservations`,
      { fromDate: params.startDate, toDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.id || res.confirmationNumber || '',
      guestName: res.guest ? [res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ') : 'Guest',
      roomTypeId: res.roomTypeId || '',
      checkIn: res.arrival || '',
      checkOut: res.departure || '',
      status: res.status || 'confirmed',
      totalAmount: res.totalAmount ?? 0,
      currency: res.currency || 'EUR'
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<{ roomTypes?: ClockRoomType[]; data?: ClockRoomType[] }>(
      `/properties/${this.propertyId}/roomTypes`
    );
    const roomTypes = response.roomTypes || response.data || [];
    return roomTypes.map(rt => ({
      id: rt.id || rt.code || '',
      name: rt.name || '',
      capacity: rt.maxPersons || 2,
      description: rt.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<{ ratePlans?: ClockRatePlan[]; data?: ClockRatePlan[] }>(
      `/properties/${this.propertyId}/ratePlans`
    );
    const rates = response.ratePlans || response.data || [];
    return rates.map(rate => ({
      id: rate.id || rate.code || '',
      name: rate.name || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.price || 0,
      currency: rate.currency || 'EUR'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${this.apiKey}`, 'X-Property-Id': this.propertyId }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ClockPMSApiError(payload.message || `Clock PMS API error (${response.status})`, response.status, payload);
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
