'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { 
  ArrowLeft, Check, Loader2, AlertCircle, Building2, 
  Cloud, Wifi, WifiOff, ExternalLink, Shield
} from 'lucide-react';

// PMS Provider definitions with metadata
const PMS_PROVIDERS = [
  {
    slug: 'mews',
    name: 'Mews',
    description: 'Modern cloud-based PMS for hotels & hostels',
    authType: 'OAuth 2.0',
    color: 'from-blue-500 to-blue-600',
    features: ['Real-time sync', 'Multi-property', 'Revenue management'],
    website: 'https://mews.com',
  },
  {
    slug: 'cloudbeds',
    name: 'Cloudbeds',
    description: 'All-in-one hospitality management suite',
    authType: 'OAuth 2.0',
    color: 'from-emerald-500 to-teal-600',
    features: ['Channel manager', 'Booking engine', 'PIE analytics'],
    website: 'https://cloudbeds.com',
  },
  {
    slug: 'apaleo',
    name: 'Apaleo',
    description: 'API-first PMS for innovative hoteliers',
    authType: 'OAuth 2.0',
    color: 'from-purple-500 to-indigo-600',
    features: ['Open API', 'Marketplace', 'Flexible integrations'],
    website: 'https://apaleo.com',
  },
  {
    slug: 'hostaway',
    name: 'Hostaway',
    description: 'Vacation rental & property management',
    authType: 'OAuth 2.0',
    color: 'from-orange-500 to-red-500',
    features: ['Airbnb sync', 'Direct bookings', 'Automation'],
    website: 'https://hostaway.com',
  },
  {
    slug: 'beds24',
    name: 'Beds24',
    description: 'Affordable channel manager & booking system',
    authType: 'API Key',
    color: 'from-cyan-500 to-blue-500',
    features: ['50+ channels', 'Auto-pricing', 'Payment processing'],
    website: 'https://beds24.com',
  },
];

interface Connection {
  connected: boolean;
  pms_type?: string;
  pms_info?: { name: string };
  environment?: string;
  last_sync_at?: string;
}

export default function PMSPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPMS, setSelectedPMS] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    environment: 'sandbox',
    client_token: '',
    access_token: '',
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const conn = await api.getPMSConnection();
        setConnection(conn);
        if (conn.connected) {
          setSelectedPMS(conn.pms_type);
        }
      } catch (err) {
        // Not logged in or no connection yet
        setConnection({ connected: false });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPMS) return;
    
    setError('');
    setConnecting(true);

    try {
      const result = await api.connectPMS({
        pms_type: selectedPMS,
        environment: formData.environment,
        client_token: formData.client_token,
        access_token: formData.access_token,
      });
      setConnection({ connected: true, ...result });
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const getProviderBySlug = (slug: string) => 
    PMS_PROVIDERS.find(p => p.slug === slug);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>Secure OAuth 2.0</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm mb-4">
            <Cloud className="w-4 h-4" />
            <span>PMS Integrations</span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Connect Your Property Management System
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Sync your hotel data in real-time. Our AI concierge will have access to availability, 
            rates, and reservations to provide accurate responses to your guests.
          </p>
        </div>

        {/* Current Connection Status */}
        {connection?.connected && (
          <div className="glass-card p-6 mb-8 border-emerald-400/30 bg-emerald-400/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-400/20">
                  <Wifi className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-emerald-400 text-lg">Connected</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-xs">
                      {connection.environment}
                    </span>
                  </div>
                  <p className="text-gray-400">
                    {getProviderBySlug(connection.pms_type || '')?.name || connection.pms_type}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Last sync</p>
                <p className="text-gray-400">
                  {connection.last_sync_at 
                    ? new Date(connection.last_sync_at).toLocaleString() 
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PMS Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            Available Integrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PMS_PROVIDERS.map((pms) => {
              const isConnected = connection?.connected && connection.pms_type === pms.slug;
              const isSelected = selectedPMS === pms.slug;
              
              return (
                <button
                  key={pms.slug}
                  onClick={() => setSelectedPMS(pms.slug)}
                  className={`group relative glass-card p-5 text-left transition-all duration-300 hover:scale-[1.02] ${
                    isSelected 
                      ? 'border-cyan-400/50 bg-cyan-400/5 ring-1 ring-cyan-400/30' 
                      : 'hover:border-white/20'
                  }`}
                >
                  {/* Status badge */}
                  {isConnected && (
                    <div className="absolute top-3 right-3">
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-400/20 text-emerald-400 text-xs">
                        <Check className="w-3 h-3" />
                        Connected
                      </span>
                    </div>
                  )}
                  
                  {/* Logo placeholder */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pms.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <span className="text-white font-bold text-lg">
                      {pms.name.charAt(0)}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <h3 className="font-semibold text-lg mb-1">{pms.name}</h3>
                  <p className="text-sm text-gray-400 mb-3">{pms.description}</p>
                  
                  {/* Features */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {pms.features.slice(0, 2).map((feature) => (
                      <span 
                        key={feature}
                        className="px-2 py-0.5 rounded-full bg-white/5 text-gray-500 text-xs"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  
                  {/* Auth type */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {pms.authType}
                    </span>
                    <a 
                      href={pms.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Website
                    </a>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Connection Form */}
        {selectedPMS && (
          <form onSubmit={handleConnect} className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getProviderBySlug(selectedPMS)?.color} flex items-center justify-center`}>
                <span className="text-white font-bold">
                  {getProviderBySlug(selectedPMS)?.name.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  Connect {getProviderBySlug(selectedPMS)?.name}
                </h2>
                <p className="text-sm text-gray-500">
                  Enter your API credentials to establish connection
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Environment</label>
                <select
                  value={formData.environment}
                  onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-400/50 transition"
                >
                  <option value="sandbox">🧪 Sandbox (Testing)</option>
                  <option value="production">🚀 Production</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {getProviderBySlug(selectedPMS)?.authType === 'API Key' ? 'API Key' : 'Client ID'}
                </label>
                <input
                  type="text"
                  value={formData.client_token}
                  onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition font-mono text-sm"
                  placeholder={getProviderBySlug(selectedPMS)?.authType === 'API Key' ? 'Your API key' : 'client_id_xxx'}
                  required
                />
              </div>
            </div>

            {getProviderBySlug(selectedPMS)?.authType === 'OAuth 2.0' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client Secret</label>
                <input
                  type="password"
                  value={formData.access_token}
                  onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition font-mono text-sm"
                  placeholder="client_secret_xxx"
                  required
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                type="submit"
                disabled={connecting}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Connect {getProviderBySlug(selectedPMS)?.name}
                  </>
                )}
              </button>
              <Link
                href="/playground"
                className="px-6 py-3 rounded-lg border border-white/20 text-gray-300 hover:bg-white/5 transition text-center"
              >
                Test API →
              </Link>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Your credentials are encrypted and stored securely. 
              <a href="#" className="text-cyan-400 hover:underline ml-1">Learn more about our security</a>
            </p>
          </form>
        )}

        {/* Help section */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Don't see your PMS? <a href="mailto:support@eywa.ai" className="text-cyan-400 hover:underline">Contact us</a> to request an integration.
          </p>
        </div>
      </main>
    </div>
  );
}
