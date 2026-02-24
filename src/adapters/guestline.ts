// Eywa AI - Guestline PMS Adapter
// Guestline Rezlynx PMS REST API - UK/Ireland Market Leader
// Docs: https://guestline.com/

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

const GUESTLINE_API_BASE = 'https://api.guestline.com/v1';

type QueryValue = string | number | boolean | undefined;

export interface GuestlineAdapterConfig {
  apiKey: string;
  siteId: string;
  baseUrl?: string;
  environment?: 'sandbox' | 'production';
}

export interface GuestlineApiErrorBody {
  error?: string;
  message?: string;
  errorCode?: string;
  details?: string[];
  [key: string]: unknown;
}

export class GuestlineApiError extends Error {
  readonly status: number;
  readonly body?: GuestlineApiErrorBody;

  constructor(message: string, status: number, body?: GuestlineApiErrorBody) {
    super(message);
    this.name = 'GuestlineApiError';
    this.status = status;
    this.body = body;
  }
}

// Guestline-specific response types
export interface GuestlineSite {
  siteId?: string;
  siteCode?: string;
  name?: string;
  siteName?: string;
  timezone?: string;
  currency?: string;
  currencyCode?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
  [key: string]: unknown;
}

export interface GuestlineSiteResponse {
  site?: GuestlineSite;
  data?: GuestlineSite;
  [key: string]: unknown;
}

export interface GuestlineRoomType {
  roomTypeId?: string;
  roomTypeCode?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  maxOccupancy?: number;
  maxAdults?: number;
  maxChildren?: number;
  bedType?: string;
  [key: string]: unknown;
}

export interface GuestlineRoomTypesResponse {
  roomTypes?: GuestlineRoomType[];
  data?: GuestlineRoomType[];
  [key: string]: unknown;
}

export interface GuestlineRateCode {
  rateCodeId?: string;
  rateCode?: string;
  name?: string;
  description?: string;
  roomTypeId?: string;
  amount?: number;
  currency?: string;
  mealBasis?: string;
  [key: string]: unknown;
}

export interface GuestlineRateCodesResponse {
  rateCodes?: GuestlineRateCode[];
  data?: GuestlineRateCode[];
  [key: string]: unknown;
}

export interface GuestlineAvailabilityItem {
  date?: string;
  roomTypeId?: string;
  roomTypeCode?: string;
  available?: number;
  remaining?: number;
  sold?: number;
  rate?: number;
  rateAmount?: number;
  currency?: string;
  restrictions?: {
    closed?: boolean;
    minStay?: number;
    maxStay?: number;
  };
  [key: string]: unknown;
}

export interface GuestlineAvailabilityResponse {
  availability?: GuestlineAvailabilityItem[];
  data?: GuestlineAvailabilityItem[];
  [key: string]: unknown;
}

export interface GuestlineGuest {
  title?: string;
  forename?: string;
  surname?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  nationality?: string;
  [key: string]: unknown;
}

export interface GuestlineReservation {
  reservationId?: string;
  bookingRef?: string;
  confirmationNumber?: string;
  status?: string;
  reservationStatus?: string;
  guest?: GuestlineGuest;
  leadGuest?: GuestlineGuest;
  roomTypeId?: string;
  roomTypeCode?: string;
  roomNumber?: string;
  arrival?: string;
  arrivalDate?: string;
  departure?: string;
  departureDate?: string;
  nights?: number;
  totalAmount?: number;
  totalValue?: number;
  currency?: string;
  adults?: number;
  children?: number;
  source?: string;
  channel?: string;
  rateCode?: string;
  createdDate?: string;
  [key: string]: unknown;
}

export interface GuestlineReservationsResponse {
  reservations?: GuestlineReservation[];
  bookings?: GuestlineReservation[];
  data?: GuestlineReservation[];
  pagination?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
  [key: string]: unknown;
}

export class GuestlineAdapter implements IPMSAdapter {
  name = 'Guestline';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly siteId: string;

  constructor(config: GuestlineAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('GuestlineAdapter requires apiKey.');
    }
    if (!config.siteId) {
      throw new Error('GuestlineAdapter requires siteId.');
    }

    const envPrefix = config.environment === 'sandbox' ? 'sandbox-' : '';
    this.baseUrl = config.baseUrl ?? `https://${envPrefix}api.guestline.com/v1`;
    this.apiKey = config.apiKey;
    this.siteId = config.siteId;
  }

  async authenticate(): Promise<string> {
    // Guestline uses API key authentication
    return this.apiKey;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<GuestlineSiteResponse>(
      `/sites/${this.siteId}`
    );

    const site = response.site || response.data;

    if (!site) {
      throw new Error('Guestline getConfiguration failed: no site data returned.');
    }

    const addressParts = [
      site.address?.line1,
      site.address?.line2,
      site.address?.city,
      site.address?.county,
      site.address?.postcode,
      site.address?.country
    ].filter(Boolean);

    return {
      id: site.siteId || site.siteCode || this.siteId,
      name: site.name || site.siteName || 'Guestline Site',
      timezone: site.timezone || 'Europe/London',
      currency: site.currency || site.currencyCode || 'GBP',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const query: Record<string, QueryValue> = {
      fromDate: params.startDate,
      toDate: params.endDate,
      roomTypeId: params.roomTypeId
    };

    const response = await this.request<GuestlineAvailabilityResponse>(
      `/sites/${this.siteId}/availability`,
      query
    );

    const availabilities = response.availability || response.data || [];

    return availabilities.map((item) => ({
      date: item.date || params.startDate,
      roomTypeId: item.roomTypeId || item.roomTypeCode || params.roomTypeId || '',
      available: item.available ?? item.remaining ?? 0,
      rate: item.rate ?? item.rateAmount ?? 0
    }));
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const query: Record<string, QueryValue> = {
      fromDate: params.startDate,
      toDate: params.endDate,
      status: params.status
    };

    const response = await this.request<GuestlineReservationsResponse>(
      `/sites/${this.siteId}/reservations`,
      query
    );

    const reservations = response.reservations || response.bookings || response.data || [];

    return reservations.map((res) => {
      const guest = res.guest || res.leadGuest;
      const guestName = guest
        ? [guest.title, guest.forename, guest.surname].filter(Boolean).join(' ')
        : 'Guest';

      return {
        id: res.reservationId || res.bookingRef || res.confirmationNumber || '',
        guestName,
        roomTypeId: res.roomTypeId || res.roomTypeCode || '',
        checkIn: res.arrival || res.arrivalDate || '',
        checkOut: res.departure || res.departureDate || '',
        status: res.status || res.reservationStatus || 'confirmed',
        totalAmount: res.totalAmount ?? res.totalValue ?? 0,
        currency: res.currency || 'GBP'
      };
    });
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<GuestlineRoomTypesResponse>(
      `/sites/${this.siteId}/roomTypes`
    );

    const roomTypes = response.roomTypes || response.data || [];

    return roomTypes.map((rt) => ({
      id: rt.roomTypeId || rt.roomTypeCode || '',
      name: rt.name || '',
      capacity: rt.maxOccupancy || rt.maxAdults || 2,
      description: rt.description || rt.shortDescription
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<GuestlineRateCodesResponse>(
      `/sites/${this.siteId}/rateCodes`
    );

    const rates = response.rateCodes || response.data || [];

    return rates.map((rate) => ({
      id: rate.rateCodeId || rate.rateCode || '',
      name: rate.name || rate.rateCode || 'Rate',
      roomTypeId: rate.roomTypeId || '',
      price: rate.amount || 0,
      currency: rate.currency || 'GBP'
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
        'X-Api-Key': this.apiKey,
        'X-Site-Id': this.siteId
      }
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as GuestlineApiErrorBody;
      const message = error.message || error.error || 
        error.details?.[0] ||
        `Guestline API request failed (${response.status}).`;
      throw new GuestlineApiError(message, response.status, error);
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
      throw new GuestlineApiError('Guestline API returned a non-JSON response.', response.status);
    }
  }
}
