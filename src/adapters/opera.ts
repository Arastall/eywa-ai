// Eywa AI - Oracle Opera Cloud PMS Adapter
// Oracle Hospitality OPERA Cloud REST API
// Docs: https://docs.oracle.com/en/industries/hospitality/opera-cloud/

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

const OPERA_API_BASE = 'https://api.oraclehospitality.com';
const OPERA_AUTH_URL = 'https://oauth.oraclehospitality.com/oauth/token';
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type QueryValue = string | number | boolean | undefined;

export interface OperaAdapterConfig {
  clientId: string;
  clientSecret: string;
  enterpriseId: string;
  hotelId: string;
  environment?: 'sandbox' | 'production';
  baseUrl?: string;
  authUrl?: string;
}

export interface OperaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface OperaApiErrorBody {
  title?: string;
  detail?: string;
  type?: string;
  status?: number;
  'o:errorCode'?: string;
  'o:errorDetails'?: Array<{ message: string; code: string }>;
  [key: string]: unknown;
}

export class OperaApiError extends Error {
  readonly status: number;
  readonly body?: OperaApiErrorBody;
  readonly errorCode?: string;

  constructor(message: string, status: number, body?: OperaApiErrorBody) {
    super(message);
    this.name = 'OperaApiError';
    this.status = status;
    this.body = body;
    this.errorCode = body?.['o:errorCode'];
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// Opera-specific response types
export interface OperaHotel {
  hotelId?: string;
  hotelCode?: string;
  hotelName?: string;
  timeZone?: string;
  currencyCode?: string;
  address?: {
    addressLine?: string[];
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  [key: string]: unknown;
}

export interface OperaHotelsResponse {
  hotels?: { hotel?: OperaHotel[] };
  links?: Array<{ rel: string; href: string }>;
  [key: string]: unknown;
}

export interface OperaRoomType {
  roomType?: string;
  roomTypeCode?: string;
  roomTypeName?: string;
  shortDescription?: string;
  longDescription?: string;
  maxOccupancy?: number;
  maxAdults?: number;
  [key: string]: unknown;
}

export interface OperaRoomTypesResponse {
  roomTypes?: { roomType?: OperaRoomType[] };
  [key: string]: unknown;
}

export interface OperaRatePlan {
  ratePlanCode?: string;
  ratePlanName?: string;
  description?: string;
  currencyCode?: string;
  [key: string]: unknown;
}

export interface OperaRatePlansResponse {
  ratePlans?: { ratePlan?: OperaRatePlan[] };
  [key: string]: unknown;
}

export interface OperaAvailability {
  date?: string;
  roomType?: string;
  availableRooms?: number;
  totalRooms?: number;
  sellLimit?: number;
  rate?: {
    amount?: number;
    currencyCode?: string;
  };
  [key: string]: unknown;
}

export interface OperaAvailabilityResponse {
  roomAvailability?: OperaAvailability[];
  hotelAvailability?: {
    roomStay?: Array<{
      roomTypes?: { roomType?: OperaAvailability[] };
      ratePlans?: { ratePlan?: Array<{ ratePlanCode?: string; rates?: Array<{ base?: { amountBeforeTax?: number } }> }> };
    }>;
  };
  [key: string]: unknown;
}

export interface OperaGuest {
  givenName?: string;
  surname?: string;
  nameTitle?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface OperaReservation {
  reservationId?: string;
  reservationIdList?: Array<{ id?: string; type?: string }>;
  confirmationNumber?: string;
  status?: string;
  reservationStatus?: string;
  roomStay?: {
    roomType?: string;
    roomTypeCode?: string;
    arrivalDate?: string;
    departureDate?: string;
    expectedTimes?: {
      reservationExpectedArrivalTime?: string;
      reservationExpectedDepartureTime?: string;
    };
    total?: {
      amountBeforeTax?: number;
      amountAfterTax?: number;
      currencyCode?: string;
    };
  };
  reservationGuests?: {
    profileInfo?: {
      profile?: {
        customer?: {
          personName?: OperaGuest[];
        };
      };
    };
  };
  guestCounts?: { adults?: number; children?: number };
  [key: string]: unknown;
}

export interface OperaReservationsResponse {
  reservations?: { reservation?: OperaReservation[] };
  hotelReservations?: OperaReservation[];
  [key: string]: unknown;
}

export class OperaAdapter implements IPMSAdapter {
  name = 'Opera Cloud';

  private readonly baseUrl: string;
  private readonly authUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly enterpriseId: string;
  private readonly hotelId: string;
  private tokenCache?: TokenCache;

  constructor(config: OperaAdapterConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('OperaAdapter requires clientId and clientSecret.');
    }
    if (!config.enterpriseId || !config.hotelId) {
      throw new Error('OperaAdapter requires enterpriseId and hotelId.');
    }

    const envPrefix = config.environment === 'sandbox' ? 'sandbox-' : '';
    this.baseUrl = config.baseUrl ?? `https://${envPrefix}api.oraclehospitality.com`;
    this.authUrl = config.authUrl ?? OPERA_AUTH_URL;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.enterpriseId = config.enterpriseId;
    this.hotelId = config.hotelId;
  }

  async authenticate(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'openid'
      }).toString()
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as OperaApiErrorBody;
      const message = error.detail || error.title || `Opera auth failed (${response.status}).`;
      throw new OperaApiError(message, response.status, error);
    }

    const tokenPayload = payload as OperaTokenResponse;
    if (!tokenPayload.access_token) {
      throw new OperaApiError('Opera auth response missing access_token.', response.status);
    }

    this.tokenCache = {
      accessToken: tokenPayload.access_token,
      expiresAt: now + (tokenPayload.expires_in || 3600) * 1000
    };

    return this.tokenCache.accessToken;
  }

  async getConfiguration(): Promise<HotelConfiguration> {
    const response = await this.request<OperaHotelsResponse>(
      `/par/v1/hotels/${this.hotelId}`
    );

    const hotels = response.hotels?.hotel || [];
    const hotel = hotels[0] || (response as unknown as OperaHotel);

    if (!hotel) {
      throw new Error('Opera getConfiguration failed: no hotel data returned.');
    }

    const addressParts = [
      ...(hotel.address?.addressLine || []),
      hotel.address?.city,
      hotel.address?.state,
      hotel.address?.postalCode,
      hotel.address?.country
    ].filter(Boolean);

    return {
      id: hotel.hotelId || hotel.hotelCode || this.hotelId,
      name: hotel.hotelName || hotel.hotelCode || 'Opera Hotel',
      timezone: hotel.timeZone || 'UTC',
      currency: hotel.currencyCode || 'USD',
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined
    };
  }

  async getAvailability(params: AvailabilityParams): Promise<Availability[]> {
    const query: Record<string, QueryValue> = {
      hotelId: this.hotelId,
      arrivalDate: params.startDate,
      departureDate: params.endDate,
      roomType: params.roomTypeId,
      adults: 2,
      children: 0
    };

    const response = await this.request<OperaAvailabilityResponse>(
      '/par/v1/availability',
      query
    );

    // Handle different response formats
    const availabilities: Availability[] = [];

    // Format 1: roomAvailability array
    if (response.roomAvailability) {
      for (const item of response.roomAvailability) {
        availabilities.push({
          date: item.date || params.startDate,
          roomTypeId: item.roomType || params.roomTypeId || '',
          available: item.availableRooms ?? item.sellLimit ?? 0,
          rate: item.rate?.amount ?? 0
        });
      }
    }

    // Format 2: hotelAvailability with roomStay
    if (response.hotelAvailability?.roomStay) {
      for (const stay of response.hotelAvailability.roomStay) {
        const roomTypes = stay.roomTypes?.roomType || [];
        const ratePlans = stay.ratePlans?.ratePlan || [];
        const firstRate = ratePlans[0]?.rates?.[0]?.base?.amountBeforeTax;

        for (const rt of roomTypes) {
          availabilities.push({
            date: rt.date || params.startDate,
            roomTypeId: rt.roomType || '',
            available: rt.availableRooms ?? 0,
            rate: rt.rate?.amount ?? firstRate ?? 0
          });
        }
      }
    }

    return availabilities;
  }

  async getReservations(params: ReservationParams = {}): Promise<Reservation[]> {
    const query: Record<string, QueryValue> = {
      hotelId: this.hotelId,
      arrivalStartDate: params.startDate,
      arrivalEndDate: params.endDate,
      reservationStatus: params.status?.toUpperCase()
    };

    const response = await this.request<OperaReservationsResponse>(
      '/rsv/v1/hotels/' + this.hotelId + '/reservations',
      query
    );

    const reservations = response.reservations?.reservation || response.hotelReservations || [];

    return reservations.map((res) => {
      const resId = res.reservationId || 
        res.reservationIdList?.find(id => id.type === 'Confirmation')?.id ||
        res.confirmationNumber || '';

      const guest = res.reservationGuests?.profileInfo?.profile?.customer?.personName?.[0];
      const guestName = guest 
        ? [guest.nameTitle, guest.givenName, guest.surname].filter(Boolean).join(' ')
        : 'Guest';

      const roomStay = res.roomStay;

      return {
        id: resId,
        guestName,
        roomTypeId: roomStay?.roomType || roomStay?.roomTypeCode || '',
        checkIn: roomStay?.arrivalDate || roomStay?.expectedTimes?.reservationExpectedArrivalTime || '',
        checkOut: roomStay?.departureDate || roomStay?.expectedTimes?.reservationExpectedDepartureTime || '',
        status: res.status || res.reservationStatus || 'confirmed',
        totalAmount: roomStay?.total?.amountAfterTax ?? roomStay?.total?.amountBeforeTax ?? 0,
        currency: roomStay?.total?.currencyCode || 'USD'
      };
    });
  }

  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.request<OperaRoomTypesResponse>(
      `/par/v1/hotels/${this.hotelId}/roomTypes`
    );

    const roomTypes = response.roomTypes?.roomType || [];

    return roomTypes.map((rt) => ({
      id: rt.roomType || rt.roomTypeCode || '',
      name: rt.roomTypeName || rt.roomType || '',
      capacity: rt.maxOccupancy || rt.maxAdults || 2,
      description: rt.longDescription || rt.shortDescription
    }));
  }

  async getRates(): Promise<Rate[]> {
    const response = await this.request<OperaRatePlansResponse>(
      `/par/v1/hotels/${this.hotelId}/ratePlans`
    );

    const ratePlans = response.ratePlans?.ratePlan || [];

    return ratePlans.map((rp) => ({
      id: rp.ratePlanCode || '',
      name: rp.ratePlanName || rp.ratePlanCode || 'Rate Plan',
      roomTypeId: '',
      price: 0,
      currency: rp.currencyCode || 'USD'
    }));
  }

  private async request<T>(
    path: string,
    query: Record<string, QueryValue> = {},
    retry = true
  ): Promise<T> {
    const token = await this.authenticate();
    const url = this.buildUrl(path, query);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-hotelid': this.hotelId,
        'x-app-key': this.clientId
      }
    });

    if (response.status === 401 && retry) {
      await this.authenticate(true);
      return this.request<T>(path, query, false);
    }

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const error = payload as OperaApiErrorBody;
      const message = error.detail || error.title || 
        error['o:errorDetails']?.[0]?.message ||
        `Opera API request failed (${response.status}).`;
      throw new OperaApiError(message, response.status, error);
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
      throw new OperaApiError('Opera API returned a non-JSON response.', response.status);
    }
  }
}
