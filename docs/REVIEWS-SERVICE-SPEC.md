# Eywa AI - Reviews & Ratings Service Specification

## Overview

The Reviews Service aggregates hotel ratings and reviews from multiple sources (Google Places, TripAdvisor) to provide a unified scoring system for Eywa-connected hotels.

## Goals

1. **Aggregate ratings** from multiple trusted sources
2. **Store reviews locally** for fast access and analytics
3. **Compute unified Eywa Score** (weighted average)
4. **Track rating trends** over time
5. **Enable competitive analysis** (compare with nearby hotels)

---

## Data Sources

### 1. Google Places API
- **Endpoint**: `https://maps.googleapis.com/maps/api/place/details/json`
- **Data**: rating (1-5), user_ratings_total, reviews (up to 5)
- **Cost**: ~$17/1000 requests
- **Rate limit**: 100 QPS
- **Auth**: API Key (existing GCP account)

### 2. TripAdvisor Content API
- **Endpoint**: `https://api.content.tripadvisor.com/api/v1/location/{id}/details`
- **Data**: rating, ranking, reviews (up to 5), photos
- **Cost**: Pay-per-use
- **Rate limit**: 50 QPS
- **Auth**: API Key (requires registration)

---

## Database Schema

```sql
-- Hotel external IDs for review sources
CREATE TABLE hotel_review_sources (
  id UUID PRIMARY KEY,
  hotel_id UUID REFERENCES hotels(id),
  source VARCHAR(50) NOT NULL, -- 'google', 'tripadvisor'
  external_id VARCHAR(255) NOT NULL, -- place_id or location_id
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hotel_id, source)
);

-- Aggregated ratings (updated daily)
CREATE TABLE hotel_ratings (
  id UUID PRIMARY KEY,
  hotel_id UUID REFERENCES hotels(id),
  source VARCHAR(50) NOT NULL,
  rating DECIMAL(2,1), -- 1.0 to 5.0
  review_count INTEGER,
  ranking INTEGER, -- TripAdvisor city ranking
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hotel_id, source, DATE(fetched_at))
);

-- Individual reviews
CREATE TABLE hotel_reviews (
  id UUID PRIMARY KEY,
  hotel_id UUID REFERENCES hotels(id),
  source VARCHAR(50) NOT NULL,
  external_review_id VARCHAR(255),
  author_name VARCHAR(255),
  rating INTEGER, -- 1-5
  text TEXT,
  language VARCHAR(10),
  published_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hotel_id, source, external_review_id)
);

-- Computed Eywa Score (daily)
CREATE TABLE hotel_eywa_scores (
  id UUID PRIMARY KEY,
  hotel_id UUID REFERENCES hotels(id),
  eywa_score DECIMAL(3,2), -- 0.00 to 10.00
  google_weight DECIMAL(3,2) DEFAULT 0.50,
  tripadvisor_weight DECIMAL(3,2) DEFAULT 0.50,
  trend VARCHAR(10), -- 'up', 'down', 'stable'
  computed_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### GET /api/hotels/:id/ratings
Returns aggregated ratings for a hotel.

**Response:**
```json
{
  "hotelId": "uuid",
  "eywaScore": 8.5,
  "trend": "up",
  "sources": {
    "google": {
      "rating": 4.5,
      "reviewCount": 1247,
      "lastUpdated": "2024-03-01T00:00:00Z"
    },
    "tripadvisor": {
      "rating": 4.0,
      "reviewCount": 892,
      "ranking": 15,
      "rankingContext": "of 234 hotels in Paris",
      "lastUpdated": "2024-03-01T00:00:00Z"
    }
  }
}
```

### GET /api/hotels/:id/reviews
Returns recent reviews for a hotel.

**Query params:**
- `source`: 'google' | 'tripadvisor' | 'all'
- `limit`: number (default 10)
- `language`: 'en' | 'fr' | etc.

**Response:**
```json
{
  "hotelId": "uuid",
  "reviews": [
    {
      "source": "google",
      "author": "John D.",
      "rating": 5,
      "text": "Amazing stay!",
      "language": "en",
      "publishedAt": "2024-02-15T10:30:00Z"
    }
  ],
  "total": 2139
}
```

### POST /api/hotels/:id/link-reviews
Links a hotel to external review sources.

**Request:**
```json
{
  "google": {
    "placeId": "ChIJ..."
  },
  "tripadvisor": {
    "locationId": "123456"
  }
}
```

### GET /api/hotels/:id/competitors
Returns nearby competitor hotels with their ratings.

---

## Eywa Score Calculation

```
eywaScore = (
  (google_rating * google_weight * google_confidence) +
  (tripadvisor_rating * tripadvisor_weight * ta_confidence)
) / total_weight * 2  // Scale to 0-10

Where:
- google_weight = 0.50 (configurable)
- tripadvisor_weight = 0.50 (configurable)
- confidence = min(1.0, review_count / 100) // More reviews = more confidence
```

---

## Sync Strategy

### Initial Setup (on hotel onboarding)
1. Get hotel address from PMS
2. Search Google Places for matching hotel
3. Search TripAdvisor for matching hotel
4. Store external IDs
5. Fetch initial ratings & reviews

### Daily Sync (cron job)
1. For each hotel with linked sources:
   - Fetch latest rating from Google
   - Fetch latest rating from TripAdvisor
   - Fetch new reviews (delta)
   - Compute new Eywa Score
   - Store in database

### Webhook (future)
- TripAdvisor offers webhooks for review updates
- Google does not

---

## Implementation Phases

### Phase 1: Core Service (Week 1)
- [ ] Database schema creation
- [ ] Google Places integration
- [ ] Basic rating fetch & store
- [ ] API endpoints

### Phase 2: TripAdvisor (Week 2)
- [ ] TripAdvisor API registration
- [ ] TripAdvisor integration
- [ ] Eywa Score computation

### Phase 3: Automation (Week 3)
- [ ] Daily sync cron job
- [ ] Hotel matching algorithm
- [ ] Admin UI for source linking

### Phase 4: Analytics (Week 4)
- [ ] Trend tracking
- [ ] Competitor comparison
- [ ] Dashboard widgets

---

## Cost Estimation

| Source | Calls/day | Cost/call | Monthly |
|--------|-----------|-----------|---------|
| Google Places | 1000 | $0.017 | ~$500 |
| TripAdvisor | 1000 | ~$0.01 | ~$300 |
| **Total** | | | **~$800** |

*For 1000 hotels with daily sync*

---

## Security Considerations

- API keys stored in environment variables
- Rate limiting on our endpoints
- Cache responses to minimize external calls
- GDPR: Don't store reviewer personal data beyond name

---

## Dependencies

- Google Cloud Platform account (existing)
- TripAdvisor Content API key (to register)
- PostgreSQL database
- Node.js cron scheduler

