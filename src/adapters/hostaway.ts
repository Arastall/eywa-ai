// Eywa AI - Hostaway PMS Adapter

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type Primitive = string | number | boolean;
type QueryValue = Primitive | Primitive[] | undefined;

export interface HostawayAdapterConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  accountId?: number;
}

export interface HostawayApiErrorBody {
  status?: string;
  message?: string;
  error?: string;
  errors?: Array<{ field?: string; message?: string }>;
}

export class HostawayApiError extends Error {
  readonly status: number;
  readonly body?: HostawayApiErrorBody;

  constructor(message: string, status: number, body?: HostawayApiErrorBody) {
    super(message);
    this.name = 'HostawayApiError';
    this.status = status;
    this.body = body;
  }
}

export interface HostawayAuthResponse {
  access_token: string;
  token_type: 'Bearer' | string;
  expires_in: number;
  scope?: string;
}

export interface HostawayApiResponse<T> {
  status: 'success' | 'error' | string;
  result: T;
  message?: string;
}

export interface HostawayListing {
  id: number;
  name: string;
  internalName?: string;
  externalListingName?: string;
  listingMapId?: number;
  listingType?: string;
  roomType?: string;
  personCapacity?: number;
  maxChildrenAllowed?: number;
  maxInfantsAllowed?: number;
  bedroomsNumber?: number;
  bathroomsNumber?: number;
  bedsNumber?: number;
  propertyType?: string;
  size?: number;
  sizeUnit?: string;
  timezone?: string;
  currency?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isActive?: 0 | 1;
  accountId?: number;
  [key: string]: unknown;
}

export interface HostawayGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  numberOfGuests?: number;
  [key: string]: unknown;
}

export interface HostawayReservation {
  id: number;
  listingId: number;
  externalId?: string;
  source?: string;
  sourceName?: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  nights?: number;
  guestName?: string;
  guestEmail?: string;
  guests?: HostawayGuest[];
  numberOfGuests?: number;
  totalPrice?: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface HostawayCalendarDay {
  date: string;
  listingId: number;
  status?: string;
  available?: boolean;
  availableUnits?: number;
  minStay?: number;
  maxStay?: number;
  basePrice?: number;
  price?: number;
  currency?: string;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  reservationId?: number;
  [key: string]: unknown;
}

export interface HostawayRate {
  id: number;
  listingId: number;
  name?: string;
  type?: string;
  amount?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  minStay?: number;
  maxStay?: number;
  active?: boolean;
  [key: string]: unknown;
}

export interface GetListingsParams {
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
  includeResources?: 0 | 1;
  includeResourcesInHouseManual?: 0 | 1;
  attachObjects?: 0 | 1;
}

export interface GetReservationsParams {
  listingId?: number;
  statuses?: string[];
  reservationIds?: number[];
  checkInStartDate?: string;
  checkInEndDate?: string;
  checkOutStartDate?: string;
  checkOutEndDate?: string;
  updatedSince?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface GetCalendarParams {
  listingId?: number;
  listingIds?: number[];
  startDate: string;
  endDate: string;
  includeResources?: 0 | 1;
}

export interface GetRatesParams {
  listingId?: number;
  listingIds?: number[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class HostawayAdapter {
  readonly name = 'Hostaway';

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountId?: number;
  private tokenCache?: TokenCache;

  constructor(config: HostawayAdapterConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('HostawayAdapter requires clientId and clientSecret.');
    }

    this.baseUrl = config.baseUrl ?? HOSTAWAY_API_BASE;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accountId = config.accountId;
  }

  async authenticate(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return this.tokenCache.accessToken;
    }

    const auth = await this.requestToken();

    this.tokenCache = {
      accessToken: auth.access_token,
      expiresAt: now + auth.expires_in * 1000
    };

    return this.tokenCache.accessToken;
  }

  async getListings(params: GetListingsParams = {}): Promise<HostawayListing[]> {
    const query: Record<string, QueryValue> = {
      limit: params.limit,
      offset: params.offset,
      sortOrder: params.sortOrder,
      includeResources: params.includeResources,
      includeResourcesInHouseManual: params.includeResourcesInHouseManual,
      attachObjects: params.attachObjects
    };

    const response = await this.request<HostawayListing[]>('/listings', {
      method: 'GET',
      query
    });

    return response.result;
  }

  async getReservations(params: GetReservationsParams = {}): Promise<HostawayReservation[]> {
    const query: Record<string, QueryValue> = {
      listingId: params.listingId,
      status: params.statuses,
      reservationIds: params.reservationIds,
      checkInStartDate: params.checkInStartDate,
      checkInEndDate: params.checkInEndDate,
      checkOutStartDate: params.checkOutStartDate,
      checkOutEndDate: params.checkOutEndDate,
      updatedSince: params.updatedSince,
      limit: params.limit,
      offset: params.offset,
      sortOrder: params.sortOrder
    };

    const response = await this.request<HostawayReservation[]>('/reservations', {
      method: 'GET',
      query
    });

    return response.result;
  }

  async getCalendar(params: GetCalendarParams): Promise<HostawayCalendarDay[]> {
    const query: Record<string, QueryValue> = {
      listingId: params.listingId,
      listingIds: params.listingIds,
      startDate: params.startDate,
      endDate: params.endDate,
      includeResources: params.includeResources
    };

    const response = await this.request<HostawayCalendarDay[]>('/calendar', {
      method: 'GET',
      query
    });

    return response.result;
  }

  async getRates(params: GetRatesParams = {}): Promise<HostawayRate[]> {
    const query: Record<string, QueryValue> = {
      listingId: params.listingId,
      listingIds: params.listingIds,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
      offset: params.offset,
      sortOrder: params.sortOrder
    };

    const response = await this.request<HostawayRate[]>('/rates', {
      method: 'GET',
      query
    });

    return response.result;
  }

  private async requestToken(): Promise<HostawayAuthResponse> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    const response = await fetch(`${this.baseUrl}/accessTokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!response.ok) {
      const errorBody = await this.parseErrorBody(response);
      throw new HostawayApiError(
        `Hostaway authentication failed (${response.status} ${response.statusText})`,
        response.status,
        errorBody
      );
    }

    const data = (await response.json()) as HostawayAuthResponse;

    if (!data.access_token || !data.expires_in) {
      throw new HostawayApiError('Hostaway authentication response is missing token details.', response.status);
    }

    return data;
  }

  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      query?: Record<string, QueryValue>;
      body?: unknown;
      retryOnUnauthorized?: boolean;
    }
  ): Promise<HostawayApiResponse<T>> {
    const token = await this.authenticate();
    const query = this.buildQuery(options.query);
    const url = `${this.baseUrl}${path}${query}`;

    const headers: HeadersInit = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    };

    if (this.accountId !== undefined) {
      headers['X-Hostaway-Account-Id'] = String(this.accountId);
    }

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      await this.authenticate(true);
      return this.request<T>(path, { ...options, retryOnUnauthorized: false });
    }

    if (!response.ok) {
      const errorBody = await this.parseErrorBody(response);
      throw new HostawayApiError(
        `Hostaway API request failed (${response.status} ${response.statusText}) for ${path}`,
        response.status,
        errorBody
      );
    }

    const data = (await response.json()) as HostawayApiResponse<T>;
    if (data.status && data.status !== 'success') {
      throw new HostawayApiError(data.message || `Hostaway API returned non-success status for ${path}`, response.status, {
        status: data.status,
        message: data.message
      });
    }

    return data;
  }

  private buildQuery(params?: Record<string, QueryValue>): string {
    if (!params) {
      return '';
    }

    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          continue;
        }

        for (const item of value) {
          search.append(key, String(item));
        }
      } else {
        search.append(key, String(value));
      }
    }

    const serialized = search.toString();
    return serialized ? `?${serialized}` : '';
  }

  private async parseErrorBody(response: Response): Promise<HostawayApiErrorBody | undefined> {
    try {
      return (await response.json()) as HostawayApiErrorBody;
    } catch {
      return undefined;
    }
  }
}
