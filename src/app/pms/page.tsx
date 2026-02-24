'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';

interface PMSType {
  slug: string;
  name: string;
  endpoints: Array<{ method: string; path: string; name: string }>;
}

export default function PMSPage() {
  const router = useRouter();
  const [pmsTypes, setPmsTypes] = useState<PMSType[]>([]);
  const [connection, setConnection] = useState<any>(null);
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
        const [types, conn] = await Promise.all([
          api.getPMSTypes(),
          api.getPMSConnection()
        ]);
        setPmsTypes(types);
        setConnection(conn);
        if (conn.connected) {
          setSelectedPMS(conn.pms_type);
        }
      } catch (err) {
        router.push('/login');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">PMS Connection</h1>
        <p className="text-gray-400 mb-8">Connect your Property Management System to sync data</p>

        {/* Current Connection */}
        {connection?.connected && (
          <div className="glass-card p-6 mb-8 border-emerald-400/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-emerald-400/20">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-400">Connected</h3>
                <p className="text-sm text-gray-400">
                  {connection.pms_info?.name || connection.pms_type} • {connection.environment}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Last sync: {connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : 'Never'}
            </div>
          </div>
        )}

        {/* PMS Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Select your PMS</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pmsTypes.map((pms) => (
              <button
                key={pms.slug}
                onClick={() => setSelectedPMS(pms.slug)}
                className={`glass-card p-4 text-left transition hover:border-cyan-400/30 ${
                  selectedPMS === pms.slug ? 'border-cyan-400/50 bg-cyan-400/5' : ''
                }`}
              >
                <h3 className="font-semibold">{pms.name}</h3>
                <p className="text-sm text-gray-400">{pms.endpoints.length} endpoints</p>
              </button>
            ))}
          </div>
        </div>

        {/* Connection Form */}
        {selectedPMS && (
          <form onSubmit={handleConnect} className="glass-card p-6 space-y-6">
            <h2 className="text-xl font-semibold">Configure {pmsTypes.find(p => p.slug === selectedPMS)?.name}</h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Environment</label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-400/50 transition"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Client Token</label>
              <input
                type="text"
                value={formData.client_token}
                onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition font-mono text-sm"
                placeholder="Your PMS client token"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Access Token</label>
              <input
                type="text"
                value={formData.access_token}
                onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition font-mono text-sm"
                placeholder="Your PMS access token"
                required
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={connecting}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {connecting ? 'Connecting...' : 'Connect PMS'}
              </button>
              <Link
                href="/playground"
                className="px-6 py-3 rounded-lg border border-white/20 text-gray-300 hover:bg-white/5 transition"
              >
                Test API →
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
