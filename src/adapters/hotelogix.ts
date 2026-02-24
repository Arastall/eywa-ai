// Eywa AI - Hotelogix PMS Adapter
// Hotelogix Cloud PMS - Asia/India Market Leader
// Docs: https://www.hotelogix.com/api-documentation/

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

const HOTELOGIX_API_BASE = 'https://api.hotelogix.com/v1';

type QueryValue = string | number | boolean | undefined;

export interface HotelogixAdapterConfig {
  apiKey: string;
  hotelCode: string;
  baseUrl?: string;
}

export interface HotelogixApiErrorBody {
  error?: string;
  message?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export class HotelogixApiError extends Error {
  readonly status: number;
  readonly body?: HotelogixApiErrorBody;

  constructor(message: string, status: number, body?: HotelogixApiErrorBody) {
    super(message);
    this.name = 'HotelogixApiError';
    this.status = status;
    this.body = body;
  }
}

export interface HotelogixHotel {
  hotelCode?: string;
  hotelId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  [key: string]: unknown;
}

export interface HotelogixRoomType {
  roomTypeId?: string;
  roomTypeCode?: string;
  name?: string;
  description?: string;
  maxOccupancy?: number;
  maxAdults?: number;
  baseRate?: number;
  [key: string]: unknown;
}

export interface HotelogixRatePlan {
  ratePlanId?: string;
  ratePlanCode?: string;
  name?: string;
  description?: string;
  roomTypeId?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface HotelogixAvailabilityItem {
  date?: string;
  roomTypeId?: string;
  available?: number;
  sold?: number;
  blocked?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface HotelogixGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  [key: string]: unknown;
}

export interface HotelogixReservation {
  reservationId?: string;
  bookingNumber?: string;
  status?: string;
  guest?: HotelogixGuest;
  roomTypeId?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  currency?: string;
  adults?: number;
  children?: number;
  source?: string;
  [key: string]: unknown;
}

export class HotelogixAdapter implements IPMSAdapter {
  name = 'Hotelogix';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly hotelCode: string;

  constructor(config: HotelogixAdapterConfig) {
    if (!config.apiKey || !config.hotelCode) {
      throw new Error('HotelogixAdapter requires apiKey and hotelCode.');
    }
    this.baseUrl = config.baseUrl ?? HOTELOGIX_API_BASE;
    this.apiKey = config.apiKey;
    this.hotelCode = config.hotelCode;
  }

  async authenticate(): Promise<string> {
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ hotel?: HotelogixHotel; data?: HotelogixHotel }>(
      `/hotels/${this.hotelCode}`
    );
    const hotel = response.hotel || response.data;
    if (!hotel) throw new Error('Hotelogix: no hotel data returned.');

    const addressParts = [
      hotel.address?.street, hotel.address?.city, 
      hotel.address?.state, hotel.address?.postalCode, hotel.address?.country
    ].filter(Boolean);

    return {
      id: hotel.hotelCode || hotel.hotelId || this.hotelCode,
      name: hotel.name || 'Hotelogix Hotel',
      timezone: hotel.timezone || 'Asia/Kolkata',
      currency: hotel.currency || 'INR',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: HotelogixAvailabilityItem[]; data?: HotelogixAvailabilityItem[] }>(
      `/hotels/${this.hotelCode}/availability`,
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
    const response = await this.request<{ reservations?: HotelogixReservation[]; data?: HotelogixReservation[] }>(
      `/hotels/${this.hotelCode}/reservations`,
      { fromDate: params.startDate, toDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.reservationId || res.bookingNumber || '',
      guestName: res.guest ? [res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ') : 'Guest',
      roomTypeId: res.roomTypeId || '',
      checkIn: res.checkIn || '',
      checkOut: res.checkOut || '',
      status: res.status || 'confirmed',
      totalAmount: res.totalAmount ?? 0,
      currency: res.currency || 'INR'
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<{ roomTypes?: HotelogixRoomType[]; data?: HotelogixRoomType[] }>(
      `/hotels/${this.hotelCode}/roomTypes`
    );
    const roomTypes = response.roomTypes || response.data || [];
    return roomTypes.map(rt => ({
      id: rt.roomTypeId || rt.roomTypeCode || '',
      name: rt.name || '',
      capacity: rt.maxOccupancy || rt.maxAdults || 2,
      description: rt.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<{ ratePlans?: HotelogixRatePlan[]; data?: HotelogixRatePlan[] }>(
      `/hotels/${this.hotelCode}/ratePlans`
    );
    const rates = response.ratePlans || response.data || [];
    return rates.map(rate => ({
      id: rate.ratePlanId || rate.ratePlanCode || '',
      name: rate.name || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.amount || 0,
      currency: rate.currency || 'INR'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-Api-Key': this.apiKey, 'X-Hotel-Code': this.hotelCode }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload as HotelogixApiErrorBody;
      throw new HotelogixApiError(error.message || `Hotelogix API error (${response.status})`, response.status, error);
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
