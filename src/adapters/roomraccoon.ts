// Eywa AI - RoomRaccoon PMS Adapter
// RoomRaccoon Hotel Management Software REST API
// Docs: https://roomraccoon.com/api

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

const ROOMRACCOON_API_BASE = 'https://api.roomraccoon.com/v2';
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type QueryValue = string | number | boolean | undefined;

export interface RoomRaccoonAdapterConfig {
  apiKey: string;
  propertyId: string;
  baseUrl?: string;
}

export interface RoomRaccoonApiErrorBody {
  error?: string;
  message?: string;
  code?: number;
  errors?: Array<{ field: string; message: string }>;
  [key: string]: unknown;
}

export class RoomRaccoonApiError extends Error {
  readonly status: number;
  readonly body?: RoomRaccoonApiErrorBody;

  constructor(message: string, status: number, body?: RoomRaccoonApiErrorBody) {
    super(message);
    this.name = 'RoomRaccoonApiError';
    this.status = status;
    this.body = body;
  }
}

// RoomRaccoon-specific response types
export interface RoomRaccoonProperty {
  id?: string;
  propertyId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
  };
  starRating?: number;
  [key: string]: unknown;
}

export interface RoomRaccoonPropertyResponse {
  property?: RoomRaccoonProperty;
  data?: RoomRaccoonProperty;
  [key: string]: unknown;
}

export interface RoomRaccoonRoom {
  id?: string;
  roomId?: string;
  roomTypeId?: string;
  name?: string;
  shortName?: string;
  description?: string;
  maxOccupancy?: number;
  maxAdults?: number;
  maxChildren?: number;
  amenities?: string[];
  images?: string[];
  [key: string]: unknown;
}

export interface RoomRaccoonRoomsResponse {
  rooms?: RoomRaccoonRoom[];
  roomTypes?: RoomRaccoonRoom[];
  data?: RoomRaccoonRoom[];
  meta?: { total?: number };
  [key: string]: unknown;
}

export interface RoomRaccoonRatePlan {
  id?: string;
  rateId?: string;
  name?: string;
  code?: string;
  description?: string;
  roomTypeId?: string;
  baseRate?: number;
  currency?: string;
  mealPlan?: string;
  cancellationPolicy?: string;
  [key: string]: unknown;
}

export interface RoomRaccoonRatesResponse {
  rates?: RoomRaccoonRatePlan[];
  ratePlans?: RoomRaccoonRatePlan[];
  data?: RoomRaccoonRatePlan[];
  [key: string]: unknown;
}

export interface RoomRaccoonAvailabilityItem {
  date?: string;
  roomTypeId?: string;
  roomId?: string;
  available?: number;
  inventory?: number;
  booked?: number;
  blocked?: number;
  rate?: number;
  price?: number;
  minStay?: number;
  [key: string]: unknown;
}

export interface RoomRaccoonAvailabilityResponse {
  availability?: RoomRaccoonAvailabilityItem[];
  data?: RoomRaccoonAvailabilityItem[];
  calendar?: Array<{
    date: string;
    rooms: RoomRaccoonAvailabilityItem[];
  }>;
  [key: string]: unknown;
}

export interface RoomRaccoonGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  [key: string]: unknown;
}

export interface RoomRaccoonBooking {
  id?: string;
  bookingId?: string;
  reservationId?: string;
  confirmationCode?: string;
  status?: string;
  guest?: RoomRaccoonGuest;
  guestDetails?: RoomRaccoonGuest;
  roomTypeId?: string;
  roomId?: string;
  checkIn?: string;
  checkOut?: string;
  arrivalDate?: string;
  departureDate?: string;
  totalAmount?: number;
  total?: number;
  currency?: string;
  adults?: number;
  children?: number;
  source?: string;
  channel?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface RoomRaccoonBookingsResponse {
  bookings?: RoomRaccoonBooking[];
  reservations?: RoomRaccoonBooking[];
  data?: RoomRaccoonBooking[];
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
  };
  [key: string]: unknown;
}

export class RoomRaccoonAdapter implements IPMSAdapter {
  name = 'RoomRaccoon';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly propertyId: string;

  constructor(config: RoomRaccoonAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('RoomRaccoonAdapter requires apiKey.');
    }
    if (!config.propertyId) {
      throw new Error('RoomRaccoonAdapter requires propertyId.');
    }

    this.baseUrl = config.baseUrl ?? ROOMRACCOON_API_BASE;
    this.apiKey = config.apiKey;
    this.propertyId = config.propertyId;
  }

  async authenticate(): Promise<string> {
    // RoomRaccoon uses API key authentication
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<RoomRaccoonPropertyResponse>(
      `/properties/${this.propertyId}`
    );

    const property = response.property || response.data;

    if (!property) {
      throw new Error('RoomRaccoon getConfiguration failed: no property data returned.');
    }

    const addressParts = [
      property.address?.street,
      property.address?.city,
      property.address?.postalCode,
      property.address?.country
    ].filter(Boolean);

    return {
      id: property.id || property.propertyId || this.propertyId,
      name: property.name || 'RoomRaccoon Property',
      timezone: property.timezone || 'Europe/Amsterdam',
      currency: property.currency || 'EUR',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const query: Record<string, QueryValue> = {
      startDate: params.startDate,
      endDate: params.endDate,
      roomTypeId: params.roomTypeId
    };

    const response = await this.request<RoomRaccoonAvailabilityResponse>(
      `/properties/${this.propertyId}/availability`,
      query
    );

    const availabilities: Availability[] = [];

    // Format 1: Direct availability array
    const items = response.availability || response.data || [];
    for (const item of items) {
      availabilities.push({
        date: item.date || params.startDate,
        roomTypeId: item.roomTypeId || item.roomId || params.roomTypeId || '',
        available: item.available ?? (item.inventory ?? 0) - (item.booked ?? 0) - (item.blocked ?? 0),
        rate: item.rate ?? item.price ?? 0
      });
    }

    // Format 2: Calendar format
    if (response.calendar) {
      for (const day of response.calendar) {
        for (const room of day.rooms) {
          availabilities.push({
            date: day.date,
            roomTypeId: room.roomTypeId || room.roomId || '',
            available: room.available ?? 0,
            rate: room.rate ?? room.price ?? 0
          });
        }
      }
    }

    return availabilities;
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const query: Record<string, QueryValue> = {
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status
    };

    const response = await this.request<RoomRaccoonBookingsResponse>(
      `/properties/${this.propertyId}/bookings`,
      query
    );

    const bookings = response.bookings || response.reservations || response.data || [];

    return bookings.map((booking) => {
      const guest = booking.guest || booking.guestDetails;
      const guestName = guest
        ? [guest.firstName, guest.lastName].filter(Boolean).join(' ')
        : 'Guest';

      return {
        id: booking.id || booking.bookingId || booking.reservationId || booking.confirmationCode || '',
        guestName,
        roomTypeId: booking.roomTypeId || booking.roomId || '',
        checkIn: booking.checkIn || booking.arrivalDate || '',
        checkOut: booking.checkOut || booking.departureDate || '',
        status: booking.status || 'confirmed',
        totalAmount: booking.totalAmount ?? booking.total ?? 0,
        currency: booking.currency || 'EUR'
      };
    });
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<RoomRaccoonRoomsResponse>(
      `/properties/${this.propertyId}/rooms`
    );

    const rooms = response.rooms || response.roomTypes || response.data || [];

    return rooms.map((room) => ({
      id: room.id || room.roomId || room.roomTypeId || '',
      name: room.name || room.shortName || '',
      capacity: room.maxOccupancy || room.maxAdults || 2,
      description: room.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<RoomRaccoonRatesResponse>(
      `/properties/${this.propertyId}/rates`
    );

    const rates = response.rates || response.ratePlans || response.data || [];

    return rates.map((rate) => ({
      id: rate.id || rate.rateId || rate.code || '',
      name: rate.name || rate.code || 'Rate Plan',
      roomTypeId: rate.roomTypeId || '',
      price: rate.baseRate || 0,
      currency: rate.currency || 'EUR'
    }));
  }

  private async request<T>(
    path: string,
    query: Record<string, QueryValue> = {}
  ): Promise<T> {
    const url = this.buildUrl(path, query);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Property-Id': this.propertyId
      }
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as RoomRaccoonApiErrorBody;
      const message = error.message || error.error ||
        error.errors?.[0]?.message ||
        `RoomRaccoon API request failed (${response.status}).`;
      throw new RoomRaccoonApiError(message, response.status, error);
    }

    return payload as T;
  }

  private buildUrl(path: string, query: Record<string, QueryValue>): string {
    const searchParams = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    return queryString
      ? `${this.baseUrl}${fullPath}?${queryString}`
      : `${this.baseUrl}${fullPath}`;
  }

  private async safeJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new RoomRaccoonApiError('RoomRaccoon API returned a non-JSON response.', response.status);
    }
  }
}
