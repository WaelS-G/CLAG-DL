const CLAG_BASE_URL = 'http://localhost:8989';

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const urlInput = document.getElementById('urlInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const mediaList = document.getElementById('mediaList');
  const interceptToggle = document.getElementById('interceptToggle');

  // Load intercept toggle state
  const { autoIntercept = true } = await chrome.storage.local.get('autoIntercept');
  interceptToggle.checked = autoIntercept;

  interceptToggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ autoIntercept: interceptToggle.checked });
  });

  // Check connection to CLAG Core
  try {
    const res = await fetch(`${CLAG_BASE_URL}/api/system/stats`);
    if (res.ok) {
      statusBadge.textContent = 'Core Active';
      statusBadge.className = 'status-badge connected';
    } else {
      throw new Error();
    }
  } catch (e) {
    statusBadge.textContent = 'Web Mode';
    statusBadge.className = 'status-badge disconnected';
  }

  // Open UIX dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: CLAG_BASE_URL });
  });

  // Download from input
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    try {
      const res = await fetch(`${CLAG_BASE_URL}/api/downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, connections: 16 }),
      });
      if (res.ok) {
        urlInput.value = '';
        downloadBtn.textContent = 'Added!';
        setTimeout(() => { downloadBtn.textContent = 'Download'; }, 1500);
      }
    } catch (err) {
      // In web-only mode, open download URL
      window.open(url, '_blank');
    }
  });

  // Query active tab media & sniffed streams
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const allStreams = new Map();

    // 1. Get network sniffed streams (m3u8, mpd, mp4)
    try {
      const sniffedResponse = await chrome.runtime.sendMessage({
        type: 'GET_SNIFFED_STREAMS',
        tabId: tab.id,
      });
      if (sniffedResponse?.streams) {
        sniffedResponse.streams.forEach((s) => {
          allStreams.set(s.url, s);
        });
      }
    } catch (e) {}

    // 2. Query DOM media
    try {
      const domResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_MEDIA' });
      if (domResponse?.media) {
        domResponse.media.forEach((m) => {
          if (!allStreams.has(m.url)) {
            allStreams.set(m.url, { url: m.url, type: 'HTML5 Video' });
          }
        });
      }
    } catch (e) {}

    // Render discovered streams
    if (allStreams.size > 0) {
      mediaList.innerHTML = '';
      let idx = 1;
      allStreams.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'media-item';
        div.innerHTML = `
          <div class="media-info" title="${item.url}">
            <strong>Stream ${idx++}:</strong> ${item.type}
          </div>
          <button class="btn primary" style="padding: 4px 8px; font-size: 10px;">Grab</button>
        `;
        const grabBtn = div.querySelector('button');
        grabBtn.addEventListener('click', async () => {
          await fetch(`${CLAG_BASE_URL}/api/downloads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url, originalUrl: tab.url, connections: 16 }),
          }).catch(() => {
            window.open(item.url, '_blank');
          });
          grabBtn.textContent = 'Added';
        });
        mediaList.appendChild(div);
      });
    }
  }
});
