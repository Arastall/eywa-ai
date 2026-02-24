-- Reviews & Ratings Service Tables
-- Created: 2024-02-24

-- Hotel external IDs for review sources
CREATE TABLE IF NOT EXISTS hotel_review_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL, -- 'google', 'tripadvisor'
  external_id VARCHAR(255) NOT NULL, -- place_id or location_id
  name VARCHAR(255), -- name from the source (for verification)
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hotel_id, source)
);

-- Aggregated ratings (updated daily)
CREATE TABLE IF NOT EXISTS hotel_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  rating DECIMAL(2,1), -- 1.0 to 5.0
  review_count INTEGER,
  ranking INTEGER, -- TripAdvisor city ranking
  ranking_context VARCHAR(255), -- "of 234 hotels in Paris"
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- Create index for unique constraint on hotel_id, source, and date
CREATE UNIQUE INDEX IF NOT EXISTS hotel_ratings_daily_idx 
ON hotel_ratings (hotel_id, source, DATE(fetched_at));

-- Individual reviews
CREATE TABLE IF NOT EXISTS hotel_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  external_review_id VARCHAR(255),
  author_name VARCHAR(255),
  author_url VARCHAR(512),
  profile_photo_url VARCHAR(512),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5
  text TEXT,
  language VARCHAR(10),
  relative_time_description VARCHAR(100), -- "a month ago"
  published_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hotel_id, source, external_review_id)
);

-- Computed Eywa Score (daily)
CREATE TABLE IF NOT EXISTS hotel_eywa_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  eywa_score DECIMAL(4,2), -- 0.00 to 10.00
  google_rating DECIMAL(2,1),
  google_weight DECIMAL(3,2) DEFAULT 0.50,
  google_confidence DECIMAL(3,2), -- based on review count
  tripadvisor_rating DECIMAL(2,1),
  tripadvisor_weight DECIMAL(3,2) DEFAULT 0.50,
  tripadvisor_confidence DECIMAL(3,2),
  trend VARCHAR(10), -- 'up', 'down', 'stable'
  trend_delta DECIMAL(4,2), -- change from previous score
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS hotel_ratings_hotel_idx ON hotel_ratings(hotel_id);
CREATE INDEX IF NOT EXISTS hotel_ratings_fetched_idx ON hotel_ratings(fetched_at DESC);
CREATE INDEX IF NOT EXISTS hotel_reviews_hotel_idx ON hotel_reviews(hotel_id);
CREATE INDEX IF NOT EXISTS hotel_reviews_source_idx ON hotel_reviews(source);
CREATE INDEX IF NOT EXISTS hotel_reviews_published_idx ON hotel_reviews(published_at DESC);
CREATE INDEX IF NOT EXISTS hotel_eywa_scores_hotel_idx ON hotel_eywa_scores(hotel_id);
CREATE INDEX IF NOT EXISTS hotel_eywa_scores_computed_idx ON hotel_eywa_scores(computed_at DESC);

-- Add Google Places API key to env (reminder comment)
-- GOOGLE_PLACES_API_KEY should be added to .env
