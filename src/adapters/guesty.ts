// Eywa AI - Guesty PMS Adapter
// Guesty - Vacation Rental Property Management
// Docs: https://docs.guesty.com/

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

const GUESTY_API_BASE = 'https://api.guesty.com/api/v2';
const GUESTY_AUTH_URL = 'https://oauth.guesty.com/oauth2/token';

type QueryValue = string | number | boolean | undefined;

export interface GuestyAdapterConfig {
  clientId: string;
  clientSecret: string;
  accountId?: string;
  baseUrl?: string;
}

export interface GuestyApiErrorBody {
  error?: string;
  message?: string;
  error_description?: string;
  [key: string]: unknown;
}

export class GuestyApiError extends Error {
  readonly status: number;
  readonly body?: GuestyApiErrorBody;

  constructor(message: string, status: number, body?: GuestyApiErrorBody) {
    super(message);
    this.name = 'GuestyApiError';
    this.status = status;
    this.body = body;
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface GuestyListing {
  _id?: string;
  id?: string;
  title?: string;
  nickname?: string;
  timezone?: string;
  currency?: string;
  address?: {
    full?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipcode?: string;
  };
  accommodates?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  [key: string]: unknown;
}

export interface GuestyCalendarDay {
  date?: string;
  listingId?: string;
  status?: string;
  price?: number;
  available?: boolean;
  booked?: boolean;
  blocked?: boolean;
  [key: string]: unknown;
}

export interface GuestyGuest {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface GuestyReservation {
  _id?: string;
  id?: string;
  confirmationCode?: string;
  status?: string;
  guest?: GuestyGuest;
  guestId?: string;
  listingId?: string;
  checkIn?: string;
  checkOut?: string;
  checkInDateLocalized?: string;
  checkOutDateLocalized?: string;
  money?: {
    totalPaid?: number;
    hostPayout?: number;
    currency?: string;
  };
  guests?: { adults?: number; children?: number };
  source?: string;
  [key: string]: unknown;
}

export class GuestyAdapter implements IPMSAdapter {
  name = 'Guesty';

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountId?: string;
  private tokenCache?: TokenCache;

  constructor(config: GuestyAdapterConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('GuestyAdapter requires clientId and clientSecret.');
    }
    this.baseUrl = config.baseUrl ?? GUESTY_API_BASE;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accountId = config.accountId;
  }

  async authenticate(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.accessToken;
    }

    const response = await fetch(GUESTY_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'open-api'
      }).toString()
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new GuestyApiError(payload.error_description || 'Auth failed', response.status, payload);
    }

    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAt: now + (payload.expires_in || 3600) * 1000
    };
    return this.tokenCache.accessToken;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    // Get first listing as "property" config
    const response = await this.request<{ results?: GuestyListing[]; data?: GuestyListing[] }>(
      '/listings', { limit: 1 }
    );
    const listings = response.results || response.data || [];
    const listing = listings[0];

    if (!listing) throw new Error('Guesty: no listings found.');

    return {
      id: listing._id || listing.id || '',
      name: listing.title || listing.nickname || 'Guesty Property',
      timezone: listing.timezone || 'UTC',
      currency: listing.currency || 'USD',
      address: listing.address?.full || [listing.address?.street, listing.address?.city, listing.address?.country].filter(Boolean).join(', ')
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const response = await this.request<{ days?: GuestyCalendarDay[]; data?: GuestyCalendarDay[] }>(
      '/availability-calendar',
      { startDate: params.startDate, endDate: params.endDate, listingId: params.roomTypeId }
    );
    const days = response.days || response.data || [];
    return days.map(day => ({
      date: day.date || params.startDate,
      roomTypeId: day.listingId || params.roomTypeId || '',
      available: day.available && !day.booked && !day.blocked ? 1 : 0,
      rate: day.price ?? 0
    }));
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const response = await this.request<{ results?: GuestyReservation[]; data?: GuestyReservation[] }>(
      '/reservations',
      { from: params.startDate, to: params.endDate, status: params.status }
    );
    const reservations = response.results || response.data || [];
    return reservations.map(res => ({
      id: res._id || res.id || res.confirmationCode || '',
      guestName: res.guest?.fullName || [res.guest?.firstName, res.guest?.lastName].filter(Boolean).join(' ') || 'Guest',
      roomTypeId: res.listingId || '',
      checkIn: res.checkInDateLocalized || res.checkIn || '',
      checkOut: res.checkOutDateLocalized || res.checkOut || '',
      status: res.status || 'confirmed',
      totalAmount: res.money?.hostPayout ?? res.money?.totalPaid ?? 0,
      currency: res.money?.currency || 'USD'
    }));
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<{ results?: GuestyListing[]; data?: GuestyListing[] }>(
      '/listings', { limit: 100 }
    );
    const listings = response.results || response.data || [];
    return listings.map(listing => ({
      id: listing._id || listing.id || '',
      name: listing.title || listing.nickname || '',
      capacity: listing.accommodates || 2,
      description: listing.propertyType
    }));
  }

  async getRates(): Promise<Rate[]> {
    // Guesty rates are per-listing, return empty - use availability for pricing
    return [];
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
      throw new GuestyApiError(payload.message || `Guesty API error (${response.status})`, response.status, payload);
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
