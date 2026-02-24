'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TrendingUp, Hotel, Users, DollarSign, Zap, Settings, LogOut, Play } from 'lucide-react';

interface HotelData {
  id: string;
  name: string;
  hotel_name: string;
  plan: string;
  licence_status: string;
}

interface Stats {
  bookings: { total: string; direct: string; ai_assisted: string };
  revenue: { total: string; net: string; commissions: string };
  ai: { total: string; total_cost: string; conversions: string };
  channels: Array<{ name: string; slug: string; bookings: string; revenue: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [hotelData, statsData] = await Promise.all([
          api.me(),
          api.getHotelStats()
        ]);
        setHotel(hotelData);
        setStats(statsData);
      } catch (err) {
        // Not authenticated
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleLogout = () => {
    api.clearToken();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gradient">EYWA</span>
              <span className="text-cyan-400/80 text-sm">AI</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-white font-medium">Dashboard</Link>
              <Link href="/pms" className="text-gray-400 hover:text-white transition">PMS</Link>
              <Link href="/playground" className="text-gray-400 hover:text-white transition">API Playground</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{hotel?.hotel_name}</span>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-gray-400">Here's what's happening with your hotel</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Hotel className="w-6 h-6" />}
            label="Total Bookings"
            value={stats?.bookings.total || '0'}
            subtext={`${stats?.bookings.direct || '0'} direct`}
            color="cyan"
          />
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            label="Revenue"
            value={`€${Number(stats?.revenue.total || 0).toLocaleString()}`}
            subtext={`€${Number(stats?.revenue.commissions || 0).toLocaleString()} in commissions`}
            color="emerald"
          />
          <StatCard
            icon={<Zap className="w-6 h-6" />}
            label="AI Sessions"
            value={stats?.ai.total || '0'}
            subtext={`${stats?.ai.conversions || '0'} conversions`}
            color="purple"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="AI ROI"
            value={stats?.ai.total_cost ? `€${Number(stats.ai.total_cost).toFixed(2)}` : '€0'}
            subtext="AI cost this month"
            color="amber"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link href="/pms" className="glass-card p-6 hover:border-cyan-400/30 transition group">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-cyan-400/20">
                <Settings className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-cyan-400 transition">Connect PMS</h3>
                <p className="text-sm text-gray-400">Link your property management system</p>
              </div>
            </div>
          </Link>

          <Link href="/playground" className="glass-card p-6 hover:border-purple-400/30 transition group">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-400/20">
                <Play className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-purple-400 transition">API Playground</h3>
                <p className="text-sm text-gray-400">Test PMS API endpoints</p>
              </div>
            </div>
          </Link>

          <div className="glass-card p-6 hover:border-emerald-400/30 transition group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-400/20">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-emerald-400 transition">AI Performance</h3>
                <p className="text-sm text-gray-400">Compare ChatGPT vs Claude</p>
              </div>
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Revenue by Channel</h2>
          <div className="space-y-4">
            {stats?.channels.filter(c => Number(c.revenue) > 0).map((channel) => (
              <div key={channel.slug} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${channel.slug === 'direct' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                  <span>{channel.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">€{Number(channel.revenue).toLocaleString()}</div>
                  <div className="text-sm text-gray-400">{channel.bookings} bookings</div>
                </div>
              </div>
            ))}
            {(!stats?.channels || stats.channels.filter(c => Number(c.revenue) > 0).length === 0) && (
              <p className="text-gray-500 text-center py-4">No booking data yet. Connect your PMS to start tracking.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color: 'cyan' | 'emerald' | 'purple' | 'amber';
}) {
  const colors = {
    cyan: 'from-cyan-400/20 to-cyan-600/5 border-cyan-400/30 text-cyan-400',
    emerald: 'from-emerald-400/20 to-emerald-600/5 border-emerald-400/30 text-emerald-400',
    purple: 'from-purple-400/20 to-purple-600/5 border-purple-400/30 text-purple-400',
    amber: 'from-amber-400/20 to-amber-600/5 border-amber-400/30 text-amber-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${colors[color]} border backdrop-blur-xl`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={colors[color].split(' ')[0]}>{icon}</div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${colors[color].split(' ').pop()}`}>{value}</div>
      <p className="text-sm text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}
