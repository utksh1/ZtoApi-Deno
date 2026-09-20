// ==========================================================================
// ZaiProxy Telemetry Dashboard - Chart.js & Live Analytics (ui-ux-pro-max)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Theme Management
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;

  const savedTheme = localStorage.getItem("zaiproxy_theme") || "dark";
  if (savedTheme === "light") {
    body.classList.remove("dark-mode");
  } else {
    body.classList.add("dark-mode");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark-mode");
      localStorage.setItem("zaiproxy_theme", isDark ? "dark" : "light");
      updateChartColors();
    });
  }

  // Dashboard State
  let pollingActive = true;
  let pollingTimer = null;
  const POLLING_INTERVAL_MS = 5000;
  let rawRequests = [];
  let filteredRequests = [];
  let currentPage = 1;
  const itemsPerPage = 10;

  // Chart references
  let trafficChart = null;
  let statusChart = null;
  const latencyHistory = [];
  const maxHistoryPoints = 15;

  // Polling Toggle Button
  const togglePollingBtn = document.getElementById("togglePollingBtn");
  const pollingStatusIcon = document.getElementById("pollingStatusIcon");
  const connStatusText = document.getElementById("connStatusText");
  const pulseIndicator = document.querySelector(".pulse-indicator");

  if (togglePollingBtn) {
    togglePollingBtn.addEventListener("click", () => {
      pollingActive = !pollingActive;
      if (pollingActive) {
        pollingStatusIcon.textContent = "⏸";
        connStatusText.textContent = "Connected (Polling 5s)";
        if (pulseIndicator) pulseIndicator.style.backgroundColor = "var(--color-accent)";
        fetchDashboardData();
        startPolling();
      } else {
        pollingStatusIcon.textContent = "▶";
        connStatusText.textContent = "Polling Paused";
        if (pulseIndicator) pulseIndicator.style.backgroundColor = "var(--color-warning)";
        stopPolling();
      }
    });
  }

  // Manual Refresh
  const manualRefreshBtn = document.getElementById("manualRefreshBtn");
  if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener("click", () => {
      renderSkeletonRows();
      fetchDashboardData();
    });
  }

  let socket = null;

  function connectWebSocket() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/dashboard/ws`;

    try {
      if (socket) {
        socket.close();
        socket = null;
      }

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (connStatusText) connStatusText.textContent = "Live (WebSocket Connected)";
        if (pulseIndicator) pulseIndicator.style.backgroundColor = "var(--color-accent)";
        stopPolling();
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "init") {
            if (msg.stats) updateStatsUI(msg.stats);
            if (Array.isArray(msg.requests)) {
              rawRequests = msg.requests;
              applyFiltersAndRenderTable();
              updateChartsWithRequests(rawRequests);
            }
          } else if (msg.type === "request") {
            rawRequests.unshift(msg.data);
            if (rawRequests.length > 100) rawRequests.pop();
            applyFiltersAndRenderTable();
            updateChartsWithRequests(rawRequests);
          } else if (msg.type === "stats") {
            updateStatsUI(msg.data);
          } else if (msg.type === "update_request") {
            const req = rawRequests.find((r) => r.id === msg.data?.id);
            if (req && msg.data?.updates) {
              Object.assign(req, msg.data.updates);
              applyFiltersAndRenderTable();
            }
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        if (connStatusText) connStatusText.textContent = "Reconnecting WebSocket...";
        if (pulseIndicator) pulseIndicator.style.backgroundColor = "var(--color-warning)";
        startPolling();
        setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = () => {
        if (connStatusText) connStatusText.textContent = "WS Fallback (Polling)";
        startPolling();
      };
    } catch {
      startPolling();
    }
  }

  function startPolling() {
    stopPolling();
    pollingTimer = setInterval(fetchDashboardData, POLLING_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  // Animated Counter
  function animateValue(id, start, end, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    if (start === end) {
      el.textContent = end;
      return;
    }
    const range = end - start;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const val = Math.floor(start + range * progress);
      el.textContent = val;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = end;
      }
    }
    requestAnimationFrame(update);
  }

  // Fetch Stats and Requests
  async function fetchDashboardData() {
    try {
      const [statsRes, requestsRes] = await Promise.all([
        fetch("/dashboard/stats"),
        fetch("/dashboard/requests"),
      ]);

      if (statsRes.ok) {
        const stats = await statsRes.json();
        updateStatsUI(stats);
      }

      if (requestsRes.ok) {
        const requests = await requestsRes.json();
        if (Array.isArray(requests)) {
          rawRequests = requests;
          applyFiltersAndRenderTable();
          updateChartsWithRequests(requests);
        }
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      if (connStatusText) connStatusText.textContent = "Connection Error";
      if (pulseIndicator) pulseIndicator.style.backgroundColor = "var(--color-danger)";
    }
  }

  // Update Stats UI
  function updateStatsUI(stats) {
    const totalEl = document.getElementById("stat-total");
    const currentTotal = parseInt(totalEl?.textContent || "0", 10) || 0;
    const targetTotal = stats.totalRequests || 0;
    animateValue("stat-total", currentTotal, targetTotal, 600);

    const successful = stats.successfulRequests || 0;
    const failed = stats.failedRequests || 0;
    const total = targetTotal || (successful + failed);

    const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;
    const rateEl = document.getElementById("stat-success-rate");
    if (rateEl) rateEl.textContent = `${successRate}%`;

    const successCountEl = document.getElementById("stat-successful-count");
    if (successCountEl) successCountEl.textContent = successful;

    const failedEl = document.getElementById("stat-failed");
    if (failedEl) failedEl.textContent = failed;

    const avgLatency = Math.round(stats.averageResponseTime || 0);
    const avgLatencyEl = document.getElementById("stat-avg-latency");
    if (avgLatencyEl) avgLatencyEl.textContent = `${avgLatency}ms`;

    // Push latency to trend history
    const nowLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    latencyHistory.push({ time: nowLabel, latency: avgLatency, requests: total });
    if (latencyHistory.length > maxHistoryPoints) {
      latencyHistory.shift();
    }
  }

  // Setup Chart.js
  function initCharts() {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js not loaded");
      return;
    }

    const isDark = body.classList.contains("dark-mode");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94A3B8" : "#64748B";

    // 1. Traffic Chart (Line/Area)
    const trafficCtx = document.getElementById("trafficChart")?.getContext("2d");
    if (trafficCtx) {
      trafficChart = new Chart(trafficCtx, {
        type: "line",
        data: {
          labels: ["Start"],
          datasets: [
            {
              label: "Avg Latency (ms)",
              data: [0],
              borderColor: "#38BDF8",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              borderWidth: 2,
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#38BDF8",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 11 } },
            },
            tooltip: {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              titleColor: isDark ? "#F8FAFC" : "#0F172A",
              bodyColor: isDark ? "#E2E8F0" : "#334155",
              borderColor: isDark ? "#334155" : "#E2E8F0",
              borderWidth: 1,
              padding: 10,
            },
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 10 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 10 } },
            },
          },
        },
      });
    }

    // 2. Status Chart (Doughnut)
    const statusCtx = document.getElementById("statusChart")?.getContext("2d");
    if (statusCtx) {
      statusChart = new Chart(statusCtx, {
        type: "doughnut",
        data: {
          labels: ["2xx Success", "4xx Client Error", "5xx Server Error"],
          datasets: [
            {
              data: [1, 0, 0],
              backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
              borderColor: isDark ? "#0E1526" : "#FFFFFF",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 11 }, padding: 12 },
            },
          },
        },
      });
    }
  }

  function updateChartColors() {
    if (!trafficChart && !statusChart) return;
    const isDark = body.classList.contains("dark-mode");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94A3B8" : "#64748B";

    if (trafficChart) {
      trafficChart.options.scales.x.grid.color = gridColor;
      trafficChart.options.scales.y.grid.color = gridColor;
      trafficChart.options.scales.x.ticks.color = textColor;
      trafficChart.options.scales.y.ticks.color = textColor;
      trafficChart.options.plugins.legend.labels.color = textColor;
      trafficChart.update();
    }

    if (statusChart) {
      statusChart.data.datasets[0].borderColor = isDark ? "#0E1526" : "#FFFFFF";
      statusChart.options.plugins.legend.labels.color = textColor;
      statusChart.update();
    }
  }

  function updateChartsWithRequests(requests) {
    // Update Line chart with history
    if (trafficChart && latencyHistory.length > 0) {
      trafficChart.data.labels = latencyHistory.map((h) => h.time);
      trafficChart.data.datasets[0].data = latencyHistory.map((h) => h.latency);
      trafficChart.update();
    }

    // Update Status chart breakdown
    if (statusChart && requests.length > 0) {
      let s2xx = 0;
      let s4xx = 0;
      let s5xx = 0;
      for (const r of requests) {
        const code = r.status || 200;
        if (code >= 200 && code < 300) s2xx++;
        else if (code >= 400 && code < 500) s4xx++;
        else if (code >= 500) s5xx++;
      }
      statusChart.data.datasets[0].data = [s2xx, s4xx, s5xx];
      statusChart.update();
    }
  }

  // Filter and Search Table
  const tableSearchInput = document.getElementById("tableSearchInput");
  const statusFilterSelect = document.getElementById("statusFilterSelect");
  const requestsTableBody = document.getElementById("requestsTableBody");
  const requestCountPill = document.getElementById("requestCountPill");
  const paginationInfo = document.getElementById("paginationInfo");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");

  if (tableSearchInput) {
    tableSearchInput.addEventListener("input", () => {
      currentPage = 1;
      applyFiltersAndRenderTable();
    });
  }

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener("change", () => {
      currentPage = 1;
      applyFiltersAndRenderTable();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTableRows();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      const maxPage = Math.ceil(filteredRequests.length / itemsPerPage);
      if (currentPage < maxPage) {
        currentPage++;
        renderTableRows();
      }
    });
  }

  function applyFiltersAndRenderTable() {
    const query = tableSearchInput?.value.trim().toLowerCase() || "";
    const filter = statusFilterSelect?.value || "all";

    filteredRequests = rawRequests.filter((item) => {
      // Status filter
      if (filter === "2xx" && (item.status < 200 || item.status >= 300)) return false;
      if (filter === "4xx" && (item.status < 400 || item.status >= 500)) return false;
      if (filter === "5xx" && item.status < 500) return false;

      // Text query filter
      if (query) {
        const path = (item.path || "").toLowerCase();
        const model = (item.model || "").toLowerCase();
        const ua = (item.userAgent || "").toLowerCase();
        const method = (item.method || "").toLowerCase();
        const err = (item.error || "").toLowerCase();
        if (
          !path.includes(query) && !model.includes(query) && !ua.includes(query) && !method.includes(query) &&
          !err.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });

    if (requestCountPill) {
      requestCountPill.textContent = `${filteredRequests.length} Requests`;
    }

    renderTableRows();
  }

  function renderSkeletonRows(count = 5) {
    if (!requestsTableBody) return;
    let html = "";
    for (let i = 0; i < count; i++) {
      const widthPx = 120 + (i * 18) % 50;
      html += `
        <tr class="skeleton-row" aria-busy="true" aria-label="Loading request telemetry">
          <td><div class="skeleton skeleton-text" style="width: 68px;"></div></td>
          <td><div class="skeleton skeleton-badge"></div></td>
          <td><div class="skeleton skeleton-text" style="width: ${widthPx}px;"></div></td>
          <td><div class="skeleton skeleton-text" style="width: 90px;"></div></td>
          <td><div class="skeleton skeleton-badge" style="width: 42px;"></div></td>
          <td><div class="skeleton skeleton-badge" style="width: 65px;"></div></td>
          <td><div class="skeleton skeleton-text" style="width: 45px;"></div></td>
          <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
        </tr>
      `;
    }
    requestsTableBody.innerHTML = html;
    if (paginationInfo) paginationInfo.textContent = "Retrieving live telemetry data...";
  }

  function renderTableRows() {
    if (!requestsTableBody) return;

    if (filteredRequests.length === 0) {
      if (rawRequests.length === 0) {
        requestsTableBody.innerHTML =
          `<tr><td colspan="8" class="table-empty">No requests recorded yet. Fire a query from the <a href="/" style="color:var(--color-accent);text-decoration:underline;">Playground</a> or send an API request to stream live telemetry.</td></tr>`;
      } else {
        requestsTableBody.innerHTML =
          `<tr><td colspan="8" class="table-empty">No requests match your filter criteria. <button type="button" id="clearFiltersBtn" style="background:none;border:none;color:var(--color-accent);text-decoration:underline;cursor:pointer;font-family:inherit;font-size:inherit;">Clear filters</button> to view all ${rawRequests.length} requests.</td></tr>`;
        document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
          if (tableSearchInput) tableSearchInput.value = "";
          if (statusFilterSelect) statusFilterSelect.value = "all";
          currentPage = 1;
          applyFiltersAndRenderTable();
        });
      }
      if (paginationInfo) paginationInfo.textContent = "Showing 0 of 0 requests";
      if (prevPageBtn) prevPageBtn.disabled = true;
      if (nextPageBtn) nextPageBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

    let html = "";
    pageItems.forEach((req) => {
      const date = new Date(req.timestamp);
      const timeStr = isNaN(date.getTime())
        ? "Just now"
        : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const method = req.method || "POST";
      const path = req.path || "/v1/chat/completions";
      const model = req.model || "—";
      const status = req.status || 200;
      const duration = req.duration || 0;

      let statusClass = "s2xx";
      if (status >= 400 && status < 500) statusClass = "s4xx";
      if (status >= 500) statusClass = "s5xx";

      let durationClass = "fast";
      if (duration > 500 && duration <= 2000) durationClass = "medium";
      if (duration > 2000) durationClass = "slow";

      // Format Tokens
      let tokensHtml = '<span class="text-muted">—</span>';
      if (req.tokens) {
        const p = req.tokens.prompt || 0;
        const c = req.tokens.completion || 0;
        const tot = req.tokens.total || (p + c);
        if (tot > 0) {
          tokensHtml =
            `<span class="tokens-badge font-mono" title="Prompt: ${p.toLocaleString()} | Completion: ${c.toLocaleString()}">${tot.toLocaleString()} tok</span>`;
        }
      }

      // Format Details / Error
      let detailHtml = '<span class="text-muted">—</span>';
      if (req.error) {
        detailHtml = `<span class="error-detail-tag font-mono" title="${escapeHtml(req.error)}">⚠️ ${
          escapeHtml(truncate(req.error, 32))
        }</span>`;
      } else if (status >= 200 && status < 300) {
        detailHtml = '<span class="text-success font-mono">✓ Success</span>';
      }

      html += `
        <tr>
          <td class="font-mono text-muted">${timeStr}</td>
          <td><span class="method-badge ${method}">${method}</span></td>
          <td class="font-mono">${escapeHtml(path)}</td>
          <td class="font-mono text-accent">${escapeHtml(model)}</td>
          <td><span class="status-tag ${statusClass}">${status}</span></td>
          <td>${tokensHtml}</td>
          <td><span class="duration-tag ${durationClass}">${duration}ms</span></td>
          <td>${detailHtml}</td>
        </tr>
      `;
    });

    requestsTableBody.innerHTML = html;

    const startNum = startIndex + 1;
    const endNum = Math.min(startIndex + itemsPerPage, filteredRequests.length);
    if (paginationInfo) {
      paginationInfo.textContent =
        `Showing ${startNum}-${endNum} of ${filteredRequests.length} requests (Page ${currentPage}/${totalPages})`;
    }
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  }

  // Export to JSON
  const exportJsonBtn = document.getElementById("exportJsonBtn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawRequests, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `zaiproxy_telemetry_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str || "";
    return str.slice(0, maxLen) + "…";
  }

  // Initialize
  initCharts();
  fetchDashboardData();
  connectWebSocket();
});
