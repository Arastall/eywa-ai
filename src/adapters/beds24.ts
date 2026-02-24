// Eywa AI - Beds24 Channel Manager Adapter

const BEDS24_API_BASE = 'https://api.beds24.com/json';

export interface Beds24Credentials {
  apiKey: string;
  propKey?: string;
}

export interface Beds24AuthState {
  authenticated: boolean;
  apiKey: string;
  propKey?: string;
}

export interface Beds24RequestBase {
  apiKey: string;
  propKey?: string;
}

export interface Beds24ApiErrorPayload {
  error?: string;
  code?: number;
  message?: string;
  [key: string]: unknown;
}

export class Beds24ApiError extends Error {
  status?: number;
  code?: number;
  details?: Beds24ApiErrorPayload;

  constructor(message: string, options?: { status?: number; code?: number; details?: Beds24ApiErrorPayload }) {
    super(message);
    this.name = 'Beds24ApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export interface Beds24Property {
  propId: number;
  name: string;
  ownerName?: string;
  ownerEmail?: string;
  currency?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface Beds24PropertiesResponse {
  properties?: Beds24Property[];
  [key: string]: unknown;
}

export interface Beds24Room {
  roomId: number;
  roomName: string;
  qty?: number;
  maxOccupancy?: number;
  roomTypeId?: number;
  [key: string]: unknown;
}

export interface Beds24PropertyDetail {
  propId: number;
  name?: string;
  rooms?: Beds24Room[];
  [key: string]: unknown;
}

export interface Beds24PropertyResponse {
  property?: Beds24PropertyDetail;
  [key: string]: unknown;
}

export interface Beds24Booking {
  bookingId: number;
  propId: number;
  roomId?: number;
  firstNight: string;
  lastNight: string;
  numAdult?: number;
  numChild?: number;
  status?: string;
  price?: number;
  commission?: number;
  referer?: string;
  modified?: string;
  [key: string]: unknown;
}

export interface Beds24BookingsResponse {
  bookings?: Beds24Booking[];
  [key: string]: unknown;
}

export interface Beds24AvailabilityDay {
  date: string;
  roomId: number;
  qty: number;
  price?: number;
  minStay?: number;
  maxStay?: number;
  closed?: boolean;
  [key: string]: unknown;
}

export interface Beds24AvailabilityResponse {
  availabilities?: Beds24AvailabilityDay[];
  [key: string]: unknown;
}

export interface Beds24GetRoomsParams {
  propId: number;
}

export interface Beds24GetBookingsParams {
  propId?: number;
  roomId?: number;
  from?: string;
  to?: string;
  modifiedFrom?: string;
  status?: string;
}

export interface Beds24GetAvailabilityParams {
  propId?: number;
  roomId?: number;
  from: string;
  to: string;
}

export class Beds24Adapter {
  readonly name = 'Beds24';

  private readonly baseUrl: string;
  private credentials: Beds24Credentials;
  private authState: Beds24AuthState | null = null;

  constructor(config: Beds24Credentials & { baseUrl?: string }) {
    if (!config.apiKey) {
      throw new Beds24ApiError('Beds24 apiKey is required for authentication.');
    }

    this.baseUrl = config.baseUrl ?? BEDS24_API_BASE;
    this.credentials = {
      apiKey: config.apiKey,
      propKey: config.propKey
    };
  }

  setCredentials(credentials: Beds24Credentials): void {
    if (!credentials.apiKey) {
      throw new Beds24ApiError('Beds24 apiKey is required for authentication.');
    }

    this.credentials = credentials;
    this.authState = null;
  }

  async authenticate(): Promise<Beds24AuthState> {
    // Beds24 JSON API authenticates each request with apiKey (+ optional propKey).
    // Validate credentials by making a low-cost request.
    await this.getProperties();

    this.authState = {
      authenticated: true,
      apiKey: this.credentials.apiKey,
      propKey: this.credentials.propKey
    };

    return this.authState;
  }

  async getProperties(): Promise<Beds24Property[]> {
    const payload = await this.request<Beds24PropertiesResponse>('getProperties', {});
    return payload.properties ?? [];
  }

  async getRooms(params: Beds24GetRoomsParams): Promise<Beds24Room[]> {
    const payload = await this.request<Beds24PropertyResponse>('getProperty', {
      propId: params.propId
    });

    return payload.property?.rooms ?? [];
  }

  async getBookings(params: Beds24GetBookingsParams = {}): Promise<Beds24Booking[]> {
    const payload = await this.request<Beds24BookingsResponse>('getBookings', {
      propId: params.propId,
      roomId: params.roomId,
      from: params.from,
      to: params.to,
      modifiedFrom: params.modifiedFrom,
      status: params.status
    });

    return payload.bookings ?? [];
  }

  async getAvailability(params: Beds24GetAvailabilityParams): Promise<Beds24AvailabilityDay[]> {
    const payload = await this.request<Beds24AvailabilityResponse>('getAvailabilities', {
      propId: params.propId,
      roomId: params.roomId,
      from: params.from,
      to: params.to
    });

    return payload.availabilities ?? [];
  }

  private async request<TResponse extends Record<string, unknown>>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<TResponse> {
    const payload: Beds24RequestBase & Record<string, unknown> = {
      apiKey: this.credentials.apiKey,
      ...body
    };

    if (this.credentials.propKey) {
      payload.propKey = this.credentials.propKey;
    }

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let json: Record<string, unknown> = {};

    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new Beds24ApiError(`Beds24 API returned a non-JSON response for ${endpoint}.`, {
        status: response.status
      });
    }

    if (!response.ok) {
      const errorPayload = json as Beds24ApiErrorPayload;
      throw new Beds24ApiError(
        errorPayload.error ||
          errorPayload.message ||
          `Beds24 API request failed for ${endpoint} (${response.status}).`,
        {
          status: response.status,
          code: typeof errorPayload.code === 'number' ? errorPayload.code : undefined,
          details: errorPayload
        }
      );
    }

    if ('error' in json && typeof json.error === 'string' && json.error.length > 0) {
      const errorPayload = json as Beds24ApiErrorPayload;
      throw new Beds24ApiError(json.error, {
        code: typeof errorPayload.code === 'number' ? errorPayload.code : undefined,
        details: errorPayload
      });
    }

    return json as TResponse;
  }
}
