// Eywa AI - PMS Adapters Index
// Export all adapters and types

export * from './types';

// Cloud PMS Adapters
export { MewsAdapter } from './mews';
export { CloudbedsAdapter } from './cloudbeds';
export { ApaleoAdapter, type ApaleoAdapterConfig } from './apaleo';
export { OperaAdapter, type OperaAdapterConfig } from './opera';

// European PMS Adapters
export { ProtelAdapter, type ProtelAdapterConfig } from './protel';
export { GuestlineAdapter, type GuestlineAdapterConfig } from './guestline';
export { RoomRaccoonAdapter, type RoomRaccoonAdapterConfig } from './roomraccoon';

// Vacation Rental / Channel Managers
export { HostawayAdapter, type HostawayAdapterConfig } from './hostaway';
export { Beds24Adapter } from './beds24';

// Adapter registry for dynamic instantiation
export const ADAPTER_REGISTRY = {
  mews: 'MewsAdapter',
  cloudbeds: 'CloudbedsAdapter',
  apaleo: 'ApaleoAdapter',
  opera: 'OperaAdapter',
  protel: 'ProtelAdapter',
  guestline: 'GuestlineAdapter',
  roomraccoon: 'RoomRaccoonAdapter',
  hostaway: 'HostawayAdapter',
  beds24: 'Beds24Adapter',
} as const;

export type AdapterSlug = keyof typeof ADAPTER_REGISTRY;

// Market coverage info
export const ADAPTER_MARKET_INFO = {
  mews: { name: 'Mews', marketShare: 6, region: 'Global', segment: 'Boutique/Independent' },
  cloudbeds: { name: 'Cloudbeds', marketShare: 9, region: 'Americas', segment: 'Independent' },
  apaleo: { name: 'Apaleo', marketShare: 2.5, region: 'Europe', segment: 'Tech-forward' },
  opera: { name: 'Opera Cloud', marketShare: 28, region: 'Global', segment: 'Chains/Luxury' },
  protel: { name: 'Protel', marketShare: 5, region: 'Europe', segment: 'Mid-scale' },
  guestline: { name: 'Guestline', marketShare: 4, region: 'UK/Ireland', segment: 'Independent' },
  roomraccoon: { name: 'RoomRaccoon', marketShare: 2, region: 'Europe', segment: 'Boutique' },
  hostaway: { name: 'Hostaway', marketShare: 4, region: 'Global', segment: 'Vacation Rentals' },
  beds24: { name: 'Beds24', marketShare: 1.5, region: 'Global', segment: 'Budget' },
} as const;

// Calculate total market coverage
export function getTotalMarketCoverage(): number {
  return Object.values(ADAPTER_MARKET_INFO).reduce((sum, info) => sum + info.marketShare, 0);
}
