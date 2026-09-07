/**
 * Cities Page Script (cities.html)
 * Displays all 20 configured US Metropolitan areas with coordinates and live telemetry.
 */

document.addEventListener('DOMContentLoaded', () => {
  let staticCities = [];
  let latestWeatherMap = {};
  let currentSearch = '';

  // DOM Elements
  const citiesGrid = document.getElementById('citiesGrid');
  const citySearchInput = document.getElementById('citySearchInput');
  const citiesCountBadge = document.getElementById('citiesCountBadge');
  const toastContainer = document.getElementById('toastContainer');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const appSidebar = document.getElementById('appSidebar');

  // Sidebar Status Elements
  const statusApiDot = document.getElementById('statusApiDot');
  const statusApiText = document.getElementById('statusApiText');
  const statusRedisDot = document.getElementById('statusRedisDot');
  const statusRedisText = document.getElementById('statusRedisText');

  // City Detail Modal Elements
  const cityDetailModal = document.getElementById('cityDetailModal');
  const cityModalCloseBtn = document.getElementById('cityModalCloseBtn');
  const cityModalDismissBtn = document.getElementById('cityModalDismissBtn');
  const modalCityName = document.getElementById('modalCityName');
  const modalCityState = document.getElementById('modalCityState');
  const modalCityTemp = document.getElementById('modalCityTemp');
  const modalCityCondition = document.getElementById('modalCityCondition');
  const modalCityFeels = document.getElementById('modalCityFeels');
  const modalCityHumidity = document.getElementById('modalCityHumidity');
  const modalCityWind = document.getElementById('modalCityWind');
  const modalCityLat = document.getElementById('modalCityLat');
  const modalCityLng = document.getElementById('modalCityLng');
  const modalCityTz = document.getElementById('modalCityTz');
  const modalCityUpdated = document.getElementById('modalCityUpdated');

  // Toast Notifications
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

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

  // System Health
  async function checkSystemHealth() {
    try {
      const health = await window.WeatherAPI.getHealth();
      if (health.success) {
        statusApiDot.classList.add('online');
        statusApiText.textContent = 'API Online';

        if (health.redis === 'connected') {
          statusRedisDot.classList.add('online');
          statusRedisText.textContent = 'Redis Connected';
        } else {
          statusRedisDot.classList.remove('online');
          statusRedisText.textContent = 'Redis Offline';
        }
      }
    } catch (e) {
      statusApiDot.classList.remove('online');
      statusApiText.textContent = 'API Offline';
      statusRedisDot.classList.remove('online');
      statusRedisText.textContent = 'Redis Offline';
    }
  }

  function getBadgeClass(category) {
    switch (category) {
      case 'Clear': return 'badge-clear';
      case 'Cloudy': return 'badge-cloudy';
      case 'Rain': return 'badge-rain';
      case 'Snow': return 'badge-snow';
      case 'Thunderstorm': return 'badge-thunderstorm';
      case 'Fog': return 'badge-fog';
      default: return 'badge-cloudy';
    }
  }

  function formatShortTime(isoOrTimestamp) {
    if (!isoOrTimestamp) return 'Never';
    const date = new Date(isoOrTimestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Render City Cards
  function renderCities() {
    const filtered = staticCities.filter((c) => {
      return (
        c.name.toLowerCase().includes(currentSearch) ||
        c.state.toLowerCase().includes(currentSearch) ||
        c.stateCode.toLowerCase().includes(currentSearch)
      );
    });

    citiesCountBadge.textContent = `${filtered.length} of ${staticCities.length} Cities`;

    if (filtered.length === 0) {
      citiesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
          <p style="color: #64748b; font-size: 15px;">No configured cities match "${currentSearch}"</p>
        </div>
      `;
      return;
    }

    citiesGrid.innerHTML = filtered
      .map((city) => {
        const live = latestWeatherMap[city.slug] || {};
        const hasLive = live.success && typeof live.temperature === 'number';
        const tempDisplay = hasLive ? `${live.temperature}°F` : '--';
        const conditionText = hasLive ? live.condition : 'Awaiting Fetch';
        const conditionIcon = hasLive ? live.icon : '⏱️';
        const badgeClass = hasLive ? getBadgeClass(live.category) : 'badge-cloudy';
        const updatedDisplay = hasLive ? formatShortTime(live.timestamp) : 'Pending';

        return `
          <div class="city-card" onclick="openCityModal('${city.slug}')">
            <div class="city-card-header">
              <div>
                <div class="city-card-title">${city.name}</div>
                <div class="city-card-state">${city.state} (${city.stateCode})</div>
              </div>
              <div class="city-card-temp">${tempDisplay}</div>
            </div>

            <div>
              <span class="condition-badge ${badgeClass}">
                <span>${conditionIcon}</span>
                <span>${conditionText}</span>
              </span>
            </div>

            <div class="city-card-meta">
              <div class="city-meta-row">
                <span>Latitude:</span>
                <strong>${city.latitude.toFixed(4)}° N</strong>
              </div>
              <div class="city-meta-row">
                <span>Longitude:</span>
                <strong>${Math.abs(city.longitude).toFixed(4)}° W</strong>
              </div>
              <div class="city-meta-row">
                <span>Last Updated:</span>
                <span style="color: #0f172a; font-weight: 500;">${updatedDisplay}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Open City Modal
  window.openCityModal = function (slug) {
    const city = staticCities.find((c) => c.slug === slug);
    if (!city) return;

    const live = latestWeatherMap[slug] || {};
    const hasLive = live.success && typeof live.temperature === 'number';

    modalCityName.textContent = city.name;
    modalCityState.textContent = `${city.state}, United States`;
    modalCityLat.textContent = `${city.latitude}° N`;
    modalCityLng.textContent = `${city.longitude}° W`;
    modalCityTz.textContent = city.timezone;

    if (hasLive) {
      modalCityTemp.textContent = `${live.temperature}°F`;
      modalCityCondition.textContent = `${live.icon || ''} ${live.condition}`;
      modalCityFeels.textContent = `${live.feelsLike}°F`;
      modalCityHumidity.textContent = `${live.humidity}%`;
      modalCityWind.textContent = `${live.windSpeed} mph`;
      modalCityUpdated.textContent = formatShortTime(live.timestamp);
    } else {
      modalCityTemp.textContent = '--';
      modalCityCondition.textContent = 'No cached telemetry';
      modalCityFeels.textContent = '--';
      modalCityHumidity.textContent = '--';
      modalCityWind.textContent = '--';
      modalCityUpdated.textContent = 'Awaiting first fetch';
    }

    cityDetailModal.classList.add('open');
  };

  function closeCityModal() {
    cityDetailModal.classList.remove('open');
  }

  cityModalCloseBtn.addEventListener('click', closeCityModal);
  cityModalDismissBtn.addEventListener('click', closeCityModal);
  cityDetailModal.addEventListener('click', (e) => {
    if (e.target === cityDetailModal) closeCityModal();
  });

  // Search filter
  citySearchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderCities();
  });

  // Load Cities & Latest Weather
  async function loadData() {
    try {
      // 1. Fetch cities
      const cityRes = await window.WeatherAPI.getCities();
      if (cityRes.success) {
        staticCities = cityRes.cities;
      }

      // 2. Fetch latest weather cache from Redis
      try {
        const latestRes = await window.WeatherAPI.getLatestWeather();
        if (latestRes.success && latestRes.data) {
          latestRes.data.forEach((item) => {
            latestWeatherMap[item.slug] = item;
          });
        }
      } catch (err) {
        console.warn('No active Redis telemetry cache:', err.message);
      }

      renderCities();
    } catch (err) {
      console.error(err);
      showToast('Error loading city information', 'error');
    }
  }

  // Mobile menu toggle
  if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      appSidebar.classList.toggle('open');
    });
  }

  // Initial load
  checkSystemHealth();
  loadData();
});
