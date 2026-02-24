const API_URL = process.env.NEXT_PUBLIC_API_URL || '/eywa/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('eywa_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('eywa_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eywa_token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(payload: { email: string; password: string; first_name: string; last_name: string; hotel_name: string }) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(data.token);
    return data;
  }

  async me() {
    return this.request('/auth/me');
  }

  // Hotel
  async getHotel() {
    return this.request('/hotel');
  }

  async getHotelStats() {
    return this.request('/hotel/stats');
  }

  // Bookings
  async getBookings(params?: Record<string, any>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/bookings${query}`);
  }

  async getBookingStats(period = 30) {
    return this.request(`/bookings/stats?period=${period}`);
  }

  async getChannels() {
    return this.request('/channels');
  }

  // PMS
  async getPMSTypes() {
    return this.request('/pms/types');
  }

  async getPMSConnection() {
    return this.request('/pms/connection');
  }

  async connectPMS(payload: { pms_type: string; environment: string; client_token: string; access_token: string }) {
    return this.request('/pms/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async testPMSEndpoint(endpoint: string, method: string, body?: any) {
    return this.request('/pms/test', {
      method: 'POST',
      body: JSON.stringify({ endpoint, method, body }),
    });
  }

  async getAPILogs(limit = 50) {
    return this.request(`/pms/logs?limit=${limit}`);
  }

  // AI
  async getAIProviders() {
    return this.request('/ai/providers');
  }

  async getAIStats(period = 30) {
    return this.request(`/ai/stats?period=${period}`);
  }

  async getROIMetrics() {
    return this.request('/ai/roi');
  }

  async compareProviders() {
    return this.request('/ai/compare');
  }
}

export const api = new ApiClient();
