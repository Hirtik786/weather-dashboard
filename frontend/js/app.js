/**
 * Weather Dashboard - Main Application Script (index.html)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let weatherData = [];
  let weatherSummary = null;
  let currentSort = { column: 'city', ascending: true };
  let activeFilter = 'All';
  let searchTerm = '';

  // Chart instances
  let tempChart = null;
  let humidityChart = null;
  let windChart = null;

  // DOM Elements
  const lastUpdatedEl = document.getElementById('lastUpdatedText');
  const btnFetch = document.getElementById('btnFetch');
  const btnRefresh = document.getElementById('btnRefresh');
  const searchInput = document.getElementById('citySearch');
  const conditionFilter = document.getElementById('conditionFilter');
  const weatherTableBody = document.getElementById('weatherTableBody');
  const tableContainer = document.getElementById('tableContainer');
  const emptyStateEl = document.getElementById('emptyState');
  const toastContainer = document.getElementById('toastContainer');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const appSidebar = document.getElementById('appSidebar');

  // Metric Elements
  const metricTotalCities = document.getElementById('metricTotalCities');
  const metricAvgTemp = document.getElementById('metricAvgTemp');
  const metricHottest = document.getElementById('metricHottest');
  const metricColdest = document.getElementById('metricColdest');
  const metricAvgHumidity = document.getElementById('metricAvgHumidity');
  const metricAvgWind = document.getElementById('metricAvgWind');

  // Sidebar Status Elements
  const statusApiDot = document.getElementById('statusApiDot');
  const statusApiText = document.getElementById('statusApiText');
  const statusRedisDot = document.getElementById('statusRedisDot');
  const statusRedisText = document.getElementById('statusRedisText');

  // ==========================================
  // Helper: Format Date & Time
  // ==========================================
  function formatDateTime(isoOrTimestamp) {
    if (!isoOrTimestamp) return '--';
    const date = new Date(isoOrTimestamp);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatShortTime(isoOrTimestamp) {
    if (!isoOrTimestamp) return '--';
    const date = new Date(isoOrTimestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // ==========================================
  // Toast Notifications
  // ==========================================
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

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    });

    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
      }
    }, 4500);
  }

  // ==========================================
  // System Health Monitoring
  // ==========================================
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
      } else {
        statusApiDot.classList.remove('online');
        statusApiText.textContent = 'API Offline';
        statusRedisDot.classList.remove('online');
        statusRedisText.textContent = 'Redis Offline';
      }
    } catch (e) {
      statusApiDot.classList.remove('online');
      statusApiText.textContent = 'API Offline';
      statusRedisDot.classList.remove('online');
      statusRedisText.textContent = 'Redis Offline';
    }
  }

  // ==========================================
  // Render Summary Metric Cards
  // ==========================================
  function updateSummaryCards(summary) {
    if (!summary || !summary.successfulCount) {
      metricTotalCities.textContent = '--';
      metricAvgTemp.textContent = '--';
      metricHottest.textContent = '--';
      metricColdest.textContent = '--';
      metricAvgHumidity.textContent = '--';
      metricAvgWind.textContent = '--';
      return;
    }

    metricTotalCities.textContent = summary.totalCities || '20';
    metricAvgTemp.textContent = summary.avgTemperature !== null ? `${summary.avgTemperature}°F` : '--';

    if (summary.hottestCity) {
      metricHottest.innerHTML = `
        <div style="font-size: 20px; font-weight: 700; line-height: 1.2;">${summary.hottestCity.city}</div>
        <div style="font-size: 15px; color: #f87171; font-weight: 600;">${summary.hottestCity.temperature}°F</div>
      `;
    } else {
      metricHottest.textContent = '--';
    }

    if (summary.coldestCity) {
      metricColdest.innerHTML = `
        <div style="font-size: 20px; font-weight: 700; line-height: 1.2;">${summary.coldestCity.city}</div>
        <div style="font-size: 15px; color: #38bdf8; font-weight: 600;">${summary.coldestCity.temperature}°F</div>
      `;
    } else {
      metricColdest.textContent = '--';
    }

    metricAvgHumidity.textContent = summary.avgHumidity !== null ? `${summary.avgHumidity}%` : '--';
    metricAvgWind.textContent = summary.avgWindSpeed !== null ? `${summary.avgWindSpeed} mph` : '--';
  }

  // ==========================================
  // Render / Update Chart.js Visualizations
  // ==========================================
  function updateCharts(cities) {
    const validCities = cities.filter((c) => c.success && typeof c.temperature === 'number');
    if (validCities.length === 0) return;

    const labels = validCities.map((c) => c.city);
    const temperatures = validCities.map((c) => c.temperature);
    const humidities = validCities.map((c) => c.humidity);
    const windSpeeds = validCities.map((c) => c.windSpeed);

    // 1. Temperature Bar Chart
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    if (tempChart) tempChart.destroy();

    tempChart = new Chart(tempCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature (°F)',
            data: temperatures,
            backgroundColor: temperatures.map((t) => (t >= 80 ? 'rgba(239, 68, 68, 0.85)' : t >= 65 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(59, 130, 246, 0.85)')),
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw}°F`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => `${val}°F`,
              font: { size: 11 }
            }
          }
        }
      }
    });

    // 2. Humidity Bar Chart
    const humidityCtx = document.getElementById('humidityChart').getContext('2d');
    if (humidityChart) humidityChart.destroy();

    humidityChart = new Chart(humidityCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Humidity (%)',
            data: humidities,
            backgroundColor: 'rgba(6, 182, 212, 0.8)',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => `${val}%`,
              font: { size: 11 }
            }
          }
        }
      }
    });

    // 3. Wind Speed Line/Bar Chart
    const windCtx = document.getElementById('windChart').getContext('2d');
    if (windChart) windChart.destroy();

    windChart = new Chart(windCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Wind Speed (mph)',
            data: windSpeeds,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#8b5cf6',
            pointRadius: 3.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} mph`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => `${val} mph`,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  // ==========================================
  // Render City Weather Table
  // ==========================================
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

  function renderTable() {
    if (!weatherData || weatherData.length === 0) {
      tableContainer.style.display = 'none';
      emptyStateEl.style.display = 'block';
      return;
    }

    tableContainer.style.display = 'block';
    emptyStateEl.style.display = 'none';

    // 1. Filter
    let filtered = weatherData.filter((item) => {
      // Search term filter
      const matchesSearch =
        item.city.toLowerCase().includes(searchTerm) ||
        (item.state && item.state.toLowerCase().includes(searchTerm)) ||
        (item.stateCode && item.stateCode.toLowerCase().includes(searchTerm));

      // Condition filter
      const matchesCondition =
        activeFilter === 'All' ||
        (item.category && item.category.toLowerCase() === activeFilter.toLowerCase()) ||
        (item.condition && item.condition.toLowerCase().includes(activeFilter.toLowerCase()));

      return matchesSearch && matchesCondition;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      // Handle nulls
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string') {
        return currentSort.ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return currentSort.ascending ? valA - valB : valB - valA;
    });

    // 3. Render HTML
    if (filtered.length === 0) {
      weatherTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            No cities match the current filter or search criteria.
          </td>
        </tr>
      `;
      return;
    }

    weatherTableBody.innerHTML = filtered
      .map((city) => {
        if (!city.success && city.error) {
          return `
            <tr>
              <td>
                <div class="city-cell">
                  <span class="city-name">${city.city}</span>
                  <span class="city-state">${city.state || ''}</span>
                </div>
              </td>
              <td colspan="5" style="color: #ef4444; font-size: 13px;">Weather unavailable</td>
              <td>${formatShortTime(city.timestamp)}</td>
            </tr>
          `;
        }

        const badgeClass = getBadgeClass(city.category);

        return `
          <tr>
            <td>
              <div class="city-cell">
                <span class="city-name">${city.city}</span>
                <span class="city-state">${city.state || ''}</span>
              </div>
            </td>
            <td style="font-weight: 700;">${city.temperature !== null ? `${city.temperature}°F` : '--'}</td>
            <td style="color: var(--text-muted);">${city.feelsLike !== null ? `${city.feelsLike}°F` : '--'}</td>
            <td>${city.humidity !== null ? `${city.humidity}%` : '--'}</td>
            <td>${city.windSpeed !== null ? `${city.windSpeed} mph` : '--'}</td>
            <td>
              <span class="condition-badge ${badgeClass}">
                <span>${city.icon || '☀️'}</span>
                <span>${city.condition || 'Clear'}</span>
              </span>
            </td>
            <td style="color: var(--text-muted); font-size: 12.5px;">${formatShortTime(city.timestamp)}</td>
          </tr>
        `;
      })
      .join('');
  }

  // ==========================================
  // Populate Whole Dashboard
  // ==========================================
  function updateDashboardView(result) {
    weatherData = result.data || [];
    weatherSummary = result.summary || null;

    if (result.fetchedAt) {
      lastUpdatedEl.textContent = formatDateTime(result.fetchedAt);
    }

    updateSummaryCards(weatherSummary);
    updateCharts(weatherData);
    renderTable();
  }

  // ==========================================
  // Load Latest Weather (Strictly from Redis)
  // ==========================================
  async function loadLatestWeather() {
    try {
      const result = await window.WeatherAPI.getLatestWeather();
      if (result.success && result.data && result.data.length > 0) {
        updateDashboardView(result);
      } else {
        // Empty state in Redis
        tableContainer.style.display = 'none';
        emptyStateEl.style.display = 'block';
        updateSummaryCards(null);
      }
    } catch (err) {
      console.warn('Initial Redis load:', err.message);
      tableContainer.style.display = 'none';
      emptyStateEl.style.display = 'block';
      updateSummaryCards(null);
    }
  }

  // ==========================================
  // Action: Get Weather Data (POST /api/weather/fetch)
  // ==========================================
  async function handleFetchWeatherData() {
    btnFetch.disabled = true;
    const origHtml = btnFetch.innerHTML;
    btnFetch.innerHTML = `<span class="spinner"></span> Fetching weather...`;

    try {
      const res = await window.WeatherAPI.fetchFreshWeather();
      if (res.success) {
        updateDashboardView(res);
        showToast('Weather data updated successfully', 'success');
      } else {
        showToast(res.message || 'Unable to fetch weather data', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to communicate with weather service', 'error');
    } finally {
      btnFetch.disabled = false;
      btnFetch.innerHTML = origHtml;
      checkSystemHealth();
    }
  }

  // ==========================================
  // Action: Refresh (GET /api/weather/latest strictly from Redis)
  // ==========================================
  async function handleRefresh() {
    btnRefresh.disabled = true;
    const origHtml = btnRefresh.innerHTML;
    btnRefresh.innerHTML = `<span class="spinner"></span> Refreshing...`;

    try {
      const res = await window.WeatherAPI.getLatestWeather();
      if (res.success) {
        updateDashboardView(res);
        showToast('Dashboard refreshed from Redis', 'success');
      } else {
        showToast(res.message || 'No weather data available in Redis', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Unable to load cached weather from Redis', 'error');
    } finally {
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = origHtml;
      checkSystemHealth();
    }
  }

  // ==========================================
  // Table Sorting & Filtering Event Handlers
  // ==========================================
  document.querySelectorAll('.data-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (currentSort.column === col) {
        currentSort.ascending = !currentSort.ascending;
      } else {
        currentSort.column = col;
        currentSort.ascending = true;
      }

      // Update UI classes
      document.querySelectorAll('.data-table th').forEach((t) => {
        t.classList.remove('sorted-asc', 'sorted-desc');
        const icon = t.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
      });

      th.classList.add(currentSort.ascending ? 'sorted-asc' : 'sorted-desc');
      const icon = th.querySelector('.sort-icon');
      if (icon) {
        icon.textContent = currentSort.ascending ? '▲' : '▼';
      }

      renderTable();
    });
  });

  // Search input instant filter
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderTable();
  });

  // Category filter dropdown
  conditionFilter.addEventListener('change', (e) => {
    activeFilter = e.target.value;
    renderTable();
  });

  // Mobile drawer toggle
  if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      appSidebar.classList.toggle('open');
    });
  }

  // Wire buttons
  btnFetch.addEventListener('click', handleFetchWeatherData);
  btnRefresh.addEventListener('click', handleRefresh);

  // Initial load
  checkSystemHealth();
  loadLatestWeather();

  // Periodic health check every 30 seconds
  setInterval(checkSystemHealth, 30000);
});
