// Eywa AI - Little Hotelier PMS Adapter
// Little Hotelier - Small Hotels & B&Bs
// Docs: https://www.littlehotelier.com/

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

const LITTLE_HOTELIER_API_BASE = 'https://api.littlehotelier.com/v1';

type QueryValue = string | number | boolean | undefined;

export interface LittleHotelierAdapterConfig {
  apiKey: string;
  propertyId: string;
  baseUrl?: string;
}

export interface LittleHotelierApiErrorBody {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export class LittleHotelierApiError extends Error {
  readonly status: number;
  readonly body?: LittleHotelierApiErrorBody;

  constructor(message: string, status: number, body?: LittleHotelierApiErrorBody) {
    super(message);
    this.name = 'LittleHotelierApiError';
    this.status = status;
    this.body = body;
  }
}

export interface LittleHotelierProperty {
  id?: string;
  propertyId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: { street?: string; city?: string; country?: string; postcode?: string };
  [key: string]: unknown;
}

export interface LittleHotelierRoomType {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  maxGuests?: number;
  [key: string]: unknown;
}

export interface LittleHotelierRate {
  id?: string;
  code?: string;
  name?: string;
  roomTypeId?: string;
  price?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface LittleHotelierAvailability {
  date?: string;
  roomTypeId?: string;
  available?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface LittleHotelierGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface LittleHotelierReservation {
  id?: string;
  bookingReference?: string;
  status?: string;
  guest?: LittleHotelierGuest;
  roomTypeId?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export class LittleHotelierAdapter implements IPMSAdapter {
  name = 'Little Hotelier';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly propertyId: string;

  constructor(config: LittleHotelierAdapterConfig) {
    if (!config.apiKey || !config.propertyId) {
      throw new Error('LittleHotelierAdapter requires apiKey and propertyId.');
    }
    this.baseUrl = config.baseUrl ?? LITTLE_HOTELIER_API_BASE;
    this.apiKey = config.apiKey;
    this.propertyId = config.propertyId;
  }

  async authenticate(): Promise<string> {
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ property?: LittleHotelierProperty; data?: LittleHotelierProperty }>(
      `/properties/${this.propertyId}`
    );
    const property = response.property || response.data;
    if (!property) throw new Error('Little Hotelier: no property data returned.');

    const addressParts = [property.address?.street, property.address?.city, property.address?.postcode, property.address?.country].filter(Boolean);

    return {
      id: property.id || property.propertyId || this.propertyId,
      name: property.name || 'Little Hotelier Property',
      timezone: property.timezone || 'Australia/Sydney',
      currency: property.currency || 'AUD',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: LittleHotelierAvailability[]; data?: LittleHotelierAvailability[] }>(
      `/properties/${this.propertyId}/availability`,
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
    const response = await this.request<{ reservations?: LittleHotelierReservation[]; data?: LittleHotelierReservation[] }>(
      `/properties/${this.propertyId}/reservations`,
      { startDate: params.startDate, endDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.id || res.bookingReference || '',
      guestName: res.guest ? [res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ') : 'Guest',
      roomTypeId: res.roomTypeId || '',
      checkIn: res.checkIn || '',
      checkOut: res.checkOut || '',
      status: res.status || 'confirmed',
      totalAmount: res.totalAmount ?? 0,
      currency: res.currency || 'AUD'
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<{ roomTypes?: LittleHotelierRoomType[]; data?: LittleHotelierRoomType[] }>(
      `/properties/${this.propertyId}/roomTypes`
    );
    const roomTypes = response.roomTypes || response.data || [];
    return roomTypes.map(rt => ({
      id: rt.id || rt.code || '',
      name: rt.name || '',
      capacity: rt.maxGuests || 2,
      description: rt.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<{ rates?: LittleHotelierRate[]; data?: LittleHotelierRate[] }>(
      `/properties/${this.propertyId}/rates`
    );
    const rates = response.rates || response.data || [];
    return rates.map(rate => ({
      id: rate.id || rate.code || '',
      name: rate.name || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.price || 0,
      currency: rate.currency || 'AUD'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-API-Key': this.apiKey }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new LittleHotelierApiError(payload.message || `Little Hotelier API error (${response.status})`, response.status, payload);
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
