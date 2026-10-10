/**
 * CLAG Downloader - Content Script (In-Page Buttons & Media Sniffer)
 * Injects native in-page download buttons on supported sites (YouTube, Twitter/X, Instagram, TikTok, Facebook)
 * and floating sniffer badges on any HTML5 video player.
 * Author: Wael Sayed
 */

(function () {
  const PROCESSED_ATTR = 'data-clag-injected';

  function showToast(message) {
    const existing = document.querySelector('.clag-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'clag-toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function sendDownload(url, isMedia = true, audioOnly = false, mediaFormatId) {
    chrome.runtime.sendMessage({
      type: 'SEND_TO_CLAG',
      url: url,
      pageUrl: window.location.href,
      title: document.title,
      isMediaStream: isMedia,
      audioOnly: audioOnly,
      mediaFormatId: mediaFormatId,
      downloadSubtitles: true,
    }, (res) => {
      if (res && res.success) {
        showToast(audioOnly ? 'Queued MP3 Audio in CLAG! 🎵' : 'Queued Video in CLAG! ⚡');
      } else {
        showToast('Sent to CLAG Core! ⚡');
      }
    });
  }

  // =========================================================================
  // 1. YouTube In-Page Injection
  // =========================================================================
  function injectYouTube() {
    const host = window.location.hostname;
    if (!host.includes('youtube.com')) return;

    // A. Main Watch Page Action Bar
    if (window.location.pathname.startsWith('/watch')) {
      const targetMenu = 
        document.querySelector('#actions #actions-inner #menu') ||
        document.querySelector('ytd-watch-metadata #actions ytd-menu-renderer #top-level-buttons-computed') ||
        document.querySelector('#top-row #actions #top-level-buttons-computed') ||
        document.querySelector('#top-row #actions');

      if (targetMenu && !targetMenu.querySelector('.clag-yt-action-container')) {
        const container = document.createElement('div');
        container.className = 'clag-yt-action-container';
        container.innerHTML = `
          <button class="clag-yt-pill-btn" type="button" title="Download with CLAG Downloader">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>CLAG Download</span>
          </button>
          <div class="clag-menu-dropdown">
            <button class="clag-menu-item" data-action="best">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Best Available (Auto 4K/1080p MP4)
            </button>
            <button class="clag-menu-item" data-action="1080">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              1080p Full HD (MP4)
            </button>
            <button class="clag-menu-item" data-action="720">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              720p HD (MP4)
            </button>
            <button class="clag-menu-item" data-action="audio">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              Extract Audio Only (MP3)
            </button>
          </div>
        `;

        const btn = container.querySelector('.clag-yt-pill-btn');
        const dropdown = container.querySelector('.clag-menu-dropdown');

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('clag-open');
        });

        dropdown.querySelectorAll('.clag-menu-item').forEach((item) => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.remove('clag-open');
            const action = item.getAttribute('data-action');
            let formatId;
            let isAudio = false;
            if (action === 'audio') {
              isAudio = true;
            } else if (action === '1080') {
              formatId = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
            } else if (action === '720') {
              formatId = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
            }
            sendDownload(window.location.href, true, isAudio, formatId);
          });
        });

        document.addEventListener('click', () => {
          dropdown.classList.remove('clag-open');
        });

        // Insert at beginning of action buttons
        if (targetMenu.firstChild) {
          targetMenu.insertBefore(container, targetMenu.firstChild);
        } else {
          targetMenu.appendChild(container);
        }
      }
    }

    // B. YouTube Shorts Vertical Action Bar
    if (window.location.pathname.startsWith('/shorts')) {
      const shortsActions = document.querySelector('ytd-shorts #actions') || document.querySelector('ytd-reel-player-header-renderer');
      if (shortsActions && !shortsActions.querySelector('.clag-yt-shorts-btn')) {
        const btn = document.createElement('div');
        btn.className = 'clag-yt-shorts-btn';
        btn.title = 'Download Short with CLAG';
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        `;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          sendDownload(window.location.href, true, false);
        });
        shortsActions.appendChild(btn);
      }
    }
  }

  // =========================================================================
  // 2. Twitter / X In-Page Action Button
  // =========================================================================
  function injectTwitter() {
    const host = window.location.hostname;
    if (!host.includes('twitter.com') && !host.includes('x.com')) return;

    const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
    tweetArticles.forEach((article) => {
      // Check if tweet contains media
      const hasMedia = article.querySelector('video') || article.querySelector('[data-testid="videoPlayer"]');
      if (!hasMedia) return;

      const actionGroup = article.querySelector('[role="group"]');
      if (!actionGroup || actionGroup.querySelector('.clag-x-action-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'clag-x-action-btn';
      btn.title = 'Download Video with CLAG';
      btn.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Find tweet link
        const timeLink = article.querySelector('time')?.parentElement;
        const tweetUrl = timeLink ? timeLink.href : window.location.href;
        sendDownload(tweetUrl, true, false);
      });

      actionGroup.appendChild(btn);
    });
  }

  // =========================================================================
  // 3. Instagram In-Page Action Button
  // =========================================================================
  function injectInstagram() {
    const host = window.location.hostname;
    if (!host.includes('instagram.com')) return;

    // Posts with videos
    const videoPosts = document.querySelectorAll('article');
    videoPosts.forEach((post) => {
      const video = post.querySelector('video');
      if (!video) return;

      const section = post.querySelector('section');
      if (!section || section.querySelector('.clag-social-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'clag-social-btn';
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>CLAG Download</span>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendDownload(window.location.href, true, false);
      });
      section.appendChild(btn);
    });
  }

  // =========================================================================
  // 4. TikTok In-Page Action Button
  // =========================================================================
  function injectTikTok() {
    const host = window.location.hostname;
    if (!host.includes('tiktok.com')) return;

    const actionContainers = document.querySelectorAll('[data-e2e="feed-action-item"], .action-item-list');
    actionContainers.forEach((container) => {
      if (container.parentElement && !container.parentElement.querySelector('.clag-social-btn')) {
        const btn = document.createElement('button');
        btn.className = 'clag-social-btn';
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>CLAG</span>
        `;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          sendDownload(window.location.href, true, false);
        });
        container.parentElement.appendChild(btn);
      }
    });
  }

  // =========================================================================
  // 5. Generic HTML5 Floating Video Sniffer Badge
  // =========================================================================
  function attachSnifferToMedia(mediaEl) {
    if (mediaEl.hasAttribute(PROCESSED_ATTR)) return;
    mediaEl.setAttribute(PROCESSED_ATTR, 'true');

    // On YouTube and primary social sites, in-page buttons are already placed
    const host = window.location.hostname.toLowerCase();
    if (host.includes('youtube.com')) return;

    const parent = mediaEl.parentElement;
    if (!parent) return;

    const computed = window.getComputedStyle(parent);
    if (computed.position === 'static') {
      parent.style.position = 'relative';
    }

    const btn = document.createElement('div');
    btn.className = 'clag-sniffer-panel';
    btn.innerHTML = `
      <div class="clag-sniffer-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <span class="clag-sniffer-text">Download with CLAG</span>
      <span class="clag-sniffer-badge">⚡</span>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      let targetUrl = window.location.href;
      if (mediaEl.currentSrc && !mediaEl.currentSrc.startsWith('blob:') && !mediaEl.currentSrc.includes('googlevideo.com')) {
        targetUrl = mediaEl.currentSrc;
      }

      sendDownload(targetUrl, true, false);
    });

    parent.appendChild(btn);
  }

  function scanAll() {
    injectYouTube();
    injectTwitter();
    injectInstagram();
    injectTikTok();

    const videos = document.querySelectorAll('video');
    videos.forEach(attachSnifferToMedia);
  }

  // Initial Scan
  scanAll();

  // Dynamic MutationObserver for SPA changes
  const observer = new MutationObserver(() => {
    scanAll();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Communication with Popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_MEDIA') {
      const mediaList = [];
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        const src = v.currentSrc || v.src;
        if (src) {
          mediaList.push({
            url: src,
            title: document.title,
            type: 'video',
          });
        }
      });
      sendResponse({ media: mediaList, title: document.title, url: window.location.href });
    }
    return true;
  });
})();
