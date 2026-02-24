// Eywa AI - eZee PMS Adapter
// eZee Technosys - Asia/Budget Hotel Market
// Docs: https://www.ezeetechnosys.com/

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

const EZEE_API_BASE = 'https://api.ezeetechnosys.com/v1';

type QueryValue = string | number | boolean | undefined;

export interface EzeeAdapterConfig {
  apiKey: string;
  hotelCode: string;
  baseUrl?: string;
}

export interface EzeeApiErrorBody {
  error?: string;
  message?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export class EzeeApiError extends Error {
  readonly status: number;
  readonly body?: EzeeApiErrorBody;

  constructor(message: string, status: number, body?: EzeeApiErrorBody) {
    super(message);
    this.name = 'EzeeApiError';
    this.status = status;
    this.body = body;
  }
}

export interface EzeeHotel {
  hotelCode?: string;
  hotelId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: { street?: string; city?: string; state?: string; country?: string; pincode?: string };
  [key: string]: unknown;
}

export interface EzeeRoomType {
  roomTypeId?: string;
  roomTypeCode?: string;
  name?: string;
  description?: string;
  maxOccupancy?: number;
  baseRate?: number;
  [key: string]: unknown;
}

export interface EzeeRatePlan {
  ratePlanId?: string;
  ratePlanCode?: string;
  name?: string;
  roomTypeId?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface EzeeAvailability {
  date?: string;
  roomTypeId?: string;
  available?: number;
  sold?: number;
  rate?: number;
  [key: string]: unknown;
}

export interface EzeeGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  nationality?: string;
  [key: string]: unknown;
}

export interface EzeeReservation {
  reservationId?: string;
  bookingNo?: string;
  status?: string;
  guest?: EzeeGuest;
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

export class EzeeAdapter implements IPMSAdapter {
  name = 'eZee';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly hotelCode: string;

  constructor(config: EzeeAdapterConfig) {
    if (!config.apiKey || !config.hotelCode) {
      throw new Error('EzeeAdapter requires apiKey and hotelCode.');
    }
    this.baseUrl = config.baseUrl ?? EZEE_API_BASE;
    this.apiKey = config.apiKey;
    this.hotelCode = config.hotelCode;
  }

  async authenticate(): Promise<string> {
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<{ hotel?: EzeeHotel; data?: EzeeHotel }>(
      `/hotels/${this.hotelCode}`
    );
    const hotel = response.hotel || response.data;
    if (!hotel) throw new Error('eZee: no hotel data returned.');

    const addressParts = [hotel.address?.street, hotel.address?.city, hotel.address?.state, hotel.address?.pincode, hotel.address?.country].filter(Boolean);

    return {
      id: hotel.hotelCode || hotel.hotelId || this.hotelCode,
      name: hotel.name || 'eZee Hotel',
      timezone: hotel.timezone || 'Asia/Kolkata',
      currency: hotel.currency || 'INR',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ availability?: EzeeAvailability[]; data?: EzeeAvailability[] }>(
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
    const response = await this.request<{ reservations?: EzeeReservation[]; data?: EzeeReservation[] }>(
      `/hotels/${this.hotelCode}/reservations`,
      { fromDate: params.startDate, toDate: params.endDate, status: params.status }
    );
    const reservations = response.reservations || response.data || [];
    return reservations.map(res => ({
      id: res.reservationId || res.bookingNo || '',
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
    const response = await this.request<{ roomTypes?: EzeeRoomType[]; data?: EzeeRoomType[] }>(
      `/hotels/${this.hotelCode}/roomTypes`
    );
    const roomTypes = response.roomTypes || response.data || [];
    return roomTypes.map(rt => ({
      id: rt.roomTypeId || rt.roomTypeCode || '',
      name: rt.name || '',
      capacity: rt.maxOccupancy || 2,
      description: rt.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<{ ratePlans?: EzeeRatePlan[]; data?: EzeeRatePlan[] }>(
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
      throw new EzeeApiError(payload.message || `eZee API error (${response.status})`, response.status, payload);
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
