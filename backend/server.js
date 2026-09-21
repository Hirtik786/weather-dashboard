require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectRedis, isRedisConnected } = require('./config/redis');
const { initDatabase } = require('./config/database');
const weatherRoutes = require('./routes/weatherRoutes');
const weatherController = require('./controllers/weatherController');
const authRoutes = require('./routes/authRoutes');
const amazonRoutes = require('./routes/amazonRoutes');
const sendboxRoutes = require('./routes/sendboxRoutes');
const productRoutes = require('./routes/productRoutes');

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

// Mount Multi-User & Product Management Routes
app.use('/api/auth', authRoutes);
app.use('/api/amazon', amazonRoutes);
app.use('/api/sendbox', sendboxRoutes);
app.use('/api/products', productRoutes);

// API Documentation / metadata route
app.get('/api', (req, res) => {
  res.json({
    name: 'Weather Reporting & Amazon Product Dashboard API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health',
      'GET /api/weather/cities',
      'GET /api/weather/latest',
      'POST /api/weather/fetch',
      'GET /api/weather/reports',
      'GET /api/weather/report/:timestamp',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/amazon/status',
      'POST /api/amazon/connect',
      'POST /api/amazon/callback',
      'POST /api/amazon/disconnect',
      'POST /api/amazon/simulation',
      'GET /api/sendbox/status',
      'GET /api/products',
      'GET /api/products/:id',
      'POST /api/products',
      'PUT /api/products/:id',
      'DELETE /api/products/:id',
      'POST /api/products/:id/sync'
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

// Initialize server, SQLite database, and Redis connection
async function startServer() {
  try {
    initDatabase();
  } catch (err) {
    console.error('Failed to initialize SQLite database on startup:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`Weather Analytics Server running on port ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=============================================`);
  });

  // Connect to Redis in background without blocking server startup
  connectRedis().catch((err) => {
    console.warn('[Redis] Redis initial connection notice:', err.message);
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
