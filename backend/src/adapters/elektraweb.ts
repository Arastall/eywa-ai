// Elektraweb PMS Adapter
// Company: Talya Bilişim, Antalya, Turkey
// Website: https://elektraweb.com
// Covers 1,800+ Turkish hotels (dominant in Antalya, Aegean, Cappadocia)
// Tech: Google BigQuery backend

import axios, { AxiosInstance } from 'axios';

interface ElektrawebConfig {
  apiKey: string;
  apiUrl?: string;
  hotelCode: string;
}

export interface ElektrawebHotel {
  code: string;
  name: string;
  nameTr: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  starRating: number;
  roomCount: number;
  bedCount: number;
  facilities: string[];
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  taxRate: number;
}

export interface ElektrawebRoom {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  size: number;
  floor: string;
  bedType: string;
  amenities: string[];
  baseRate: number;
  status: 'available' | 'occupied' | 'maintenance' | 'blocked';
}

export interface ElektrawebRate {
  roomCode: string;
  date: string;
  singleRate: number;
  doubleRate: number;
  tripleRate: number;
  extraBedRate: number;
  childRate: number;
  currency: string;
  availability: number;
  minStay: number;
  maxStay: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSale: boolean;
}

export interface ElektrawebReservation {
  id: string;
  reservationNo: string;
  folioNo: string;
  guestName: string;
  guestSurname: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string;
  guestIdNumber: string;
  checkIn: string;
  checkOut: string;
  roomCode: string;
  roomNumber: string;
  roomCount: number;
  adults: number;
  children: number;
  childrenAges: number[];
  boardType: string; // 'RO', 'BB', 'HB', 'FB', 'AI', 'UAI'
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  source: string;
  agencyCode: string;
  voucherNumber: string;
  specialRequests: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElektrawebGuest {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  nationality: string;
  idType: string;
  idNumber: string;
  birthDate: string;
  gender: string;
  address: string;
  city: string;
  country: string;
  vipLevel: number;
  notes: string;
}

export class ElektrawebAdapter {
  private client: AxiosInstance;
  private config: ElektrawebConfig;

  constructor(config: ElektrawebConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl || 'https://api.elektraweb.com/v1',
      headers: {
        'X-API-Key': config.apiKey,
        'X-Hotel-Code': config.hotelCode,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'tr-TR',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('[Elektraweb] API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Hotel Information
  async getHotelInfo(): Promise<ElektrawebHotel> {
    const response = await this.client.get('/hotel');
    return response.data;
  }

  async updateHotelInfo(info: Partial<ElektrawebHotel>): Promise<void> {
    await this.client.put('/hotel', info);
  }

  // Room Management
  async getRooms(): Promise<ElektrawebRoom[]> {
    const response = await this.client.get('/rooms');
    return response.data.rooms || response.data;
  }

  async getRoom(roomCode: string): Promise<ElektrawebRoom> {
    const response = await this.client.get(`/rooms/${roomCode}`);
    return response.data;
  }

  async getRoomStatus(date: string): Promise<any[]> {
    const response = await this.client.get('/rooms/status', {
      params: { date }
    });
    return response.data;
  }

  // Availability & Rates
  async getAvailability(startDate: string, endDate: string, roomCodes?: string[]): Promise<ElektrawebRate[]> {
    const response = await this.client.get('/availability', {
      params: { 
        start_date: startDate, 
        end_date: endDate,
        room_codes: roomCodes?.join(','),
        currency: 'TRY'
      }
    });
    return response.data.rates || response.data;
  }

  async updateRates(rates: ElektrawebRate[]): Promise<void> {
    await this.client.put('/rates', { rates });
  }

  async updateSingleRate(roomCode: string, date: string, rate: Partial<ElektrawebRate>): Promise<void> {
    await this.client.put(`/rates/${roomCode}/${date}`, rate);
  }

  async updateAvailability(availability: Partial<ElektrawebRate>[]): Promise<void> {
    await this.client.put('/availability', { availability });
  }

  async setStopSale(roomCode: string, startDate: string, endDate: string, stopSale: boolean): Promise<void> {
    await this.client.put(`/rooms/${roomCode}/stop-sale`, {
      start_date: startDate,
      end_date: endDate,
      stop_sale: stopSale
    });
  }

  // Reservations
  async getReservations(startDate: string, endDate: string, status?: string): Promise<ElektrawebReservation[]> {
    const response = await this.client.get('/reservations', {
      params: { 
        start_date: startDate, 
        end_date: endDate,
        status
      }
    });
    return response.data.reservations || response.data;
  }

  async getReservation(reservationId: string): Promise<ElektrawebReservation> {
    const response = await this.client.get(`/reservations/${reservationId}`);
    return response.data;
  }

  async getReservationByNumber(reservationNo: string): Promise<ElektrawebReservation> {
    const response = await this.client.get(`/reservations/by-number/${reservationNo}`);
    return response.data;
  }

  async createReservation(reservation: Partial<ElektrawebReservation>): Promise<ElektrawebReservation> {
    const response = await this.client.post('/reservations', reservation);
    return response.data;
  }

  async updateReservation(reservationId: string, updates: Partial<ElektrawebReservation>): Promise<void> {
    await this.client.put(`/reservations/${reservationId}`, updates);
  }

  async cancelReservation(reservationId: string, reason?: string): Promise<void> {
    await this.client.delete(`/reservations/${reservationId}`, {
      data: { reason }
    });
  }

  async checkIn(reservationId: string, roomNumber?: string): Promise<void> {
    await this.client.post(`/reservations/${reservationId}/check-in`, { room_number: roomNumber });
  }

  async checkOut(reservationId: string): Promise<void> {
    await this.client.post(`/reservations/${reservationId}/check-out`);
  }

  // Guest Management
  async getGuests(query?: string): Promise<ElektrawebGuest[]> {
    const response = await this.client.get('/guests', {
      params: { q: query }
    });
    return response.data.guests || response.data;
  }

  async getGuest(guestId: string): Promise<ElektrawebGuest> {
    const response = await this.client.get(`/guests/${guestId}`);
    return response.data;
  }

  async createGuest(guest: Partial<ElektrawebGuest>): Promise<ElektrawebGuest> {
    const response = await this.client.post('/guests', guest);
    return response.data;
  }

  // Reports
  async getDailyReport(date: string): Promise<any> {
    const response = await this.client.get('/reports/daily', {
      params: { date }
    });
    return response.data;
  }

  async getOccupancyReport(startDate: string, endDate: string): Promise<any> {
    const response = await this.client.get('/reports/occupancy', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  async getRevenueReport(startDate: string, endDate: string): Promise<any> {
    const response = await this.client.get('/reports/revenue', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  // Turkish-specific: e-Fatura integration
  async getInvoices(startDate: string, endDate: string): Promise<any[]> {
    const response = await this.client.get('/invoices', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data.invoices || response.data;
  }

  async createInvoice(reservationId: string): Promise<any> {
    const response = await this.client.post(`/reservations/${reservationId}/invoice`);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export default ElektrawebAdapter;
