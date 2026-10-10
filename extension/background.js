/**
 * CLAG Downloader - Background Service Worker (Manifest V3)
 * Full media stream sniffer, download interceptor, and header relay.
 */

const CLAG_API_URL = 'http://localhost:8989/api/downloads';

// In-memory tab streams cache (persisted to chrome.storage.session for SW lifecycle)
const tabMediaStreams = new Map();

// Context Menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clag-download-link',
    title: 'Download with CLAG',
    contexts: ['link', 'video', 'audio', 'image'],
  });

  chrome.contextMenus.create({
    id: 'clag-download-page',
    title: 'Download page media with CLAG',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const targetUrl = info.linkUrl || info.srcUrl || tab?.url;
  if (!targetUrl) return;

  sendToClagCore(targetUrl, tab?.title, tab?.url);
});

// Sniff Network Requests for Video/Audio Streams (m3u8, mpd, mp4, webm)
const MEDIA_EXT_REGEX = /\.(m3u8|mpd|mp4|webm|flv|m4v|ts|aac|mp3|ogg)($|\?)/i;

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId <= 0) return;

    const url = details.url;
    let isMedia = MEDIA_EXT_REGEX.test(url);

    if (!isMedia && details.responseHeaders) {
      for (const h of details.responseHeaders) {
        const name = h.name.toLowerCase();
        if (name === 'content-type') {
          const val = (h.value || '').toLowerCase();
          if (
            val.includes('video/') ||
            val.includes('audio/') ||
            val.includes('application/vnd.apple.mpegurl') ||
            val.includes('application/dash+xml') ||
            val.includes('application/x-mpegurl')
          ) {
            isMedia = true;
            break;
          }
        }
      }
    }

    if (isMedia && !url.includes('.ts?') && !url.includes('.m4s?')) {
      const tabId = details.tabId;
      if (!tabMediaStreams.has(tabId)) {
        tabMediaStreams.set(tabId, new Map());
      }
      const streams = tabMediaStreams.get(tabId);
      if (!streams.has(url)) {
        streams.set(url, {
          url,
          timestamp: Date.now(),
          type: url.includes('.m3u8') ? 'HLS Stream (.m3u8)' : url.includes('.mpd') ? 'DASH Stream (.mpd)' : 'Video Stream',
        });

        // Update badge count
        const count = streams.size;
        chrome.action.setBadgeText({ tabId, text: String(count) });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#0284c7' });
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Clear tab media when tab is closed or navigated
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaStreams.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabMediaStreams.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});

// Intercept browser file downloads
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  const { autoIntercept = true } = await chrome.storage.local.get('autoIntercept');
  if (!autoIntercept) return;

  if (downloadItem.url.startsWith('blob:') || downloadItem.url.startsWith('chrome-extension:')) {
    return;
  }

  const success = await sendToClagCore(
    downloadItem.finalUrl || downloadItem.url,
    downloadItem.filename,
    downloadItem.referrer
  );

  if (success) {
    chrome.downloads.cancel(downloadItem.id, () => {
      chrome.downloads.erase({ id: downloadItem.id });
    });
  }
});

// Message listener from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SEND_TO_CLAG') {
    sendToClagCore(msg.url, msg.title, msg.pageUrl, msg.isMediaStream, msg.audioOnly, msg.mediaFormatId, msg.downloadSubtitles).then((success) => {
      sendResponse({ success });
    });
    return true;
  }

  if (msg.type === 'GET_SNIFFED_STREAMS') {
    const tabId = msg.tabId || sender.tab?.id;
    const streams = tabMediaStreams.get(tabId);
    const list = streams ? Array.from(streams.values()) : [];
    sendResponse({ streams: list });
    return true;
  }
});

async function sendToClagCore(url, filename, referrer, isMediaStream, audioOnly = false, mediaFormatId, downloadSubtitles = true) {
  try {
    let finalUrl = url;
    let isMedia = !!isMediaStream;

    // Detect YouTube and social streams
    if (referrer && (referrer.includes('youtube.com') || referrer.includes('youtu.be'))) {
      finalUrl = referrer;
      isMedia = true;
    } else if (url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('googlevideo.com'))) {
      if (referrer && (referrer.includes('youtube.com') || referrer.includes('youtu.be'))) {
        finalUrl = referrer;
      }
      isMedia = true;
    }

    const cookies = await chrome.cookies.getAll({ url: finalUrl });
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await fetch(CLAG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: finalUrl,
        filename: filename || undefined,
        originalUrl: referrer || finalUrl,
        isMediaStream: isMedia,
        audioOnly: !!audioOnly,
        mediaFormatId: mediaFormatId || undefined,
        downloadSubtitles: downloadSubtitles ?? true,
        connections: 16,
        headers: {
          Cookie: cookieHeader,
          Referer: referrer || finalUrl,
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not contact CLAG Core at ' + CLAG_API_URL, err);
    return false;
  }
}
