/**
 * Reports Page Script (reports.html)
 * Reads historical weather archives strictly from Redis.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const repTotalReports = document.getElementById('repTotalReports');
  const repTotalCities = document.getElementById('repTotalCities');
  const repLatestReport = document.getElementById('repLatestReport');
  const repLastFetch = document.getElementById('repLastFetch');
  const reportsTableBody = document.getElementById('reportsTableBody');
  const reportsContainer = document.getElementById('reportsContainer');
  const reportsEmptyState = document.getElementById('reportsEmptyState');
  const btnRefreshReports = document.getElementById('btnRefreshReports');
  const toastContainer = document.getElementById('toastContainer');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const appSidebar = document.getElementById('appSidebar');

  // Sidebar Status Elements
  const statusApiDot = document.getElementById('statusApiDot');
  const statusApiText = document.getElementById('statusApiText');
  const statusRedisDot = document.getElementById('statusRedisDot');
  const statusRedisText = document.getElementById('statusRedisText');

  // Modal Elements
  const reportModal = document.getElementById('reportModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalReportTitle = document.getElementById('modalReportTitle');
  const modalReportSubtitle = document.getElementById('modalReportSubtitle');
  const modalCityTableBody = document.getElementById('modalCityTableBody');
  
  // Modal Stat Elements
  const modalStatAvgTemp = document.getElementById('modalStatAvgTemp');
  const modalStatHighTemp = document.getElementById('modalStatHighTemp');
  const modalStatLowTemp = document.getElementById('modalStatLowTemp');
  const modalStatHottest = document.getElementById('modalStatHottest');
  const modalStatColdest = document.getElementById('modalStatColdest');
  const modalStatAvgHumid = document.getElementById('modalStatAvgHumid');
  const modalStatAvgWind = document.getElementById('modalStatAvgWind');

  // Helper: Format Date & Time
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

  function formatShortDate(isoOrTimestamp) {
    if (!isoOrTimestamp) return '--';
    const date = new Date(isoOrTimestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

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

  // Load Historical Reports from Redis
  async function loadReports() {
    try {
      const result = await window.WeatherAPI.getReports();
      const reports = result.reports || [];

      if (reports.length === 0) {
        reportsContainer.style.display = 'none';
        reportsEmptyState.style.display = 'block';
        repTotalReports.textContent = '0';
        repTotalCities.textContent = '20';
        repLatestReport.textContent = '--';
        repLastFetch.textContent = '--';
        return;
      }

      reportsContainer.style.display = 'block';
      reportsEmptyState.style.display = 'none';

      // Summary counts
      repTotalReports.textContent = reports.length;
      repTotalCities.textContent = reports[0].cityCount || '20';
      repLatestReport.textContent = formatShortDate(reports[0].timestamp);
      repLastFetch.textContent = formatDateTime(reports[0].fetchedAt);

      // Render reports table
      reportsTableBody.innerHTML = reports
        .map((report) => {
          const formattedDate = formatDateTime(report.timestamp);
          const statusBadge =
            report.status === 'Complete'
              ? '<span class="condition-badge badge-clear">✓ Complete</span>'
              : '<span class="condition-badge badge-cloudy">⚠ Partial</span>';

          const avgTemp = report.summary && report.summary.avgTemperature !== null ? `${report.summary.avgTemperature}°F` : '--';

          return `
            <tr>
              <td style="font-weight: 600; color: var(--text-main);">
                ${formattedDate}
              </td>
              <td>${report.cityCount || 20} Cities</td>
              <td style="font-weight: 600;">${avgTemp}</td>
              <td>${statusBadge}</td>
              <td>
                <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12.5px;" onclick="viewReportDetails('${report.timestamp}')">
                  View Details
                </button>
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to retrieve reports from Redis', 'error');
    }
  }

  // View Single Report Details
  window.viewReportDetails = async function (timestamp) {
    try {
      showToast('Loading report details from Redis...', 'info');
      const res = await window.WeatherAPI.getReport(timestamp);

      if (!res.success || !res.report) {
        showToast('Report not found in Redis', 'error');
        return;
      }

      const report = res.report;
      const summary = report.summary || {};

      modalReportTitle.textContent = `Weather Report Snapshot`;
      modalReportSubtitle.textContent = `${formatDateTime(report.timestamp)} • ${report.cityCount || 20} US Cities • Status: ${report.status}`;

      // Populate summary statistics
      modalStatAvgTemp.textContent = summary.avgTemperature !== null ? `${summary.avgTemperature}°F` : '--';
      modalStatHighTemp.textContent = summary.highestTemperature !== null ? `${summary.highestTemperature}°F` : '--';
      modalStatLowTemp.textContent = summary.lowestTemperature !== null ? `${summary.lowestTemperature}°F` : '--';
      modalStatHottest.textContent = summary.hottestCity ? `${summary.hottestCity.city} (${summary.hottestCity.temperature}°F)` : '--';
      modalStatColdest.textContent = summary.coldestCity ? `${summary.coldestCity.city} (${summary.coldestCity.temperature}°F)` : '--';
      modalStatAvgHumid.textContent = summary.avgHumidity !== null ? `${summary.avgHumidity}%` : '--';
      modalStatAvgWind.textContent = summary.avgWindSpeed !== null ? `${summary.avgWindSpeed} mph` : '--';

      // Populate cities table
      const cities = report.cities || [];
      modalCityTableBody.innerHTML = cities
        .map((city) => {
          if (!city.success) {
            return `
              <tr>
                <td style="font-weight: 600;">${city.city}</td>
                <td colspan="5" style="color: #ef4444;">Weather unavailable</td>
              </tr>
            `;
          }

          return `
            <tr>
              <td style="font-weight: 600;">${city.city}, ${city.stateCode || ''}</td>
              <td style="font-weight: 700;">${city.temperature}°F</td>
              <td style="color: var(--text-muted);">${city.feelsLike !== null ? `${city.feelsLike}°F` : '--'}</td>
              <td>${city.humidity}%</td>
              <td>${city.windSpeed} mph</td>
              <td>
                <span style="font-size: 13px;">${city.icon || ''} ${city.condition || 'Clear'}</span>
              </td>
            </tr>
          `;
        })
        .join('');

      // Open Modal
      reportModal.classList.add('open');
      showToast('Report loaded successfully from Redis', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error fetching report details', 'error');
    }
  };

  function closeModal() {
    reportModal.classList.remove('open');
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalDismissBtn.addEventListener('click', closeModal);
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) closeModal();
  });

  // Refresh reports button
  btnRefreshReports.addEventListener('click', async () => {
    btnRefreshReports.disabled = true;
    btnRefreshReports.innerHTML = `<span class="spinner"></span> Refreshing...`;
    await loadReports();
    btnRefreshReports.disabled = false;
    btnRefreshReports.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
      Refresh Reports
    `;
    showToast('Historical reports refreshed from Redis', 'success');
  });

  // Mobile drawer toggle
  if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      appSidebar.classList.toggle('open');
    });
  }

  // Initial load
  checkSystemHealth();
  loadReports();
});
