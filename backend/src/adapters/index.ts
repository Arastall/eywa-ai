// Turkish PMS Adapters
// Part of Eywa AI Turkey Market Strategy

export { HotelRunnerAdapter } from './hotelrunner';
export type { 
  HotelRunnerProperty, 
  HotelRunnerRoomType, 
  HotelRunnerRate, 
  HotelRunnerBooking 
} from './hotelrunner';

export { ElektrawebAdapter } from './elektraweb';
export type { 
  ElektrawebHotel, 
  ElektrawebRoom, 
  ElektrawebRate, 
  ElektrawebReservation,
  ElektrawebGuest 
} from './elektraweb';

// Adapter factory for Turkish market
export type TurkishPMSType = 'hotelrunner' | 'elektraweb';

export interface TurkishAdapterConfig {
  type: TurkishPMSType;
  apiKey: string;
  apiUrl?: string;
  hotelCode?: string; // Required for Elektraweb
}

export function createTurkishAdapter(config: TurkishAdapterConfig) {
  switch (config.type) {
    case 'hotelrunner':
      return new (require('./hotelrunner').HotelRunnerAdapter)({
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
      });
    case 'elektraweb':
      if (!config.hotelCode) {
        throw new Error('hotelCode is required for Elektraweb adapter');
      }
      return new (require('./elektraweb').ElektrawebAdapter)({
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        hotelCode: config.hotelCode,
      });
    default:
      throw new Error(`Unknown Turkish PMS type: ${config.type}`);
  }
}
