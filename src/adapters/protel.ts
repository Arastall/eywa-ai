// Eywa AI - Protel PMS Adapter (Planet/Protel Cloud)
// Protel REST API for European hotel market
// Docs: https://www.protel.net/

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

const PROTEL_API_BASE = 'https://api.protel.net/v1';
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type QueryValue = string | number | boolean | undefined;

export interface ProtelAdapterConfig {
  apiKey: string;
  hotelCode: string;
  baseUrl?: string;
  environment?: 'sandbox' | 'production';
}

export interface ProtelApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  [key: string]: unknown;
}

export class ProtelApiError extends Error {
  readonly status: number;
  readonly body?: ProtelApiErrorBody;

  constructor(message: string, status: number, body?: ProtelApiErrorBody) {
    super(message);
    this.name = 'ProtelApiError';
    this.status = status;
    this.body = body;
  }
}

// Protel-specific response types
export interface ProtelHotel {
  hotelCode?: string;
  hotelId?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
  };
  [key: string]: unknown;
}

export interface ProtelHotelResponse {
  hotel?: ProtelHotel;
  data?: ProtelHotel;
  [key: string]: unknown;
}

export interface ProtelRoomCategory {
  categoryCode?: string;
  categoryId?: string;
  name?: string;
  shortName?: string;
  description?: string;
  maxPersons?: number;
  maxAdults?: number;
  bedConfiguration?: string;
  [key: string]: unknown;
}

export interface ProtelRoomCategoriesResponse {
  roomCategories?: ProtelRoomCategory[];
  categories?: ProtelRoomCategory[];
  data?: ProtelRoomCategory[];
  [key: string]: unknown;
}

export interface ProtelRateCode {
  rateCode?: string;
  rateId?: string;
  name?: string;
  description?: string;
  categoryCode?: string;
  basePrice?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ProtelRateCodesResponse {
  rateCodes?: ProtelRateCode[];
  rates?: ProtelRateCode[];
  data?: ProtelRateCode[];
  [key: string]: unknown;
}

export interface ProtelAvailabilityItem {
  date?: string;
  categoryCode?: string;
  roomCategory?: string;
  available?: number;
  freeRooms?: number;
  totalRooms?: number;
  price?: number;
  rateAmount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ProtelAvailabilityResponse {
  availability?: ProtelAvailabilityItem[];
  data?: ProtelAvailabilityItem[];
  [key: string]: unknown;
}

export interface ProtelGuest {
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  [key: string]: unknown;
}

export interface ProtelReservation {
  reservationId?: string;
  reservationNumber?: string;
  bookingNumber?: string;
  status?: string;
  reservationStatus?: string;
  guest?: ProtelGuest;
  mainGuest?: ProtelGuest;
  roomCategory?: string;
  categoryCode?: string;
  arrival?: string;
  arrivalDate?: string;
  departure?: string;
  departureDate?: string;
  totalAmount?: number;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  source?: string;
  channel?: string;
  [key: string]: unknown;
}

export interface ProtelReservationsResponse {
  reservations?: ProtelReservation[];
  bookings?: ProtelReservation[];
  data?: ProtelReservation[];
  pagination?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
  [key: string]: unknown;
}

export class ProtelAdapter implements IPMSAdapter {
  name = 'Protel';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly hotelCode: string;

  constructor(config: ProtelAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('ProtelAdapter requires apiKey.');
    }
    if (!config.hotelCode) {
      throw new Error('ProtelAdapter requires hotelCode.');
    }

    const envPrefix = config.environment === 'sandbox' ? 'sandbox-' : '';
    this.baseUrl = config.baseUrl ?? `https://${envPrefix}api.protel.net/v1`;
    this.apiKey = config.apiKey;
    this.hotelCode = config.hotelCode;
  }

  async authenticate(): Promise<string> {
    // Protel uses API key authentication, no OAuth flow needed
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<ProtelHotelResponse>(
      `/hotels/${this.hotelCode}`
    );

    const hotel = response.hotel || response.data;

    if (!hotel) {
      throw new Error('Protel getConfiguration failed: no hotel data returned.');
    }

    const addressParts = [
      hotel.address?.street,
      hotel.address?.city,
      hotel.address?.postalCode,
      hotel.address?.country
    ].filter(Boolean);

    return {
      id: hotel.hotelCode || hotel.hotelId || this.hotelCode,
      name: hotel.name || 'Protel Hotel',
      timezone: hotel.timezone || 'Europe/Berlin',
      currency: hotel.currency || 'EUR',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const query: Record<string, QueryValue> = {
      fromDate: params.startDate,
      toDate: params.endDate,
      categoryCode: params.roomTypeId
    };

    const response = await this.request<ProtelAvailabilityResponse>(
      `/hotels/${this.hotelCode}/availability`,
      query
    );

    const availabilities = response.availability || response.data || [];

    return availabilities.map((item) => ({
      date: item.date || params.startDate,
      roomTypeId: item.categoryCode || item.roomCategory || params.roomTypeId || '',
      available: item.available ?? item.freeRooms ?? 0,
      rate: item.price ?? item.rateAmount ?? 0
    }));
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const query: Record<string, QueryValue> = {
      fromDate: params.startDate,
      toDate: params.endDate,
      status: params.status
    };

    const response = await this.request<ProtelReservationsResponse>(
      `/hotels/${this.hotelCode}/reservations`,
      query
    );

    const reservations = response.reservations || response.bookings || response.data || [];

    return reservations.map((res) => {
      const guest = res.guest || res.mainGuest;
      const guestName = guest
        ? [guest.title, guest.firstName, guest.lastName].filter(Boolean).join(' ')
        : 'Guest';

      return {
        id: res.reservationId || res.reservationNumber || res.bookingNumber || '',
        guestName,
        roomTypeId: res.roomCategory || res.categoryCode || '',
        checkIn: res.arrival || res.arrivalDate || '',
        checkOut: res.departure || res.departureDate || '',
        status: res.status || res.reservationStatus || 'confirmed',
        totalAmount: res.totalAmount ?? res.totalPrice ?? 0,
        currency: res.currency || 'EUR'
      };
    });
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<ProtelRoomCategoriesResponse>(
      `/hotels/${this.hotelCode}/roomCategories`
    );

    const categories = response.roomCategories || response.categories || response.data || [];

    return categories.map((cat) => ({
      id: cat.categoryCode || cat.categoryId || '',
      name: cat.name || cat.shortName || '',
      capacity: cat.maxPersons || cat.maxAdults || 2,
      description: cat.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<ProtelRateCodesResponse>(
      `/hotels/${this.hotelCode}/rateCodes`
    );

    const rates = response.rateCodes || response.rates || response.data || [];

    return rates.map((rate) => ({
      id: rate.rateCode || rate.rateId || '',
      name: rate.name || rate.rateCode || 'Rate',
      roomTypeId: rate.categoryCode || '',
      price: rate.basePrice || 0,
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
        'X-API-Key': this.apiKey,
        'X-Hotel-Code': this.hotelCode
      }
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as ProtelApiErrorBody;
      const message = error.message || error.error || error.details ||
        `Protel API request failed (${response.status}).`;
      throw new ProtelApiError(message, response.status, error);
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
      throw new ProtelApiError('Protel API returned a non-JSON response.', response.status);
    }
  }
}
