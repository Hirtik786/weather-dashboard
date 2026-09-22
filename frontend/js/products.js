/**
 * Products Page Controller (products.html)
 * Handles unified product catalog, dual-channel synchronization, and error telemetry.
 */

document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let currentSearch = '';
  let currentFilter = 'All';

  // DOM Elements
  const productsTableBody = document.getElementById('productsTableBody');
  const productsTableContainer = document.getElementById('productsTableContainer');
  const emptyProductsState = document.getElementById('emptyProductsState');
  const unauthAlert = document.getElementById('unauthAlert');
  const productsSection = document.getElementById('productsSection');

  const metricTotal = document.getElementById('metricTotalProducts');
  const metricSynced = document.getElementById('metricSyncedProducts');
  const metricPartial = document.getElementById('metricPartialProducts');
  const metricFailed = document.getElementById('metricFailedProducts');

  const productSearch = document.getElementById('productSearch');
  const syncFilter = document.getElementById('syncFilter');
  const btnRefreshProducts = document.getElementById('btnRefreshProducts');
  const btnOpenAddProduct = document.getElementById('btnOpenAddProduct');
  const btnEmptyAdd = document.getElementById('btnEmptyAdd');
  const btnSeedDemoProducts = document.getElementById('btnSeedDemoProducts');
  const btnSignInFromProducts = document.getElementById('btnSignInFromProducts');

  // Modals
  const addProductModal = document.getElementById('addProductModal');
  const addProductForm = document.getElementById('addProductForm');
  const btnCloseAddModal = document.getElementById('btnCloseAddModal');
  const btnCancelAddModal = document.getElementById('btnCancelAddModal');

  const editProductModal = document.getElementById('editProductModal');
  const editProductForm = document.getElementById('editProductForm');
  const btnCloseEditModal = document.getElementById('btnCloseEditModal');
  const btnCancelEditModal = document.getElementById('btnCancelEditModal');

  const productDetailModal = document.getElementById('productDetailModal');
  const detailModalBody = document.getElementById('detailModalBody');
  const detailModalFooter = document.getElementById('detailModalFooter');
  const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');

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
    }, 4000);
  }

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

  async function loadProducts() {
    const user = window.AuthUI.getUser();
    if (!user) {
      unauthAlert.style.display = 'block';
      productsSection.style.display = 'none';
      metricTotal.textContent = '0';
      metricSynced.textContent = '0';
      metricPartial.textContent = '0';
      metricFailed.textContent = '0';
      return;
    }

    unauthAlert.style.display = 'none';
    productsSection.style.display = 'block';

    try {
      const data = await window.ProductsAPI.list({
        search: currentSearch,
        status: currentFilter
      });

      products = data.products || [];
      renderMetrics(products);
      renderTable(products);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderMetrics(items) {
    let synced = 0;
    let partial = 0;
    let failed = 0;

    items.forEach((p) => {
      const s = p.sync_status || 'SYNCED';
      if (s === 'SYNCED') synced++;
      else if (s === 'PARTIAL') partial++;
      else if (s === 'FAILED') failed++;
    });

    metricTotal.textContent = items.length;
    metricSynced.textContent = synced;
    metricPartial.textContent = partial;
    metricFailed.textContent = failed;
  }

  function renderTable(items) {
    if (!items || items.length === 0) {
      productsTableContainer.style.display = 'none';
      emptyProductsState.style.display = 'block';
      return;
    }

    productsTableContainer.style.display = 'block';
    emptyProductsState.style.display = 'none';

    productsTableBody.innerHTML = items
      .map((p) => {
        // Amazon badge
        let amzBadge = `<span class="badge-pill badge-not-listed">Not Listed</span>`;
        if (p.amazon_status === 'LISTED') {
          amzBadge = `<span class="badge-pill badge-listed" title="ASIN: ${p.amazon_asin || 'N/A'}">✓ Listed</span>`;
        } else if (p.amazon_status === 'ERROR') {
          amzBadge = `<span class="badge-pill badge-error">✕ Error</span>`;
        }

        // Sendbox badge
        let sndBadge = `<span class="badge-pill badge-not-listed">Not Synced</span>`;
        if (p.sendbox_status === 'SYNCED') {
          sndBadge = `<span class="badge-pill badge-listed">✓ Synced</span>`;
        } else if (p.sendbox_status === 'ERROR') {
          sndBadge = `<span class="badge-pill badge-error">✕ Error</span>`;
        }

        // Overall Sync Badge
        let syncBadge = `<span class="badge-pill badge-synced">SYNCED</span>`;
        if (p.sync_status === 'PARTIAL') {
          syncBadge = `<span class="badge-pill badge-partial" title="${p.last_sync_error || 'Partial'}">⚠️ PARTIAL</span>`;
        } else if (p.sync_status === 'FAILED') {
          syncBadge = `<span class="badge-pill badge-failed" title="${p.last_sync_error || 'Failed'}">✕ FAILED</span>`;
        } else if (p.sync_status === 'SYNCING') {
          syncBadge = `<span class="badge-pill badge-syncing">SYNCING</span>`;
        }

        return `
          <tr>
            <td>
              <div style="font-weight: 600; color: var(--text-main); font-size: 14px;">${escapeHtml(p.title)}</div>
              <div style="font-size: 11px; font-family: monospace; color: var(--text-muted); margin-top: 2px;">
                SKU: ${escapeHtml(p.sku)}
              </div>
            </td>
            <td>$${Number(p.price).toFixed(2)}</td>
            <td>${p.quantity} units</td>
            <td>${amzBadge}</td>
            <td>${sndBadge}</td>
            <td>${syncBadge}</td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px;">
                <button class="btn btn-secondary btn-sm" onclick="window.viewProduct('${p.id}')" title="View details">
                  View
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.editProduct('${p.id}')" title="Edit">
                  Edit
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.retrySync('${p.id}')" title="Re-sync channels">
                  Sync
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="window.deleteProduct('${p.id}')" title="Delete">
                  ✕
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // View Product Modal
  window.viewProduct = function (id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    detailModalBody.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">General Information</div>
        <div class="detail-row">
          <span class="detail-row-label">Title</span>
          <span class="detail-row-val">${escapeHtml(product.title)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">SKU</span>
          <span class="detail-row-val" style="font-family: monospace;">${escapeHtml(product.sku)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Price</span>
          <span class="detail-row-val">$${Number(product.price).toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Inventory Quantity</span>
          <span class="detail-row-val">${product.quantity} in stock</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Description</span>
          <span class="detail-row-val">${escapeHtml(product.description || 'None provided')}</span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Amazon Channel Integration</div>
        <div class="detail-row">
          <span class="detail-row-label">Listing ID</span>
          <span class="detail-row-val" style="font-family: monospace;">${product.amazon_listing_id || 'Not Assigned'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">ASIN</span>
          <span class="detail-row-val" style="font-family: monospace;">${product.amazon_asin || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Amazon Status</span>
          <span class="detail-row-val">${product.amazon_status || 'NOT_LISTED'}</span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Sendbox Logistics & Fulfillment</div>
        <div class="detail-row">
          <span class="detail-row-label">Sendbox Shipment Code</span>
          <span class="detail-row-val" style="font-family: monospace;">${product.sendbox_shipment_id || product.sendbox_product_id || 'Not Assigned'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Sendbox Order / Reference</span>
          <span class="detail-row-val" style="font-family: monospace;">${product.sendbox_order_id || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Sendbox Status</span>
          <span class="detail-row-val">${product.sendbox_status || 'NOT_SYNCED'}</span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Synchronization Telemetry</div>
        <div class="detail-row">
          <span class="detail-row-label">Overall Sync Status</span>
          <span class="detail-row-val"><strong>${product.sync_status || 'SYNCED'}</strong></span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Last Synced</span>
          <span class="detail-row-val">${product.last_synced_at ? new Date(product.last_synced_at).toLocaleString() : '--'}</span>
        </div>
        ${
          product.last_sync_error
            ? `
          <div style="margin-top: 10px; background: #fee2e2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; font-size: 12px; color: #991b1b;">
            <strong>Synchronization Error / Issue:</strong><br>${escapeHtml(product.last_sync_error)}
          </div>
        `
            : ''
        }
      </div>
    `;

    detailModalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="document.getElementById('productDetailModal').style.display='none'">Close</button>
      <button class="btn btn-primary" onclick="window.retrySync('${product.id}'); document.getElementById('productDetailModal').style.display='none';">
        Retry Synchronization
      </button>
    `;

    productDetailModal.style.display = 'flex';
  };

  // Edit Product Modal
  window.editProduct = function (id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    document.getElementById('editProductId').value = product.id;
    document.getElementById('editSku').value = product.sku;
    document.getElementById('editTitle').value = product.title;
    document.getElementById('editPrice').value = product.price;
    document.getElementById('editQuantity').value = product.quantity;
    document.getElementById('editDescription').value = product.description || '';

    editProductModal.style.display = 'flex';
  };

  // Retry / Sync
  window.retrySync = async function (id) {
    try {
      showToast('Retrying channel synchronization...', 'info');
      const res = await window.ProductsAPI.sync(id);
      showToast(res.message || 'Synchronization updated');
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Delete Product
  window.deleteProduct = async function (id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    if (!confirm(`Are you sure you want to delete "${product.title}"? This will deactivate listings on connected channels.`)) {
      return;
    }

    try {
      const res = await window.ProductsAPI.delete(id);
      showToast(res.message);
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Add Product Flow
  function openAddModal() {
    window.AuthUI.requireAuth(() => {
      addProductForm.reset();
      addProductModal.style.display = 'flex';
    });
  }

  if (btnOpenAddProduct) btnOpenAddProduct.addEventListener('click', openAddModal);
  if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openAddModal);
  if (btnCloseAddModal) btnCloseAddModal.addEventListener('click', () => (addProductModal.style.display = 'none'));
  if (btnCancelAddModal) btnCancelAddModal.addEventListener('click', () => (addProductModal.style.display = 'none'));

  addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitAddProduct');
    btn.disabled = true;
    btn.textContent = 'Synchronizing...';

    const payload = {
      sku: document.getElementById('newSku').value.trim(),
      title: document.getElementById('newTitle').value.trim(),
      price: document.getElementById('newPrice').value,
      quantity: document.getElementById('newQuantity').value,
      description: document.getElementById('newDescription').value.trim()
    };

    try {
      const res = await window.ProductsAPI.create(payload);
      addProductModal.style.display = 'none';
      showToast(res.message || 'Product created and synchronized');
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save & Synchronize';
    }
  });

  // Edit Product Form
  if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', () => (editProductModal.style.display = 'none'));
  if (btnCancelEditModal) btnCancelEditModal.addEventListener('click', () => (editProductModal.style.display = 'none'));

  editProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editProductId').value;
    const btn = document.getElementById('btnSubmitEditProduct');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    const updates = {
      title: document.getElementById('editTitle').value.trim(),
      price: document.getElementById('editPrice').value,
      quantity: document.getElementById('editQuantity').value,
      description: document.getElementById('editDescription').value.trim()
    };

    try {
      const res = await window.ProductsAPI.update(id, updates);
      editProductModal.style.display = 'none';
      showToast(res.message || 'Product updated successfully');
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update & Sync';
    }
  });

  if (btnCloseDetailModal) {
    btnCloseDetailModal.addEventListener('click', () => (productDetailModal.style.display = 'none'));
  }

  // Seed Demo Sample Products button
  if (btnSeedDemoProducts) {
    btnSeedDemoProducts.addEventListener('click', async () => {
      window.AuthUI.requireAuth(async () => {
        btnSeedDemoProducts.disabled = true;
        btnSeedDemoProducts.textContent = 'Seeding products...';

        const samples = [
          {
            sku: 'DEMO-WTH-001',
            title: 'Wireless Ultrasonic Anemometer & Wind Sensor',
            price: 89.99,
            quantity: 35,
            description: 'High-precision solar-powered ultrasonic wind speed and direction telemetry sensor.'
          },
          {
            sku: 'DEMO-WTH-002',
            title: 'Digital Barometric Pressure & Humidity Gauge',
            price: 49.5,
            quantity: 75,
            description: 'Calibrated atmospheric barometric sensor with Bluetooth telemetry broadcast.'
          },
          {
            sku: 'DEMO-WTH-003',
            title: 'Outdoor Meteorological Rain Collector Bucket',
            price: 34.99,
            quantity: 120,
            description: 'Self-emptying tipping bucket rain gauge with accuracy to 0.01 inches.'
          }
        ];

        try {
          for (const sample of samples) {
            await window.ProductsAPI.create(sample);
          }
          showToast('3 demo sample products loaded and synchronized!');
          await loadProducts();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btnSeedDemoProducts.disabled = false;
          btnSeedDemoProducts.textContent = 'Load Demo Sample Products';
        }
      });
    });
  }

  // Filters & Search
  if (productSearch) {
    let timeout = null;
    productSearch.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentSearch = e.target.value;
        loadProducts();
      }, 300);
    });
  }

  if (syncFilter) {
    syncFilter.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      loadProducts();
    });
  }

  if (btnRefreshProducts) {
    btnRefreshProducts.addEventListener('click', () => {
      showToast('Refreshing catalog...', 'info');
      loadProducts();
    });
  }

  if (btnSignInFromProducts) {
    btnSignInFromProducts.addEventListener('click', () => {
      window.AuthUI.openAuthModal('login');
    });
  }

  // React to global auth events
  window.addEventListener('auth:change', () => {
    loadProducts();
  });

  // Initial load
  updateSystemHealth();
  setInterval(updateSystemHealth, 30000);
  setTimeout(loadProducts, 150);
});
