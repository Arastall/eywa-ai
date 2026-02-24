// Eywa AI - PMS Adapters Index
// Export all adapters and types - 17 total!

export * from './types';

// Cloud PMS Adapters (Global)
export { MewsAdapter } from './mews';
export { CloudbedsAdapter } from './cloudbeds';
export { ApaleoAdapter, type ApaleoAdapterConfig } from './apaleo';
export { OperaAdapter, type OperaAdapterConfig } from './opera';

// European PMS Adapters
export { ProtelAdapter, type ProtelAdapterConfig } from './protel';
export { GuestlineAdapter, type GuestlineAdapterConfig } from './guestline';
export { RoomRaccoonAdapter, type RoomRaccoonAdapterConfig } from './roomraccoon';
export { ClockPMSAdapter, type ClockPMSAdapterConfig } from './clockpms';

// Asia/Pacific PMS Adapters
export { HotelogixAdapter, type HotelogixAdapterConfig } from './hotelogix';
export { EzeeAdapter, type EzeeAdapterConfig } from './ezee';
export { LittleHotelierAdapter, type LittleHotelierAdapterConfig } from './littlehotelier';

// US PMS Adapters
export { StayNTouchAdapter, type StayNTouchAdapterConfig } from './stayntouch';
export { WebRezProAdapter, type WebRezProAdapterConfig } from './webrezpro';

// Enterprise PMS
export { InforHMSAdapter, type InforHMSAdapterConfig } from './inforhms';

// Vacation Rental / Channel Managers
export { HostawayAdapter, type HostawayAdapterConfig } from './hostaway';
export { Beds24Adapter } from './beds24';
export { GuestyAdapter, type GuestyAdapterConfig } from './guesty';

// Adapter registry for dynamic instantiation
export const ADAPTER_REGISTRY = {
  // Global Cloud
  mews: 'MewsAdapter',
  cloudbeds: 'CloudbedsAdapter',
  apaleo: 'ApaleoAdapter',
  opera: 'OperaAdapter',
  // Europe
  protel: 'ProtelAdapter',
  guestline: 'GuestlineAdapter',
  roomraccoon: 'RoomRaccoonAdapter',
  clockpms: 'ClockPMSAdapter',
  // Asia/Pacific
  hotelogix: 'HotelogixAdapter',
  ezee: 'EzeeAdapter',
  littlehotelier: 'LittleHotelierAdapter',
  // US
  stayntouch: 'StayNTouchAdapter',
  webrezpro: 'WebRezProAdapter',
  // Enterprise
  inforhms: 'InforHMSAdapter',
  // Vacation Rentals
  hostaway: 'HostawayAdapter',
  beds24: 'Beds24Adapter',
  guesty: 'GuestyAdapter',
} as const;

export type AdapterSlug = keyof typeof ADAPTER_REGISTRY;

// Market coverage info (estimated % of global hotel market)
export const ADAPTER_MARKET_INFO = {
  // Global Cloud (~47%)
  mews: { name: 'Mews', marketShare: 6, region: 'Global', segment: 'Boutique/Independent' },
  cloudbeds: { name: 'Cloudbeds', marketShare: 9, region: 'Americas', segment: 'Independent' },
  apaleo: { name: 'Apaleo', marketShare: 2.5, region: 'Europe', segment: 'Tech-forward' },
  opera: { name: 'Opera Cloud', marketShare: 28, region: 'Global', segment: 'Chains/Luxury' },
  // Europe (~14%)
  protel: { name: 'Protel', marketShare: 5, region: 'Europe', segment: 'Mid-scale' },
  guestline: { name: 'Guestline', marketShare: 4, region: 'UK/Ireland', segment: 'Independent' },
  roomraccoon: { name: 'RoomRaccoon', marketShare: 2, region: 'Europe', segment: 'Boutique' },
  clockpms: { name: 'Clock PMS', marketShare: 3, region: 'Eastern Europe', segment: 'Independent' },
  // Asia/Pacific (~10%)
  hotelogix: { name: 'Hotelogix', marketShare: 5, region: 'Asia/India', segment: 'Budget/Mid' },
  ezee: { name: 'eZee', marketShare: 3, region: 'Asia', segment: 'Budget' },
  littlehotelier: { name: 'Little Hotelier', marketShare: 2, region: 'APAC', segment: 'Small/B&B' },
  // US (~5%)
  stayntouch: { name: 'StayNTouch', marketShare: 3, region: 'US', segment: 'Mobile-first' },
  webrezpro: { name: 'WebRezPro', marketShare: 2, region: 'US', segment: 'Independent' },
  // Enterprise (~4%)
  inforhms: { name: 'Infor HMS', marketShare: 4, region: 'Global', segment: 'Enterprise' },
  // Vacation Rentals (~9.5%)
  hostaway: { name: 'Hostaway', marketShare: 4, region: 'Global', segment: 'Vacation Rentals' },
  beds24: { name: 'Beds24', marketShare: 1.5, region: 'Global', segment: 'Budget/Channel Manager' },
  guesty: { name: 'Guesty', marketShare: 4, region: 'Global', segment: 'Vacation Rentals' },
} as const;

// Calculate total market coverage
export function getTotalMarketCoverage(): number {
  return Object.values(ADAPTER_MARKET_INFO).reduce((sum, info) => sum + info.marketShare, 0);
}

// Get adapters by region
export function getAdaptersByRegion(region: string): string[] {
  return Object.entries(ADAPTER_MARKET_INFO)
    .filter(([_, info]) => info.region.toLowerCase().includes(region.toLowerCase()))
    .map(([slug]) => slug);
}

// Get adapters by segment
export function getAdaptersBySegment(segment: string): string[] {
  return Object.entries(ADAPTER_MARKET_INFO)
    .filter(([_, info]) => info.segment.toLowerCase().includes(segment.toLowerCase()))
    .map(([slug]) => slug);
}
