// Eywa AI - Apaleo PMS Adapter

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

const APALEO_API_BASE = 'https://api.apaleo.com';
const APALEO_TOKEN_URL = 'https://identity.apaleo.com/connect/token';
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type Primitive = string | number | boolean;
type QueryValue = Primitive | Primitive[] | undefined;

export interface ApaleoAdapterConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  tokenUrl?: string;
  scope?: string;
  propertyId?: string;
}

export interface ApaleoTokenResponse {
  access_token: string;
  token_type: 'Bearer' | string;
  expires_in: number;
  scope?: string;
}

export interface ApaleoApiErrorBody {
  title?: string;
  detail?: string;
  error?: string;
  error_description?: string;
  status?: number;
  traceId?: string;
  [key: string]: unknown;
}

export class ApaleoApiError extends Error {
  readonly status: number;
  readonly body?: ApaleoApiErrorBody;

  constructor(message: string, status: number, body?: ApaleoApiErrorBody) {
    super(message);
    this.name = 'ApaleoApiError';
    this.status = status;
    this.body = body;
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface ApaleoAddress {
  street?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  countryName?: string;
  [key: string]: unknown;
}

export interface ApaleoProperty {
  id?: string;
  code?: string;
  name?: string;
  timezone?: string;
  currency?: string;
  address?: ApaleoAddress;
  [key: string]: unknown;
}

export interface ApaleoPropertiesResponse {
  properties?: ApaleoProperty[];
  items?: ApaleoProperty[];
  value?: ApaleoProperty[];
  data?: ApaleoProperty[];
  count?: number;
  _embedded?: {
    properties?: ApaleoProperty[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ApaleoAvailabilityItem {
  date?: string;
  unitGroupId?: string;
  available?: number;
  availableUnits?: number;
  grossAmount?: {
    amount?: number;
    currency?: string;
  };
  rate?: number;
  [key: string]: unknown;
}

export interface ApaleoAvailabilityResponse {
  availabilities?: ApaleoAvailabilityItem[];
  items?: ApaleoAvailabilityItem[];
  value?: ApaleoAvailabilityItem[];
  data?: ApaleoAvailabilityItem[];
  _embedded?: {
    availabilities?: ApaleoAvailabilityItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ApaleoReservationItem {
  id?: string;
  reservationNumber?: string;
  status?: string;
  primaryGuest?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  guest?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  unitGroup?: {
    id?: string;
  };
  unitGroupId?: string;
  arrival?: string;
  departure?: string;
  checkIn?: string;
  checkOut?: string;
  totalGrossAmount?: {
    amount?: number;
    currency?: string;
  };
  totalAmount?: {
    amount?: number;
    currency?: string;
  };
  [key: string]: unknown;
}

export interface ApaleoReservationsResponse {
  reservations?: ApaleoReservationItem[];
  items?: ApaleoReservationItem[];
  value?: ApaleoReservationItem[];
  data?: ApaleoReservationItem[];
  count?: number;
  _embedded?: {
    reservations?: ApaleoReservationItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ApaleoUnitGroup {
  id?: string;
  name?: string;
  shortName?: string;
  maxPersons?: number;
  description?: string;
  [key: string]: unknown;
}

export interface ApaleoUnitGroupsResponse {
  unitGroups?: ApaleoUnitGroup[];
  items?: ApaleoUnitGroup[];
  value?: ApaleoUnitGroup[];
  data?: ApaleoUnitGroup[];
  count?: number;
  _embedded?: {
    unitGroups?: ApaleoUnitGroup[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ApaleoRatePlan {
  id?: string;
  code?: string;
  name?: string;
  unitGroup?: {
    id?: string;
  };
  unitGroupId?: string;
  channelCode?: string;
  [key: string]: unknown;
}

export interface ApaleoRatePlansResponse {
  ratePlans?: ApaleoRatePlan[];
  items?: ApaleoRatePlan[];
  value?: ApaleoRatePlan[];
  data?: ApaleoRatePlan[];
  count?: number;
  _embedded?: {
    ratePlans?: ApaleoRatePlan[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ApaleoAdapter implements IPMSAdapter {
  name = 'Apaleo';

  private readonly baseUrl: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scope?: string;
  private readonly propertyId?: string;
  private tokenCache?: TokenCache;

  constructor(config: ApaleoAdapterConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('ApaleoAdapter requires clientId and clientSecret.');
    }

    this.baseUrl = config.baseUrl ?? APALEO_API_BASE;
    this.tokenUrl = config.tokenUrl ?? APALEO_TOKEN_URL;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope;
    this.propertyId = config.propertyId;
  }

  async authenticate(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    if (this.scope) {
      body.set('scope', this.scope);
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as ApaleoApiErrorBody;
      const message =
        error.error_description || error.error || error.detail || `Apaleo auth failed (${response.status}).`;
      throw new ApaleoApiError(message, response.status, error);
    }

    const tokenPayload = payload as ApaleoTokenResponse;
    if (!tokenPayload.access_token || !tokenPayload.expires_in) {
      throw new ApaleoApiError('Apaleo auth response missing access_token or expires_in.', response.status);
    }

    this.tokenCache = {
      accessToken: tokenPayload.access_token,
      expiresAt: now + tokenPayload.expires_in * 1000
    };

    return this.tokenCache.accessToken;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<ApaleoPropertiesResponse>('/inventory/v1/properties');
    const properties = this.extractCollection<ApaleoProperty>(response, ['properties']);

    const property =
      (this.propertyId && properties.find((p) => p.id === this.propertyId || p.code === this.propertyId)) ||
      properties[0];

    if (!property) {
      throw new Error('Apaleo getConfiguration failed: no properties returned.');
    }

    return {
      id: property.id || property.code || '',
      name: property.name || property.code || '',
      timezone: property.timezone || 'UTC',
      currency: property.currency || 'EUR',
      address: this.formatAddress(property.address)
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const query: Record<string, QueryValue> = {
      propertyId: this.propertyId,
      from: params.startDate,
      to: params.endDate,
      unitGroupId: params.roomTypeId
    };

    const response = await this.request<ApaleoAvailabilityResponse>('/availability/v1/availability', query);
    const availabilities = this.extractCollection<ApaleoAvailabilityItem>(response, ['availabilities']);

    return availabilities.map((item) => ({
      date: item.date || '',
      roomTypeId: item.unitGroupId || params.roomTypeId || '',
      available: item.availableUnits ?? item.available ?? 0,
      rate: item.grossAmount?.amount ?? item.rate ?? 0
    }));
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const query: Record<string, QueryValue> = {
      propertyId: this.propertyId,
      from: params.startDate,
      to: params.endDate,
      status: params.status
    };

    const response = await this.request<ApaleoReservationsResponse>('/booking/v1/reservations', query);
    const reservations = this.extractCollection<ApaleoReservationItem>(response, ['reservations']);

    return reservations.map((reservation) => {
      const guestFullName =
        reservation.primaryGuest?.fullName ||
        reservation.guest?.fullName ||
        [reservation.primaryGuest?.firstName, reservation.primaryGuest?.lastName].filter(Boolean).join(' ') ||
        [reservation.guest?.firstName, reservation.guest?.lastName].filter(Boolean).join(' ');

      return {
        id: reservation.id || reservation.reservationNumber || '',
        guestName: guestFullName || 'Guest',
        roomTypeId: reservation.unitGroupId || reservation.unitGroup?.id || '',
        checkIn: reservation.arrival || reservation.checkIn || '',
        checkOut: reservation.departure || reservation.checkOut || '',
        status: reservation.status || 'confirmed',
        totalAmount: reservation.totalGrossAmount?.amount ?? reservation.totalAmount?.amount ?? 0,
        currency: reservation.totalGrossAmount?.currency || reservation.totalAmount?.currency || 'EUR'
      };
    });
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const query: Record<string, QueryValue> = {
      propertyId: this.propertyId
    };

    const response = await this.request<ApaleoUnitGroupsResponse>('/inventory/v1/unit-groups', query);
    const roomTypes = this.extractCollection<ApaleoUnitGroup>(response, ['unitGroups']);

    return roomTypes.map((roomType) => ({
      id: roomType.id || '',
      name: roomType.name || roomType.shortName || '',
      capacity: roomType.maxPersons || 2,
      description: roomType.description
    }));
  }

  async getRates(): Promise<Rate[]> {
    const query: Record<string, QueryValue> = {
      propertyId: this.propertyId
    };

    const response = await this.request<ApaleoRatePlansResponse>('/rateplan/v1/rate-plans', query);
    const rates = this.extractCollection<ApaleoRatePlan>(response, ['ratePlans']);

    return rates.map((rate) => ({
      id: rate.id || rate.code || '',
      name: rate.name || rate.code || 'Rate Plan',
      roomTypeId: rate.unitGroupId || rate.unitGroup?.id || '',
      price: 0,
      currency: 'EUR'
    }));
  }

  private async request<T>(path: string, query: Record<string, QueryValue> = {}, retry = true): Promise<T> {
    const token = await this.authenticate();
    const url = this.buildUrl(path, query);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401 && retry) {
      await this.authenticate(true);
      return this.request<T>(path, query, false);
    }

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as ApaleoApiErrorBody;
      const message = error.detail || error.title || error.error || `Apaleo API request failed (${response.status}).`;
      throw new ApaleoApiError(message, response.status, error);
    }

    return payload as T;
  }

  private buildUrl(path: string, query: Record<string, QueryValue>): string {
    const searchParams = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, String(item)));
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    return queryString ? `${this.baseUrl}${path}?${queryString}` : `${this.baseUrl}${path}`;
  }

  private async safeJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApaleoApiError('Apaleo API returned a non-JSON response.', response.status);
    }
  }

  private extractCollection<T>(
    payload: Record<string, unknown>,
    explicitKeys: string[] = []
  ): T[] {
    for (const key of explicitKeys) {
      const value = payload[key];
      if (Array.isArray(value)) return value as T[];
    }

    const commonKeys = ['items', 'value', 'data', 'results'];
    for (const key of commonKeys) {
      const value = payload[key];
      if (Array.isArray(value)) return value as T[];
    }

    const embedded = payload._embedded;
    if (embedded && typeof embedded === 'object') {
      const values = Object.values(embedded as Record<string, unknown>);
      const firstArray = values.find((value) => Array.isArray(value));
      if (firstArray) return firstArray as T[];
    }

    return [];
  }

  private formatAddress(address?: ApaleoAddress): string | undefined {
    if (!address) return undefined;

    const parts = [address.street, address.city, address.postalCode, address.countryName || address.countryCode].filter(
      Boolean
    );

    return parts.length > 0 ? parts.join(', ') : undefined;
  }
}
