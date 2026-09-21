/**
 * Official Login with Amazon Frontend Controller (amazon.html)
 * Manages OAuth 2.0 customer authentication, profile rendering, and developer setup state.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const amazonAuthBadge = document.getElementById('amazonAuthBadge');
  const amazonBannerTitle = document.getElementById('amazonBannerTitle');
  const amazonBannerSubtitle = document.getElementById('amazonBannerSubtitle');

  const amazonProfileCard = document.getElementById('amazonProfileCard');
  const amazonSignInCard = document.getElementById('amazonSignInCard');
  const lwaConfigNotice = document.getElementById('lwaConfigNotice');

  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileUserId = document.getElementById('profileUserId');
  const profileProvider = document.getElementById('profileProvider');

  const btnDisconnectAmazon = document.getElementById('btnDisconnectAmazon');
  const btnAmazonLogin = document.getElementById('btnAmazonLogin');
  const toastContainer = document.getElementById('toastContainer');

  // Sidebar Status Elements
  const statusApiDot = document.getElementById('statusApiDot');
  const statusApiText = document.getElementById('statusApiText');
  const statusRedisDot = document.getElementById('statusRedisDot');
  const statusRedisText = document.getElementById('statusRedisText');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const appSidebar = document.getElementById('appSidebar');

  if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => appSidebar.classList.toggle('open'));
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'error' ? '✕' : type === 'info' ? 'ℹ' : '✓';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 5000);
  }

  // System Health Monitoring in Sidebar
  async function updateSystemHealth() {
    const health = await window.WeatherAPI.getHealth();
    if (health && health.redis === 'connected') {
      if (statusRedisDot) statusRedisDot.className = 'status-dot online';
      if (statusRedisText) statusRedisText.textContent = 'Connected';
    } else {
      if (statusRedisDot) statusRedisDot.className = 'status-dot offline';
      if (statusRedisText) statusRedisText.textContent = 'Disconnected';
    }

    if (health && health.success) {
      if (statusApiDot) statusApiDot.className = 'status-dot online';
      if (statusApiText) statusApiText.textContent = 'Operational';
    } else {
      if (statusApiDot) statusApiDot.className = 'status-dot offline';
      if (statusApiText) statusApiText.textContent = 'Unavailable';
    }
  }

  // Check URL query parameters for OAuth redirect callback or errors
  function checkUrlQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('auth_token');
    const error = urlParams.get('error');
    const configError = urlParams.get('config_error');

    if (token) {
      window.AuthStorage.setToken(token);
      showToast('Successfully signed in with Amazon!', 'success');
      // Clean query string from browser bar
      window.history.replaceState({}, document.title, window.location.pathname);
      window.dispatchEvent(new CustomEvent('auth:change'));
    } else if (error) {
      showToast(`Amazon Sign-In Error: ${decodeURIComponent(error)}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (configError) {
      showToast('Login with Amazon credentials are not configured in backend/.env', 'info');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Fetch LWA status & render view
  async function loadAmazonStatus() {
    try {
      const res = await fetch('/api/auth/amazon/status', {
        headers: window.AuthStorage.getHeaders()
      });
      const data = await res.json();

      // Show setup guide banner if LWA credentials are not configured in .env
      if (!data.configured) {
        if (lwaConfigNotice) lwaConfigNotice.style.display = 'block';
      } else {
        if (lwaConfigNotice) lwaConfigNotice.style.display = 'none';
      }

      // If user is authenticated with Amazon
      if (data.connected && data.user && data.user.amazonUserId) {
        amazonProfileCard.style.display = 'block';
        amazonSignInCard.style.display = 'none';

        amazonAuthBadge.textContent = 'Amazon Connected';
        amazonAuthBadge.className = 'badge-pill badge-synced';

        amazonBannerTitle.textContent = `Welcome, ${data.user.name || 'Amazon Customer'}`;
        amazonBannerSubtitle.textContent =
          `Authenticated via official Login with Amazon OAuth 2.0 (${data.user.email || data.user.amazonUserId}).`;

        profileName.textContent = data.user.name || 'Amazon Customer';
        profileEmail.textContent = data.user.email || 'Not shared by user';
        profileUserId.textContent = data.user.amazonUserId;
        profileProvider.textContent = 'Login with Amazon (OAuth 2.0)';
      } else {
        // Disconnected / guest state
        amazonProfileCard.style.display = 'none';
        amazonSignInCard.style.display = 'block';

        amazonAuthBadge.textContent = 'Not Connected';
        amazonAuthBadge.className = 'badge-pill badge-not-listed';

        amazonBannerTitle.textContent = 'Login with Amazon (LWA)';
        amazonBannerSubtitle.textContent =
          'Authenticate with your personal Amazon customer account using official Amazon OAuth 2.0. No Seller Central account required.';
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Sign out from Amazon
  if (btnDisconnectAmazon) {
    btnDisconnectAmazon.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/amazon/disconnect', {
          method: 'POST',
          headers: window.AuthStorage.getHeaders()
        });
        window.AuthStorage.removeToken();
        showToast('Signed out from Amazon successfully');
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: null } }));
        await loadAmazonStatus();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Handle Amazon Sign-in button click
  if (btnAmazonLogin) {
    btnAmazonLogin.addEventListener('click', async (e) => {
      // Direct navigation to /api/auth/amazon/login handles redirect
    });
  }

  // Listen to global auth changes
  window.addEventListener('auth:change', () => {
    loadAmazonStatus();
  });

  // Initial execution
  checkUrlQueryParams();
  updateSystemHealth();
  setInterval(updateSystemHealth, 30000);
  await loadAmazonStatus();
});
