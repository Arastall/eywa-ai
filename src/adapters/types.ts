// Eywa AI - PMS Adapter Types

export interface IPMSAdapter {
  name: string;
  getConfiguration(): Promise<HotelConfiguration>;
  getAvailability(params: AvailabilityParams): Promise<Availability[]>;
  getReservations(params: ReservationParams): Promise<Reservation[]>;
  getRoomTypes(): Promise<RoomType[]>;
  getRates(): Promise<Rate[]>;
}

export interface HotelConfiguration {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  address?: string;
}

export interface AvailabilityParams {
  startDate: string;
  endDate: string;
  roomTypeId?: string;
}

export interface Availability {
  date: string;
  roomTypeId: string;
  available: number;
  rate: number;
}

export interface ReservationParams {
  startDate?: string;
  endDate?: string;
  status?: 'confirmed' | 'cancelled' | 'checked_in' | 'checked_out';
}

export interface Reservation {
  id: string;
  guestName: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  currency: string;
}

export interface RoomType {
  id: string;
  name: string;
  capacity: number;
  description?: string;
}

export interface Rate {
  id: string;
  name: string;
  roomTypeId: string;
  price: number;
  currency: string;
}
