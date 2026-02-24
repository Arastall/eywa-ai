'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Play, Loader2, Check, X, Clock } from 'lucide-react';

interface PMSEndpoint {
  method: string;
  path: string;
  name: string;
}

interface LogEntry {
  id: string;
  endpoint: string;
  method: string;
  response_code: number;
  latency_ms: number;
  created_at: string;
}

export default function PlaygroundPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<any>(null);
  const [endpoints, setEndpoints] = useState<PMSEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<PMSEndpoint | null>(null);
  const [requestBody, setRequestBody] = useState('{}');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [conn, logsData] = await Promise.all([
          api.getPMSConnection(),
          api.getAPILogs(20)
        ]);
        setConnection(conn);
        setLogs(logsData);
        if (conn.pms_info?.endpoints) {
          setEndpoints(conn.pms_info.endpoints);
          setSelectedEndpoint(conn.pms_info.endpoints[0]);
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleExecute = async () => {
    if (!selectedEndpoint) return;
    
    setExecuting(true);
    setResponse(null);

    try {
      let body = {};
      try {
        body = JSON.parse(requestBody);
      } catch {}

      const result = await api.testPMSEndpoint(
        selectedEndpoint.path,
        selectedEndpoint.method,
        body
      );
      setResponse(result);

      // Refresh logs
      const newLogs = await api.getAPILogs(20);
      setLogs(newLogs);
    } catch (err: any) {
      setResponse({ success: false, error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!connection?.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No PMS Connected</h2>
          <p className="text-gray-400 mb-6">Connect your PMS first to use the API Playground</p>
          <Link
            href="/pms"
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-semibold"
          >
            Connect PMS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Connected to</span>
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-400 text-sm font-medium">
              {connection.pms_info?.name}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">API Playground</h1>
        <p className="text-gray-400 mb-8">Test PMS API endpoints in real-time</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Endpoint Selection */}
          <div className="glass-card p-4">
            <h2 className="font-semibold mb-4">Endpoints</h2>
            <div className="space-y-2">
              {endpoints.map((ep, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedEndpoint?.path === ep.path
                      ? 'bg-cyan-400/20 border border-cyan-400/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                      ep.method === 'GET' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="text-sm truncate">{ep.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-mono truncate">{ep.path}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Request/Response */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Request</h2>
                <button
                  onClick={handleExecute}
                  disabled={executing || !selectedEndpoint}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {executing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Execute
                </button>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span className={`font-mono px-2 py-0.5 rounded ${
                    selectedEndpoint?.method === 'GET' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
                  }`}>
                    {selectedEndpoint?.method}
                  </span>
                  <span className="font-mono">{selectedEndpoint?.path}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Request Body (JSON)</label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full h-32 px-4 py-3 rounded-lg bg-black/50 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-cyan-400/50 transition resize-none"
                  placeholder="{}"
                />
              </div>
            </div>

            {/* Response */}
            {response && (
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Response</h2>
                  <div className="flex items-center gap-3">
                    {response.latency_ms && (
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock className="w-4 h-4" />
                        {response.latency_ms}ms
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-sm ${
                      response.success ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {response.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {response.status || (response.success ? 'OK' : 'Error')}
                    </span>
                  </div>
                </div>
                <pre className="p-4 rounded-lg bg-black/50 border border-white/10 overflow-auto max-h-96 text-sm font-mono">
                  {JSON.stringify(response.data || response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="mt-8 glass-card p-4">
          <h2 className="font-semibold mb-4">Recent API Calls</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-3">Endpoint</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Latency</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="text-gray-300">
                    <td className="py-2 font-mono text-xs">{log.endpoint}</td>
                    <td className="py-2">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        log.method === 'GET' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
                      }`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={log.response_code < 400 ? 'text-emerald-400' : 'text-red-400'}>
                        {log.response_code}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">{log.latency_ms}ms</td>
                    <td className="py-2 text-gray-500">{new Date(log.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No API calls yet. Execute an endpoint to see logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
