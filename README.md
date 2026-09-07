# Weather Reporting & Analytics Dashboard

A complete, production-grade Weather Management and Reporting Dashboard powered by **Node.js**, **Express**, **Redis**, and **Open-Meteo API**, featuring a modern, responsive UI built with **vanilla HTML5/CSS3/JavaScript** and **Chart.js**.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technologies](#technologies)
4. [Folder Structure](#folder-structure)
5. [Redis Setup & Configuration](#redis-setup--configuration)
6. [Node.js Installation](#nodejs-installation)
7. [Environment Variables](#environment-variables)
8. [How to Start the Backend](#how-to-start-the-backend)
9. [How to Start the Frontend](#how-to-start-the-frontend)
10. [REST API Documentation](#rest-api-documentation)
11. [Redis Data Structure](#redis-data-structure)
12. [User Workflows & Actions](#user-workflows--actions)
13. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Project Overview

The Weather Reporting Dashboard provides real-time meteorological tracking and historical analytical reporting across **20 major metropolitan areas in the United States**.

Key capabilities:
- **Two Distinct Operations**:
  - **"Get Weather Data"**: Fetches fresh current weather for all 20 US cities concurrently via Open-Meteo API, caches the latest per-city telemetry in Redis, records a complete historical report snapshot in Redis, and updates the dashboard.
  - **"Refresh"**: Reads strictly from Redis cache (`GET /api/weather/latest`) without calling Open-Meteo, demonstrating actual Redis persistence and instant sub-millisecond retrieval.
- **6 Dynamic Metric Cards**:
  1. Total Cities (20)
  2. Average Temperature (°F)
  3. Hottest City (Name & °F)
  4. Coldest City (Name & °F)
  5. Average Humidity (%)
  6. Average Wind Speed (mph)
- **3 Responsive Visualizations (Chart.js)**:
  1. Temperature by City (Bar Chart)
  2. Humidity by City (Bar Chart)
  3. Wind Speed by City (Line/Area Chart)
- **Interactive Telemetry Table**:
  - Instant client-side search (by City, State, or State Code).
  - Condition filtering (All, Clear, Cloudy, Rain, Snow, Thunderstorm, Fog).
  - Multi-column sort (City, Temperature, Feels Like, Humidity, Wind Speed, Condition, Last Updated).
- **Historical Reports Archive (`reports.html`)**:
  - Inspect all past snapshots stored in Redis (capped to latest 50 reports).
  - Click any report to view aggregated statistics (Avg, High, Low, Hottest, Coldest, Avg Wind/Humidity) and full 20-city table breakdown.
- **Configured Cities Directory (`cities.html`)**:
  - Overview cards for all 20 cities with exact coordinates, timezones, and current weather.
  - Interactive detail inspection modal.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (HTML5 / CSS3 / Vanilla JS)     │
│  - index.html (Dashboard)                                   │
│  - reports.html (Historical Archives)                       │
│  - cities.html (Metropolitan Directory)                     │
│  - Chart.js 4.4.x Visualizations                            │
└───────────────────────────────┬─────────────────────────────┘
                                │ REST API (JSON)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Backend (Node.js)             │
│  - CORS & JSON Middleware                                   │
│  - weatherRoutes & weatherController                        │
│  - Error Handling & Resilient Partial Failure Safety        │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    Open-Meteo Forecast API  │ │   Redis Database (Port 6379)│
│  - Promise.all() Concurrency│ │  - Latest City Telemetry    │
│  - Metric-to-Imperial Conv. │ │  - Historical Reports (List)│
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## Technologies

### Frontend
- **HTML5 & Modern Semantic Elements**
- **CSS3** (CSS Variables, Flexbox, Grid, Glassmorphism, animations)
- **Vanilla JavaScript (ES6+)** (No React/Next.js/framework bloat)
- **Chart.js v4.4.7** (Bar, Line, Area data visualizations)
- **Fetch API** (Native HTTP communication)

### Backend
- **Node.js** (v18+)
- **Express.js** (v4.21+)
- **Axios** (v1.7+)
- **CORS** (v2.8+)
- **dotenv** (v16.4+)
- **nodemon** (v3.1+ for hot-reloading development)

### Database & Storage
- **Redis** (official `redis` Node.js client v4.7+)
- Supports local Redis (Windows / Linux / macOS / Docker / Memurai) and cloud Redis URLs (e.g., Redis Cloud, Upstash).

### Weather Data Provider
- **Open-Meteo API** (Free, open, real-time forecast API without rate-limits for educational use).

---

## Folder Structure

```
weather-dashboard/
├── frontend/
│   ├── index.html           # Main analytics dashboard
│   ├── reports.html         # Historical report archive and inspection
│   ├── cities.html          # 20 US cities directory and coordinate viewer
│   ├── css/
│   │   └── style.css        # Professional custom stylesheet
│   ├── js/
│   │   ├── api.js           # Fetch API client
│   │   ├── app.js           # Dashboard controller, charts, table, toasts
│   │   ├── reports.js       # Reports page controller & report details modal
│   │   └── cities.js        # Cities page controller & detail modal
│   └── assets/
│       └── logo.svg         # Application icon
│
├── backend/
│   ├── server.js            # Express server entry point & static hosting
│   ├── package.json         # Dependencies & scripts
│   ├── .env                 # Environment configuration (active)
│   ├── .env.example         # Environment template
│   ├── config/
│   │   └── redis.js         # Redis client connection and lifecycle hooks
│   ├── data/
│   │   └── cities.js        # 20 US cities coordinate dataset
│   ├── routes/
│   │   └── weatherRoutes.js # REST API route declarations
│   ├── controllers/
│   │   └── weatherController.js # API request controllers
│   ├── services/
│   │   ├── weatherService.js    # Open-Meteo concurrent fetch & statistics
│   │   └── redisService.js      # Redis cache operations & report pruning
│   └── utils/
│       └── weatherCode.js   # WMO weather code mapping and unit converters
│
└── README.md
```

---

## 20 Configured US Cities

Exact geographic coordinates and timezones configured in `backend/data/cities.js`:

| # | City | State | Latitude | Longitude | Slug |
|---|---|---|---|---|---|
| 1 | New York | New York (NY) | 40.7128 | -74.0060 | `new-york` |
| 2 | Los Angeles | California (CA) | 34.0522 | -118.2437 | `los-angeles` |
| 3 | Chicago | Illinois (IL) | 41.8781 | -87.6298 | `chicago` |
| 4 | Houston | Texas (TX) | 29.7604 | -95.3698 | `houston` |
| 5 | Phoenix | Arizona (AZ) | 33.4484 | -112.0740 | `phoenix` |
| 6 | Philadelphia | Pennsylvania (PA) | 39.9526 | -75.1652 | `philadelphia` |
| 7 | San Antonio | Texas (TX) | 29.4241 | -98.4936 | `san-antonio` |
| 8 | San Diego | California (CA) | 32.7157 | -117.1611 | `san-diego` |
| 9 | Dallas | Texas (TX) | 32.7767 | -96.7970 | `dallas` |
| 10 | San Jose | California (CA) | 37.3382 | -121.8863 | `san-jose` |
| 11 | Austin | Texas (TX) | 30.2672 | -97.7431 | `austin` |
| 12 | Jacksonville | Florida (FL) | 30.3322 | -81.6557 | `jacksonville` |
| 13 | San Francisco | California (CA) | 37.7749 | -122.4194 | `san-francisco` |
| 14 | Seattle | Washington (WA) | 47.6062 | -122.3321 | `seattle` |
| 15 | Denver | Colorado (CO) | 39.7392 | -104.9903 | `denver` |
| 16 | Washington DC | District of Columbia (DC) | 38.9072 | -77.0369 | `washington-dc` |
| 17 | Boston | Massachusetts (MA) | 42.3601 | -71.0589 | `boston` |
| 18 | Las Vegas | Nevada (NV) | 36.1699 | -115.1398 | `las-vegas` |
| 19 | Miami | Florida (FL) | 25.7617 | -80.1918 | `miami` |
| 20 | Atlanta | Georgia (GA) | 33.7490 | -84.3880 | `atlanta` |

---

## Redis Setup & Configuration

### Option A: Windows Native (Winget)
```powershell
# Install Redis for Windows via winget
winget install taizod1024.redis-windows-fork

# Start Redis Server
redis-server --save "" --appendonly no

# Test Connection
redis-cli ping
# Expected output: PONG
```

### Option B: Docker
```bash
docker run -d --name redis-weather -p 6379:6379 redis:alpine
```

### Option C: Linux / macOS
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install redis-server
sudo systemctl start redis

# macOS Homebrew
brew install redis
brew services start redis
```

---

## Node.js Installation

Ensure Node.js (v18 or higher) and npm are installed:
```bash
node -v
npm -v
```
Download installer from [nodejs.org](https://nodejs.org) if needed.

---

## Environment Variables

Configure `backend/.env`:

```env
PORT=5000
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5500
```

---

## How to Start the Backend

1. Navigate to the backend directory:
   ```bash
   cd weather-dashboard/backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   # Production mode
   npm start

   # Development mode (auto reload on file edits)
   npm run dev
   ```
4. Verify backend is running:
   Visit `http://localhost:5000/api/health` in your browser.
   Response:
   ```json
   {
     "success": true,
     "message": "Weather API is running",
     "redis": "connected"
   }
   ```

---

## How to Start the Frontend

You have two convenient options:

### Option 1: Integrated (Recommended)
The Express backend automatically serves the frontend statically!
Simply open your browser to:
- **Dashboard**: `http://localhost:5000/` or `http://localhost:5000/index.html`
- **Reports**: `http://localhost:5000/reports.html`
- **Cities**: `http://localhost:5000/cities.html`

### Option 2: Standalone HTTP Server (Port 5500)
Using VS Code Live Server or Node's `serve`:
```bash
cd weather-dashboard/frontend
npx serve -p 5500
```
Open `http://localhost:5500`. The frontend automatically handles CORS communication with `http://localhost:5000`.

---

## REST API Documentation

### 1. Health Check
`GET /api/health`
- **Purpose**: Verifies Express server and Redis connectivity.
- **Response**:
  ```json
  {
    "success": true,
    "message": "Weather API is running",
    "redis": "connected"
  }
  ```

### 2. Configured Cities
`GET /api/weather/cities`
- **Purpose**: Returns the list of 20 configured US cities with geographical coordinates and metadata.

### 3. Latest Weather (Strictly Redis)
`GET /api/weather/latest`
- **Purpose**: Reads latest cached telemetry strictly from Redis. **Never calls Open-Meteo.**
- **Empty State Response (First Launch)**:
  ```json
  {
    "success": false,
    "message": "No weather data available. Please fetch weather data first."
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "count": 20,
    "fetchedAt": "2026-09-07T16:40:26.965Z",
    "timestamp": 1788799226965,
    "summary": {
      "totalCities": 20,
      "successfulCount": 20,
      "avgTemperature": 78.4,
      "highestTemperature": 94.5,
      "lowestTemperature": 62.1,
      "hottestCity": { "city": "Phoenix", "stateCode": "AZ", "temperature": 94.5 },
      "coldestCity": { "city": "Seattle", "stateCode": "WA", "temperature": 62.1 },
      "avgHumidity": 54,
      "avgWindSpeed": 7.8
    },
    "data": [...]
  }
  ```

### 4. Fetch Fresh Weather
`POST /api/weather/fetch`
- **Purpose**: Concurrently fetches real-time telemetry from Open-Meteo for all 20 cities using `Promise.all()`. Stores each city in Redis, records a historical snapshot, prunes reports to 50, and returns the updated data.

### 5. Historical Reports
`GET /api/weather/reports`
- **Purpose**: Returns list of all historical reports stored in Redis.

### 6. Specific Historical Report
`GET /api/weather/report/:timestamp`
- **Purpose**: Returns full 20-city snapshot and aggregated metrics for a specific timestamp.

---

## Redis Data Structure

| Key Pattern | Type | Description |
|---|---|---|
| `weather:latest:<slug>` | String (JSON) | Telemetry for a city (e.g. `weather:latest:new-york`). |
| `weather:latest:meta` | String (JSON) | Metadata of latest snapshot (timestamp, summary, count). |
| `weather:reports` | List | Ordered list of report timestamps (`LPUSH`, `LTRIM 0 49`). |
| `weather:report:<timestamp>` | String (JSON) | Complete snapshot object containing 20 cities & summary stats. |

---

## Troubleshooting & FAQ

- **Redis is offline / "Redis service unavailable"**:
  Ensure Redis is running. In PowerShell, execute:
  `redis-server` or verify with `redis-cli ping`.
- **Port 5000 already in use**:
  Change `PORT=5001` in `backend/.env` and restart.
- **Cross-Origin (CORS) blocked**:
  `backend/.env` defines `FRONTEND_URL`. Ensure your local port matches `FRONTEND_URL` or run directly via `http://localhost:5000`.
- **One city times out on Open-Meteo**:
  The system includes automatic 1-retry logic and resilient partial-failure handling. The other 19 cities continue without failing the request.
