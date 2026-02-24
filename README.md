# EYWA AI - Hotel Revenue Intelligence Platform

> The neural network connecting your hotel to infinite revenue possibilities.

![Market Coverage](https://img.shields.io/badge/PMS%20Coverage-~90%25-success)
![Adapters](https://img.shields.io/badge/PMS%20Adapters-17-blue)
![Status](https://img.shields.io/badge/Status-Development-yellow)

## 🎯 Overview

Eywa AI is a comprehensive hotel revenue management platform that:

1. **Connects to any PMS** - 17 adapters covering ~90% of global hotel market
2. **Aggregates reviews & ratings** - Google Places + TripAdvisor unified scoring
3. **Optimizes revenue** - AI-powered pricing and upselling
4. **Tracks ROI** - Real-time analytics and performance metrics

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EYWA AI PLATFORM                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Frontend   │  │   Backend   │  │  PMS Gateway │        │
│  │  (Next.js)  │  │  (Express)  │  │   (Router)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│              ┌───────────┴───────────┐                     │
│              │     17 PMS Adapters   │                     │
│              └───────────┬───────────┘                     │
│                          │                                  │
│     ┌────────────────────┼────────────────────┐            │
│     ▼                    ▼                    ▼            │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │ Mews │  │Opera │  │Cloud │  │Protel│  │ +12  │       │
│  │      │  │Cloud │  │beds  │  │      │  │ more │       │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
eywa-ai/
├── src/                    # Frontend (Next.js)
│   ├── app/               # Pages
│   │   ├── dashboard/     # Main dashboard
│   │   ├── pms/           # PMS connections
│   │   ├── playground/    # API testing
│   │   └── login/         # Authentication
│   ├── components/        # React components
│   ├── lib/               # Utilities
│   └── adapters/          # PMS adapters (17 total)
│
├── backend/               # Backend API (Express + TypeScript)
│   └── src/
│       ├── controllers/   # Route handlers
│       ├── services/      # Business logic
│       │   ├── pms-router.ts      # PMS gateway router
│       │   └── telegram-commands.ts # Telegram interface
│       ├── routes/        # API routes
│       └── middleware/    # Auth, validation
│
├── docs/                  # Documentation
│   ├── DATABASE-SCHEMA-EN.md
│   └── REVIEWS-SERVICE-SPEC.md
│
└── out/                   # Static export (deployed)
```

## 🔌 PMS Adapters

### Coverage by Region

| Region | Adapters | Market Share |
|--------|----------|--------------|
| **Global Cloud** | Mews, Cloudbeds, Apaleo, Opera Cloud | ~47% |
| **Europe** | Protel, Guestline, RoomRaccoon, Clock PMS | ~14% |
| **Asia/Pacific** | Hotelogix, eZee, Little Hotelier | ~10% |
| **US** | StayNTouch, WebRezPro | ~5% |
| **Enterprise** | Infor HMS | ~4% |
| **Vacation Rentals** | Hostaway, Beds24, Guesty | ~9.5% |

**Total Coverage: ~90%**

### Adapter Interface

All adapters implement:
```typescript
interface IPMSAdapter {
  name: string;
  authenticate(): Promise<string>;
  getConfiguration(): Promise<HotelConfiguration>;
  getAvailability(params: AvailabilityParams): Promise<Availability[]>;
  getReservations(params?: ReservationParams): Promise<Reservation[]>;
  getRoomTypes(): Promise<RoomType[]>;
  getRates(): Promise<Rate[]>;
}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### Installation

```bash
# Clone repository
git clone https://github.com/Arastall/eywa-ai.git
cd eywa-ai

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

### Development

```bash
# Start frontend (port 3000)
npm run dev

# Start backend (port 55100)
cd backend && npm run dev
```

### Production Build

```bash
# Build frontend
npm run build

# Deploy static files
cp -r out/* /var/www/eywa-ai.com/html/
```

## 🔗 API Endpoints

### PMS Gateway

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pms/list` | GET | List all 17 PMS adapters |
| `/api/pms/test` | POST | Test connection to PMS |
| `/api/pms/connect` | POST | Connect hotel to PMS |
| `/api/pms/status` | GET | Get active connections |
| `/api/pms/:hotelId/availability` | GET | Get room availability |
| `/api/pms/:hotelId/reservations` | GET | Get reservations |
| `/api/pms/:hotelId/rooms` | GET | Get room types |
| `/api/pms/telegram` | POST | Telegram command handler |

### Telegram Commands

```
/eywa help          - Show available commands
/eywa list          - List all PMS adapters
/eywa test <pms>    - Test an adapter
/eywa connect <pms> <credentials>  - Connect to PMS
/eywa status        - Show active connections
```

## 📊 Database

PostgreSQL with the following main tables:

- `hotels` - Hotel profiles
- `users` - User accounts
- `licences` - Subscription management
- `pms_connections` - PMS credentials & sync status
- `bookings` - Reservation data
- `ai_sessions` - AI interaction logs
- `daily_stats` - Performance metrics
- `hotel_ratings` - Review aggregation (coming soon)

See [DATABASE-SCHEMA-EN.md](docs/DATABASE-SCHEMA-EN.md) for full schema.

## 🛣️ Roadmap

### Phase 1: Core Platform ✅
- [x] 17 PMS adapters
- [x] Gateway router service
- [x] Frontend dashboard
- [x] Telegram integration

### Phase 2: Reviews & Ratings (In Progress)
- [ ] Google Places integration
- [ ] TripAdvisor integration
- [ ] Unified Eywa Score
- [ ] Daily sync automation

### Phase 3: AI Features
- [ ] Pricing recommendations
- [ ] Upselling suggestions
- [ ] Guest communication AI

### Phase 4: Analytics
- [ ] ROI calculator
- [ ] Competitor analysis
- [ ] Revenue forecasting

## 🔐 Environment Variables

```env
# Backend
PORT=55100
DATABASE_URL=postgresql://user:pass@localhost:5432/eywa
JWT_SECRET=your-secret-key

# Google Places API
GOOGLE_PLACES_API_KEY=your-key

# TripAdvisor API (coming soon)
TRIPADVISOR_API_KEY=your-key
```

## 👥 Team

- **iainh** - Creator & Lead Developer
- **Gokhan** - Partner & Collaborator

## 📝 License

Private - All rights reserved.

---

**Eywa AI** - *Connecting hotels to infinite possibilities* 🏨✨
