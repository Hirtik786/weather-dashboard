/**
 * Global Authentication UI & Session Controller
 * Manages user session state, sidebar user block, and authentication modal across all pages.
 */

(function () {
  let currentUser = null;
  let onAuthSuccessCallback = null;

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', async () => {
    // Check if redirected from Amazon OAuth with auth_token in query string
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('auth_token');
    if (tokenFromUrl) {
      window.AuthStorage.setToken(tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    injectAuthModal();
    injectSidebarUserBlock();
    await checkSession();
  });

  async function checkSession() {
    try {
      currentUser = await window.AuthAPI.getMe();
      renderSidebarUserBlock();
      window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: currentUser } }));
    } catch {
      currentUser = null;
      renderSidebarUserBlock();
    }
    return currentUser;
  }

  function injectSidebarUserBlock() {
    const sidebar = document.querySelector('.app-sidebar');
    if (!sidebar) return;

    if (document.getElementById('sidebarUserSection')) return;

    const userSection = document.createElement('div');
    userSection.id = 'sidebarUserSection';
    userSection.className = 'sidebar-user-section';

    // Insert before sidebar-footer
    const footer = sidebar.querySelector('.sidebar-footer');
    if (footer) {
      sidebar.insertBefore(userSection, footer);
    } else {
      sidebar.appendChild(userSection);
    }

    renderSidebarUserBlock();
  }

  function renderSidebarUserBlock() {
    const container = document.getElementById('sidebarUserSection');
    if (!container) return;

    if (currentUser) {
      const isAmazon = currentUser.auth_provider === 'amazon' || Boolean(currentUser.amazon_user_id);
      const displayName = currentUser.name || currentUser.email;
      const initial = displayName.charAt(0).toUpperCase();
      const avatarBg = isAmazon
        ? 'linear-gradient(135deg, #f0c14b, #ff9900)'
        : 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))';

      container.innerHTML = `
        <div class="user-profile-badge">
          <div class="user-avatar" style="background: ${avatarBg}; color: ${isAmazon ? '#111' : '#fff'};">${initial}</div>
          <div class="user-details">
            <span class="user-email" title="${displayName}">${displayName}</span>
            <span class="user-status-online">${isAmazon ? 'Amazon Connected' : 'Online'}</span>
          </div>
          <button class="btn-logout" id="btnLogout" title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      `;

      const btnLogout = document.getElementById('btnLogout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          await window.AuthAPI.logout();
          currentUser = null;
          renderSidebarUserBlock();
          window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: null } }));
          if (window.location.pathname.includes('amazon') || window.location.pathname.includes('products')) {
            window.location.reload();
          }
        });
      }
    } else {
      container.innerHTML = `
        <div class="user-guest-card">
          <div class="guest-text">
            <span>Account Session</span>
            <small>Sign in to manage product catalog</small>
          </div>
          <button class="btn btn-outline-light btn-sm" id="btnOpenAuthModal">
            Sign In / Register
          </button>
        </div>
      `;

      const btnOpen = document.getElementById('btnOpenAuthModal');
      if (btnOpen) {
        btnOpen.addEventListener('click', () => {
          openAuthModal('login');
        });
      }
    }
  }

  function injectAuthModal() {
    if (document.getElementById('authModalBackdrop')) return;

    const modalHtml = `
      <div class="modal-backdrop" id="authModalBackdrop" style="display: none;">
        <div class="modal-dialog auth-modal">
          <div class="modal-header">
            <div class="auth-tabs">
              <button class="auth-tab active" id="tabLogin">Sign In</button>
              <button class="auth-tab" id="tabRegister">Create Account</button>
            </div>
            <button class="modal-close" id="btnCloseAuthModal">&times;</button>
          </div>

          <div class="modal-body">
            <div id="authAlert" class="auth-alert" style="display: none;"></div>

            <!-- Login with Amazon Quick Button -->
            <div style="margin-bottom: 16px; text-align: center;">
              <a href="/api/auth/amazon/login" class="btn-amazon-signin" style="width: 100%; justify-content: center; box-sizing: border-box;">
                <span class="amazon-logo-badge">amazon</span>
                <span>Sign in with Amazon</span>
              </a>
              <div style="display: flex; align-items: center; margin: 14px 0 6px; color: #94a3b8; font-size: 11px;">
                <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                <span style="padding: 0 8px; font-weight: 600;">OR USE EMAIL</span>
                <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
              </div>
            </div>

            <!-- Login Form -->
            <form id="loginForm" class="auth-form">
              <div class="form-group">
                <label for="loginEmail">Email Address</label>
                <input type="email" id="loginEmail" class="form-control" placeholder="seller@example.com" required autocomplete="email">
              </div>
              <div class="form-group">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" class="form-control" placeholder="••••••••" required autocomplete="current-password">
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="btnLoginSubmit">
                Sign In
              </button>
            </form>

            <!-- Register Form -->
            <form id="registerForm" class="auth-form" style="display: none;">
              <div class="form-group">
                <label for="registerName">Full Name</label>
                <input type="text" id="registerName" class="form-control" placeholder="Jane Doe" autocomplete="name">
              </div>
              <div class="form-group">
                <label for="registerEmail">Email Address</label>
                <input type="email" id="registerEmail" class="form-control" placeholder="seller@example.com" required autocomplete="email">
              </div>
              <div class="form-group">
                <label for="registerPassword">Password (min 6 characters)</label>
                <input type="password" id="registerPassword" class="form-control" placeholder="••••••••" minlength="6" required autocomplete="new-password">
              </div>
              <div class="form-group">
                <label for="registerConfirmPassword">Confirm Password</label>
                <input type="password" id="registerConfirmPassword" class="form-control" placeholder="••••••••" minlength="6" required autocomplete="new-password">
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="btnRegisterSubmit">
                Create Account
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Wire up events
    const backdrop = document.getElementById('authModalBackdrop');
    const btnClose = document.getElementById('btnCloseAuthModal');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authAlert = document.getElementById('authAlert');

    btnClose.addEventListener('click', closeAuthModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAuthModal();
    });

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    function switchTab(tab) {
      authAlert.style.display = 'none';
      if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
      }
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = document.getElementById('btnLoginSubmit');

      btn.disabled = true;
      btn.innerText = 'Signing in...';
      authAlert.style.display = 'none';

      try {
        const res = await window.AuthAPI.login(email, password);
        currentUser = res.user;
        renderSidebarUserBlock();
        closeAuthModal();
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: currentUser } }));
        if (onAuthSuccessCallback) {
          const cb = onAuthSuccessCallback;
          onAuthSuccessCallback = null;
          cb(currentUser);
        }
      } catch (err) {
        authAlert.innerText = err.message;
        authAlert.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerText = 'Sign In';
      }
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const confirm = document.getElementById('registerConfirmPassword').value;
      const btn = document.getElementById('btnRegisterSubmit');

      if (password !== confirm) {
        authAlert.innerText = 'Passwords do not match';
        authAlert.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Creating account...';
      authAlert.style.display = 'none';

      try {
        const res = await window.AuthAPI.register(email, password);
        currentUser = res.user;
        renderSidebarUserBlock();
        closeAuthModal();
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: currentUser } }));
        if (onAuthSuccessCallback) {
          const cb = onAuthSuccessCallback;
          onAuthSuccessCallback = null;
          cb(currentUser);
        }
      } catch (err) {
        authAlert.innerText = err.message;
        authAlert.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerText = 'Create Account';
      }
    });
  }

  function openAuthModal(defaultTab = 'login', callback = null) {
    onAuthSuccessCallback = callback;
    const backdrop = document.getElementById('authModalBackdrop');
    if (!backdrop) return;

    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authAlert = document.getElementById('authAlert');

    if (authAlert) authAlert.style.display = 'none';

    if (defaultTab === 'register') {
      tabRegister.click();
    } else {
      tabLogin.click();
    }

    backdrop.style.display = 'flex';
  }

  function closeAuthModal() {
    const backdrop = document.getElementById('authModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  function requireAuth(callback) {
    if (currentUser) {
      callback(currentUser);
    } else {
      openAuthModal('login', callback);
    }
  }

  window.AuthUI = {
    getUser: () => currentUser,
    checkSession,
    openAuthModal,
    closeAuthModal,
    requireAuth
  };
})();
