require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectRedis, isRedisConnected } = require('./config/redis');
const weatherRoutes = require('./routes/weatherRoutes');
const weatherController = require('./controllers/weatherController');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration to support local frontend development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback allow in local dev
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

const path = require('path');

app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Health Check
app.get('/api/health', weatherController.healthCheck);

// Mount Weather Routes
app.use('/api/weather', weatherRoutes);

// API Documentation / metadata route
app.get('/api', (req, res) => {
  res.json({
    name: 'Weather Reporting Dashboard API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health',
      'GET /api/weather/cities',
      'GET /api/weather/latest',
      'POST /api/weather/fetch',
      'GET /api/weather/reports',
      'GET /api/weather/report/:timestamp'
    ],
    redisStatus: isRedisConnected() ? 'connected' : 'disconnected'
  });
});

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.url} not found`
  });
});

// Global Error Handler (Never expose raw stack traces)
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);

  const statusCode = err.statusCode || (err.response && err.response.status) || 500;
  let message = err.message || 'Internal server error';

  if (err.message && err.message.includes('Redis')) {
    message = 'Redis service unavailable. Please ensure Redis server is running.';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    message = 'Unable to connect to external service or database';
  } else if (err.code === 'ETIMEDOUT') {
    message = 'Request timed out while contacting external service';
  }

  res.status(statusCode).json({
    success: false,
    message
  });
});

// Initialize server and Redis connection
async function startServer() {
  try {
    await connectRedis();
  } catch (err) {
    console.error('Failed to initialize Redis on startup:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`Weather Analytics Server running on port ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=============================================`);
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log('\nShutting down gracefully...');
    server.close(async () => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

startServer();
