# Eywa AI - Agent Instructions

## Project Overview
Eywa AI is a hotel revenue intelligence platform that connects to various PMS (Property Management Systems).
Think of it as the neural network from Avatar's Pandora - connecting all hotels together.

## Current State
- Next.js 14 frontend with futuristic bioluminescent theme (cyan/purple/green)
- Mews PMS adapter started in `/src/adapters/mews.ts`
- Demo credentials configured and tested

## Your Tasks

### 1. Complete Mews Adapter
File: `src/adapters/mews.ts`
- Test and fix all endpoints against the Mews demo API
- Add proper error handling
- Add TypeScript types matching Mews API responses

### 2. Create API Routes
Create Next.js API routes in `src/app/api/`:
- `GET /api/hotel/config` - Get hotel configuration
- `GET /api/hotel/availability` - Get room availability
- `GET /api/hotel/reservations` - Get reservations list
- `GET /api/hotel/stats` - Get aggregated stats (occupancy, revenue, ADR, RevPAR)

### 3. Connect Dashboard to Real Data
Update components to fetch from API routes:
- `src/components/DashboardSection.tsx` - Use real data from Mews
- Add loading states and error handling

### 4. Add ROI Calculator
Create `src/components/ROICalculator.tsx`:
- Input: number of rooms, current ADR, current occupancy
- Calculate projected improvement with Eywa
- Show animated results

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion (animations)
- Recharts (charts)

## Demo API Credentials (Mews)
Already in `src/adapters/mews.ts`:
- URL: https://api.mews-demo.com/api/connector/v1
- ClientToken: E0D439EE522F44368DC78E1BFB03710C-D24FB11DBE31D4621C4817E028D9E1D
- AccessToken: C66EF7B239D24632943D115EDE9CB810-EA00F8FD8294692C940F6B5A8F9453D

## Commits
Make atomic commits. Push to main.
