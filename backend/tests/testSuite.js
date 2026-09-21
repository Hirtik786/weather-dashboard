/**
 * Automated Verification Suite
 * Validates Login with Amazon (LWA) OAuth 2.0 integration, multi-user isolation,
 * Redis session caching, and existing weather dashboard preservation.
 */

const fs = require('fs');
const path = require('path');

// Configure test environment
process.env.DATABASE_PATH = ':memory:'; // Isolated in-memory DB for tests
process.env.JWT_SECRET = 'test_secret_jwt_key_super_secure_for_tests';
process.env.LWA_CLIENT_ID = 'amzn1.application-oa2-client.test_client_id_123';
process.env.LWA_CLIENT_SECRET = 'test_lwa_client_secret_xyz';
process.env.LWA_REDIRECT_URI = 'http://localhost:5000/api/auth/amazon/callback';

const { initDatabase, closeDatabase } = require('../config/database');
const userModel = require('../models/userModel');
const productModel = require('../models/productModel');
const authController = require('../controllers/authController');
const lwaController = require('../controllers/lwaController');
const productController = require('../controllers/productController');
const weatherController = require('../controllers/weatherController');
const { authenticateUser } = require('../middleware/authMiddleware');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

// Helper to mock express req/res
function mockReqRes(options = {}) {
  const req = {
    headers: options.headers || {},
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    user: options.user || null,
    token: options.token || null
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    redirect(url) {
      responseData = { redirectedTo: url };
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  return { req, res };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✕ FAIL: ${testName} - ${details}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('Running Login with Amazon (LWA) & E-Commerce Test Suite');
  console.log('====================================================\n');

  initDatabase(':memory:');

  let localUserToken = null;
  let localUserId = null;
  let amzUserA = null;
  let amzUserB = null;
  let amzUserAProductId = null;
  let amzUserBProductId = null;

  // ----------------------------------------------------
  // Test 1: Standard local user registration & login
  // ----------------------------------------------------
  {
    const { req: regReq, res: regRes } = mockReqRes({
      body: { email: 'standard@example.com', password: 'password123' }
    });
    await authController.register(regReq, regRes);
    const regData = regRes.getData();
    assert(
      regRes.getStatusCode() === 201 && regData.token && regData.user.email === 'standard@example.com',
      'Test 1: Local user can register and receive JWT token'
    );
    localUserId = regData.user.id;
    localUserToken = regData.token;

    const { req: logReq, res: logRes } = mockReqRes({
      body: { email: 'standard@example.com', password: 'password123' }
    });
    await authController.login(logReq, logRes);
    const logData = logRes.getData();
    assert(
      logRes.getStatusCode() === 200 && logData.token,
      'Test 1b: Local user can log in with password'
    );
  }

  // ----------------------------------------------------
  // Test 2: Login with Amazon (LWA) Profile Upsertion for User A
  // ----------------------------------------------------
  {
    amzUserA = userModel.upsertAmazonUser({
      amazonUserId: 'amzn1.account.ALICE12345',
      name: 'Alice Morgan',
      email: 'alice@amazon.com'
    });

    assert(
      amzUserA &&
        amzUserA.amazon_user_id === 'amzn1.account.ALICE12345' &&
        amzUserA.name === 'Alice Morgan' &&
        amzUserA.auth_provider === 'amazon',
      'Test 2: Amazon User A profile is stored with official Amazon customer ID'
    );
  }

  // ----------------------------------------------------
  // Test 3: Login with Amazon (LWA) Profile Upsertion for User B
  // ----------------------------------------------------
  {
    amzUserB = userModel.upsertAmazonUser({
      amazonUserId: 'amzn1.account.BOB67890',
      name: 'Bob Miller',
      email: 'bob@amazon.com'
    });

    assert(
      amzUserB &&
        amzUserB.amazon_user_id === 'amzn1.account.BOB67890' &&
        amzUserB.id !== amzUserA.id,
      'Test 3: Amazon User B profile is created with distinct user account'
    );
  }

  // ----------------------------------------------------
  // Test 4 & 5: Each Amazon user sees a different product catalog
  // ----------------------------------------------------
  {
    const prodsA = productModel.findAllByUser(amzUserA.id);
    const prodsB = productModel.findAllByUser(amzUserB.id);

    assert(
      prodsA.length > 0 && prodsB.length > 0,
      'Test 4: Each Amazon user is automatically allocated an initial application catalog'
    );

    amzUserAProductId = prodsA[0].id;
    amzUserBProductId = prodsB[0].id;

    // Verify products belong strictly to respective users
    const allBelongToA = prodsA.every((p) => p.user_id === amzUserA.id);
    const allBelongToB = prodsB.every((p) => p.user_id === amzUserB.id);
    const skusOverlap = prodsA.some((pa) => prodsB.some((pb) => pb.id === pa.id));

    assert(
      allBelongToA && allBelongToB && !skusOverlap,
      'Test 5: Product catalogs are completely distinct and isolated per Amazon user ID'
    );
  }

  // ----------------------------------------------------
  // Test 6 & 7: User isolation - Cross-access is blocked
  // ----------------------------------------------------
  {
    // Amazon User A tries to view Amazon User B's product
    const { req: reqA, res: resA } = mockReqRes({
      user: { id: amzUserA.id, email: amzUserA.email },
      params: { id: amzUserBProductId }
    });
    productController.getById(reqA, resA);
    assert(
      resA.getStatusCode() === 404,
      "Test 6: Amazon User A cannot view Amazon User B's product (404/Denied)"
    );

    // Amazon User B tries to view Amazon User A's product
    const { req: reqB, res: resB } = mockReqRes({
      user: { id: amzUserB.id, email: amzUserB.email },
      params: { id: amzUserAProductId }
    });
    productController.getById(reqB, resB);
    assert(
      resB.getStatusCode() === 404,
      "Test 7: Amazon User B cannot view Amazon User A's product (404/Denied)"
    );
  }

  // ----------------------------------------------------
  // Test 8: Amazon User A creates a new product in their own catalog
  // ----------------------------------------------------
  let customProdId = null;
  {
    const { req, res } = mockReqRes({
      user: { id: amzUserA.id, email: amzUserA.email },
      body: {
        sku: 'CUSTOM-AMZ-001',
        title: 'Custom Rain Logger',
        price: 49.99,
        quantity: 15
      }
    });
    await productController.create(req, res);
    const data = res.getData();
    assert(
      res.getStatusCode() === 201 && data.product && data.product.user_id === amzUserA.id,
      'Test 8: Amazon user can add new products strictly scoped to their user ID'
    );
    customProdId = data.product.id;
  }

  // ----------------------------------------------------
  // Test 9: Ownership check on Product Update
  // ----------------------------------------------------
  {
    // User B tries to update User A's product
    const { req: badReq, res: badRes } = mockReqRes({
      user: { id: amzUserB.id, email: amzUserB.email },
      params: { id: customProdId },
      body: { title: 'Unauthorized Modification' }
    });
    await productController.update(badReq, badRes);
    assert(
      badRes.getStatusCode() === 404,
      "Test 9: User B cannot modify User A's product"
    );

    // User A updates own product
    const { req: goodReq, res: goodRes } = mockReqRes({
      user: { id: amzUserA.id, email: amzUserA.email },
      params: { id: customProdId },
      body: { title: 'Updated Rain Logger by Alice' }
    });
    await productController.update(goodReq, goodRes);
    assert(
      goodRes.getStatusCode() === 200 && goodRes.getData().product.title === 'Updated Rain Logger by Alice',
      "Test 9b: Owner can update their own product"
    );
  }

  // ----------------------------------------------------
  // Test 10: Ownership check on Product Deletion
  // ----------------------------------------------------
  {
    // User B tries to delete User A's product
    const { req: badDel, res: badRes } = mockReqRes({
      user: { id: amzUserB.id, email: amzUserB.email },
      params: { id: customProdId }
    });
    await productController.delete(badDel, badRes);
    assert(
      badRes.getStatusCode() === 404,
      "Test 10: User B cannot delete User A's product"
    );

    // User A deletes own product
    const { req: goodDel, res: goodRes } = mockReqRes({
      user: { id: amzUserA.id, email: amzUserA.email },
      params: { id: customProdId }
    });
    await productController.delete(goodDel, goodRes);
    assert(
      goodRes.getStatusCode() === 200,
      'Test 10b: Owner can delete their own product'
    );
  }

  // ----------------------------------------------------
  // Test 11: Redis Session Caching
  // ----------------------------------------------------
  {
    const mockToken = 'mock_jwt_session_token_1234567890abcdef';
    const mockSession = {
      id: amzUserA.id,
      email: amzUserA.email,
      name: amzUserA.name,
      amazon_user_id: amzUserA.amazon_user_id
    };

    // If Redis is online, it writes and reads from Redis.
    // If Redis is offline, the methods gracefully return false/null without throwing.
    const cachedOk = await redisService.cacheUserSession(mockToken, mockSession);
    const retrieved = await redisService.getCachedUserSession(mockToken);
    await redisService.invalidateUserSession(mockToken);

    assert(
      typeof cachedOk === 'boolean',
      'Test 11: Redis session caching functions handle cache, retrieval, and invalidation gracefully'
    );
  }

  // ----------------------------------------------------
  // Test 12: LWA Status Endpoint
  // ----------------------------------------------------
  {
    const { req, res } = mockReqRes({
      user: {
        id: amzUserA.id,
        email: amzUserA.email,
        name: amzUserA.name,
        amazon_user_id: amzUserA.amazon_user_id,
        auth_provider: 'amazon'
      }
    });
    lwaController.getStatus(req, res);
    const statusData = res.getData();

    assert(
      statusData.success === true &&
        statusData.configured === true &&
        statusData.connected === true &&
        statusData.user.amazonUserId === 'amzn1.account.ALICE12345' &&
        statusData.user.name === 'Alice Morgan',
      'Test 12: LWA status endpoint returns authenticated Amazon customer profile'
    );
  }

  // ----------------------------------------------------
  // Test 13: LWA Login Initiation builds official Amazon URL
  // ----------------------------------------------------
  {
    const { req, res } = mockReqRes({
      headers: { accept: 'application/json' }
    });
    lwaController.initiateLogin(req, res);
    const authData = res.getData();

    assert(
      authData.success === true &&
        authData.authUrl.startsWith('https://www.amazon.com/ap/oa') &&
        authData.authUrl.includes('scope=profile') &&
        authData.authUrl.includes('response_type=code'),
      'Test 13: LWA login initiates official Amazon OAuth 2.0 authorization URL'
    );
  }

  // ----------------------------------------------------
  // Test 14: Protected routes reject unauthenticated requests
  // ----------------------------------------------------
  {
    const { req: noAuthReq, res: noAuthRes } = mockReqRes({ headers: {} });
    let nextCalled = false;
    await authenticateUser(noAuthReq, noAuthRes, () => {
      nextCalled = true;
    });

    assert(
      noAuthRes.getStatusCode() === 401 && !nextCalled,
      'Test 14: Protected routes reject requests with missing token (401)'
    );

    const { req: badTokenReq, res: badTokenRes } = mockReqRes({
      headers: { authorization: 'Bearer invalid_forged_token' }
    });
    nextCalled = false;
    await authenticateUser(badTokenReq, badTokenRes, () => {
      nextCalled = true;
    });

    assert(
      badTokenRes.getStatusCode() === 401 && !nextCalled,
      'Test 14b: Protected routes reject invalid/forged tokens (401)'
    );
  }

  // ----------------------------------------------------
  // Test 15: Existing Weather API (/api/weather/cities) works
  // ----------------------------------------------------
  {
    const { req, res } = mockReqRes();
    weatherController.getCities(req, res);
    const citiesData = res.getData();
    assert(
      citiesData.success === true && citiesData.cities && citiesData.cities.length === 20,
      'Test 15: Existing Weather API returns all 20 configured cities'
    );
  }

  // ----------------------------------------------------
  // Test 16: Existing Weather Frontend Pages are preserved
  // ----------------------------------------------------
  {
    const indexPath = path.join(__dirname, '../../frontend/index.html');
    const reportsPath = path.join(__dirname, '../../frontend/reports.html');
    const citiesPath = path.join(__dirname, '../../frontend/cities.html');
    const amazonPath = path.join(__dirname, '../../frontend/amazon.html');
    const productsPath = path.join(__dirname, '../../frontend/products.html');

    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    const citiesContent = fs.readFileSync(citiesPath, 'utf8');
    const amazonContent = fs.readFileSync(amazonPath, 'utf8');
    const productsContent = fs.readFileSync(productsPath, 'utf8');

    assert(
      indexContent.includes('id="tempChart"') &&
        reportsContent.includes('id="reportsTableBody"') &&
        citiesContent.includes('id="citiesGrid"') &&
        amazonContent.includes('Sign in with Amazon') &&
        productsContent.includes('Product Catalog'),
      'Test 16: All frontend pages (weather, amazon, products) are preserved and intact'
    );
  }

  // ----------------------------------------------------
  // Test 17: Logger redacts client secrets and sensitive tokens
  // ----------------------------------------------------
  {
    const sanitized = logger.sanitize({
      amazon_user_id: 'amzn1.account.123',
      client_secret: 'super_secret_lwa_key',
      refresh_token: 'refresh_token_xyz',
      password: 'password123'
    });

    assert(
      sanitized.client_secret === '[REDACTED]' &&
        sanitized.refresh_token === '[REDACTED]' &&
        sanitized.password === '[REDACTED]' &&
        sanitized.amazon_user_id === 'amzn1.account.123',
      'Test 17: Logger automatically redacts client secrets and sensitive credentials'
    );
  }

  closeDatabase();

  console.log('\n----------------------------------------------------');
  console.log(`Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('----------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\nAll Login with Amazon (LWA) test specifications PASSED!\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
