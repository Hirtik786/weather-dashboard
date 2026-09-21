const axios = require('axios');

async function testRunningServer() {
  const base = 'http://localhost:5000';
  console.log('Testing running server endpoints at:', base);

  try {
    const meta = await axios.get(`${base}/api`);
    console.log('✓ /api:', meta.data.name);

    const cities = await axios.get(`${base}/api/weather/cities`);
    console.log('✓ /api/weather/cities:', cities.data.count, 'cities returned');

    const lwaStatus = await axios.get(`${base}/api/auth/amazon/status`);
    console.log('✓ /api/auth/amazon/status: LWA configured =', lwaStatus.data.configured);

    const indexHtml = await axios.get(`${base}/index.html`);
    console.log('✓ /index.html served, length:', indexHtml.data.length);

    const amazonHtml = await axios.get(`${base}/amazon.html`);
    console.log('✓ /amazon.html served, length:', amazonHtml.data.length);

    const productsHtml = await axios.get(`${base}/products.html`);
    console.log('✓ /products.html served, length:', productsHtml.data.length);

    console.log('\nAll server endpoints verified successfully!');
  } catch (err) {
    console.error('Endpoint verification error:', err.message);
  }
}

testRunningServer();
