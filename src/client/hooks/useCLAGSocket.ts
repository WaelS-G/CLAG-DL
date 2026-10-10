import { useState, useEffect, useRef, useCallback } from 'react';
import { DownloadTaskData, WSServerMessage, WSClientMessage, ChunkInfo } from '../../types/index.js';

const STORAGE_KEY = 'clag_browser_tasks';

export function useCLAGSocket() {
  const [tasks, setTasks] = useState<DownloadTaskData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isWebOnly, setIsWebOnly] = useState<boolean>(false);
  const [totalSpeed, setTotalSpeed] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Map to hold AbortControllers for active in-browser streaming downloads
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // Map to hold downloaded chunks for active tasks
  const chunksRef = useRef<Map<string, Uint8Array[]>>(new Map());

  // Sync tasks to local storage in web-only mode (excluding in-memory blob URLs)
  useEffect(() => {
    try {
      const serializable = tasks.map((t) => {
        const { blobUrl, ...rest } = t;
        return rest;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {}
  }, [tasks]);

  const connect = useCallback(() => {
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    const customCoreUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('clag_core_url') : null;

    let wsUrl = '';
    if (customCoreUrl) {
      try {
        const urlObj = new URL(customCoreUrl);
        const proto = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${urlObj.host}/ws`;
      } catch (e) {}
    } else if (isVercel) {
      // On Vercel without custom core, run in In-Browser Web Engine mode
      setIsWebOnly(true);
      setIsConnected(false);
      return;
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const port = window.location.port === '5173' ? '8989' : window.location.port || '8989';
      wsUrl = `${protocol}//${host}:${port}/ws`;
    }

    if (!wsUrl) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsWebOnly(false);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSServerMessage;
          switch (msg.type) {
            case 'DOWNLOAD_CREATED':
              setTasks((prev) => {
                const existingIdx = prev.findIndex((t) => t.id === msg.task.id);
                if (existingIdx >= 0) {
                  const next = [...prev];
                  next[existingIdx] = msg.task;
                  return next;
                }
                return [msg.task, ...prev];
              });
              break;

            case 'DOWNLOAD_PROGRESS':
              setTasks((prev) =>
                prev.map((t) => {
                  if (t.id === msg.id) {
                    return {
                      ...t,
                      downloadedBytes: msg.downloadedBytes,
                      speed: msg.speed,
                      progress: msg.progress,
                      eta: msg.eta,
                      chunks: msg.chunks && msg.chunks.length > 0 ? msg.chunks : t.chunks,
                    };
                  }
                  return t;
                })
              );
              break;

            case 'DOWNLOAD_STATUS_CHANGED':
              setTasks((prev) =>
                prev.map((t) => {
                  if (t.id === msg.id) {
                    return {
                      ...t,
                      status: msg.status,
                      error: msg.error,
                      speed: msg.status === 'completed' || msg.status === 'paused' || msg.status === 'error' ? 0 : t.speed,
                    };
                  }
                  return t;
                })
              );
              break;

            case 'DOWNLOAD_DELETED':
              setTasks((prev) => prev.filter((t) => t.id !== msg.id));
              break;
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onclose = () => {
        fetch('/api/downloads')
          .then((r) => {
            if (r.ok) {
              setIsConnected(true);
              setIsWebOnly(false);
            } else {
              setIsConnected(false);
              setIsWebOnly(true);
            }
          })
          .catch(() => {
            setIsConnected(false);
            setIsWebOnly(true);
          });
        reconnectTimeoutRef.current = setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      fetch('/api/downloads')
        .then((r) => {
          if (r.ok) {
            setIsConnected(true);
            setIsWebOnly(false);
          } else {
            setIsConnected(false);
            setIsWebOnly(true);
          }
        })
        .catch(() => {
          setIsConnected(false);
          setIsWebOnly(true);
        });
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Periodic HTTP Polling fallback when WebSocket is inactive (e.g. Python Desktop / EXE mode)
  useEffect(() => {
    let isMounted = true;
    const pollBackend = async () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return; // WebSocket takes precedence
      }
      try {
        const res = await fetch('/api/downloads');
        if (res.ok) {
          const serverTasks = await res.json();
          if (Array.isArray(serverTasks) && isMounted) {
            setTasks(serverTasks);
            setIsConnected(true);
            setIsWebOnly(false);
          }
        }
      } catch (_) {}
    };

    pollBackend();
    const interval = setInterval(pollBackend, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Recalculate total speed across active downloads
  useEffect(() => {
    const active = tasks.filter((t) => t.status === 'downloading');
    const speed = active.reduce((acc, t) => acc + (t.speed || 0), 0);
    setTotalSpeed(speed);
  }, [tasks]);

  const sendAction = useCallback((action: WSClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(action));
    }
    // Also dispatch HTTP REST action for Python / non-WS backends
    try {
      if (action.type === 'PAUSE_DOWNLOAD') {
        fetch(`/api/downloads/${encodeURIComponent(action.id)}/pause`, { method: 'POST' }).catch(() => {});
      } else if (action.type === 'RESUME_DOWNLOAD') {
        fetch(`/api/downloads/${encodeURIComponent(action.id)}/resume`, { method: 'POST' }).catch(() => {});
      } else if (action.type === 'DELETE_DOWNLOAD') {
        fetch(`/api/downloads/${encodeURIComponent(action.id)}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch (_) {}
  }, []);

  // Real In-Browser Streaming Downloader Engine
  const executeBrowserStream = useCallback(async (task: DownloadTaskData, resumeOffset: number = 0) => {
    const controller = new AbortController();
    controllersRef.current.set(task.id, controller);

    const rawUrl = task.originalUrl || task.url;
    let downloadUrl = task.streamUrl || '';

    // Check if the URL is a social media / stream link requiring extraction
    const isSocialMedia = /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|vimeo\.com|facebook\.com|fb\.watch|soundcloud\.com)/i.test(rawUrl);

    if (!downloadUrl && isSocialMedia) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'fetching_meta',
                progress: 10,
                speed: 0,
                qualityLabel: t.qualityLabel || 'Resolving direct media stream...',
              }
            : t
        )
      );

      let resolveErrorReason = '';
      try {
        // Step 1: Call /api/resolve serverless endpoint
        let resolved: any = null;
        try {
          const res = await fetch('/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: rawUrl,
              format: task.mediaFormatId || 'best',
              audioOnly: task.audioOnly,
            }),
            signal: controller.signal,
          });
          if (res.ok) {
            resolved = await res.json();
          } else {
            resolveErrorReason = `Server resolver returned HTTP ${res.status}`;
            console.warn('[CLAG Resolver] /api/resolve returned HTTP', res.status);
          }
        } catch (resolveApiErr: any) {
          resolveErrorReason = resolveApiErr.message || 'Resolver network error';
          console.warn('[CLAG Resolver] /api/resolve call error, falling back:', resolveApiErr);
        }

        // Step 2: Handle resolution result
        if (resolved?.ready && resolved?.downloadUrl) {
          downloadUrl = resolved.downloadUrl;
        } else if (resolved?.id) {
          // Poll until conversion is complete (up to 30s)
          const pollUrl = resolved.progressUrl || `https://lto2.affadaffa.com/api/progress?id=${resolved.id}`;
          const maxPolls = 20;
          for (let p = 0; p < maxPolls; p++) {
            if (controller.signal.aborted) return;
            await new Promise((r) => setTimeout(r, 1500));

            let pollData: any = null;
            try {
              // Direct poll on affadaffa CDN (CORS: *)
              const pr = await fetch(pollUrl, { signal: AbortSignal.timeout(5000) });
              if (pr.ok) pollData = await pr.json();
            } catch (pErr) {
              try {
                // Secondary fallback poll via /api/resolve
                const pr2 = await fetch(`/api/resolve?pollId=${resolved.id}`, { signal: AbortSignal.timeout(5000) });
                if (pr2.ok) pollData = await pr2.json();
              } catch (pErr2) {}
            }

            const currentPct = Math.min(95, 20 + Math.round((p / maxPolls) * 75));
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      status: 'fetching_meta',
                      progress: currentPct,
                      speed: 0,
                      qualityLabel: pollData?.text || `Converting stream (${currentPct}%)...`,
                    }
                  : t
              )
            );

            if (pollData?.download_url) {
              downloadUrl = pollData.download_url;
              break;
            }
          }
        }

        // Step 3: Invidious fallback for YouTube if loader.to did not resolve
        if (!downloadUrl && (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be'))) {
          const match = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
          const videoId = match ? match[1] : null;
          if (videoId) {
            const invidiousHosts = ['invidious.f5.si', 'yewtu.be', 'invidious.nerdvpn.de', 'inv.nadeko.net'];
            for (const host of invidiousHosts) {
              try {
                const r = await fetch(`https://${host}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(6000) });
                if (r.ok) {
                  const d = await r.json();
                  if (task.audioOnly) {
                    const aud = d.adaptiveFormats?.find((f: any) => f.type?.includes('audio'));
                    if (aud?.url) {
                      downloadUrl = aud.url;
                      break;
                    }
                  }
                  const vid = d.formatStreams?.[0] || d.adaptiveFormats?.[0];
                  if (vid?.url) {
                    downloadUrl = vid.url;
                    break;
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (resolutionErr: any) {
        if (resolutionErr.name === 'AbortError') return;
        console.error('[CLAG Stream Resolver Error]:', resolutionErr);
      }
    }

    // Direct binary link fallback (non-social media links)
    if (!downloadUrl) {
      if (!isSocialMedia) {
        downloadUrl = rawUrl;
      } else {
        // Could not resolve stream — never navigate away to social media webpage!
        const errMsg = resolveErrorReason.includes('404')
          ? 'Cloud resolver (/api/resolve) not found on host. Please ensure the api/ directory is deployed to Vercel.'
          : 'Could not extract direct media stream for this link. Please verify the URL or try 720p/Audio.';

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: 'error',
                  error: errMsg,
                  speed: 0,
                }
              : t
          )
        );
        controllersRef.current.delete(task.id);
        return;
      }
    }

    // Update task with the resolved stream URL
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              streamUrl: downloadUrl,
              status: 'downloading',
              progress: 0,
            }
          : t
      )
    );

    let response: Response | null = null;
    try {
      const headers: Record<string, string> = {};
      if (resumeOffset > 0) {
        headers['Range'] = `bytes=${resumeOffset}-`;
      }

      // 1. Try direct fetch
      try {
        const directRes = await fetch(downloadUrl, {
          signal: controller.signal,
          headers,
        });
        if (directRes.ok || directRes.status === 206) {
          response = directRes;
        } else {
          throw new Error(`HTTP ${directRes.status}`);
        }
      } catch (directErr: any) {
        if (directErr.name === 'AbortError') return;

        // 2. Direct fetch failed (CORS / network) - try stream proxy
        let proxySucceeded = false;
        try {
          const proxyUrl = `/api/stream?url=${encodeURIComponent(downloadUrl)}`;
          const proxyRes = await fetch(proxyUrl, {
            signal: controller.signal,
            headers,
          });
          if (proxyRes.ok || proxyRes.status === 206) {
            response = proxyRes;
            proxySucceeded = true;
          }
        } catch (_) {}

        // 3. Fallback: if fetch is blocked by CORS and proxy is unavailable, trigger native browser download
        if (!proxySucceeded || !response) {
          try {
            const dlAnchor = document.createElement('a');
            dlAnchor.href = downloadUrl;
            dlAnchor.download = task.filename;
            dlAnchor.rel = 'noopener';
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            setTimeout(() => {
              if (dlAnchor.parentNode) dlAnchor.parentNode.removeChild(dlAnchor);
            }, 2000);

            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      status: 'completed',
                      progress: 100,
                      speed: 0,
                      completedAt: Date.now(),
                      qualityLabel: 'Downloaded via browser',
                    }
                  : t
              )
            );
            controllersRef.current.delete(task.id);
            return;
          } catch (anchorErr: any) {
            throw new Error('Unable to stream media: ' + (anchorErr.message || 'Browser download blocked'));
          }
        }
      }

      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      const totalBytes = contentLength > 0 ? resumeOffset + contentLength : task.totalBytes || 0;
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      const reader = response.body?.getReader();
      if (!reader) {
        // Direct file save trigger without target="_blank"
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = task.filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 1500);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100, speed: 0, completedAt: Date.now() } : t))
        );
        return;
      }

      let downloaded = resumeOffset;
      const accumulatedChunks = chunksRef.current.get(task.id) || [];
      chunksRef.current.set(task.id, accumulatedChunks);

      let lastTime = performance.now();
      let lastBytes = downloaded;
      let lastUpdate = performance.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulatedChunks.push(value);
        downloaded += value.length;

        const now = performance.now();
        if (now - lastUpdate >= 200) {
          const timeDelta = (now - lastTime) / 1000;
          const currentSpeed = timeDelta > 0 ? Math.round((downloaded - lastBytes) / timeDelta) : 0;
          lastBytes = downloaded;
          lastTime = now;
          lastUpdate = now;

          const currentProgress = totalBytes > 0 ? Math.min(99.9, (downloaded / totalBytes) * 100) : 50;
          const remaining = totalBytes > 0 ? totalBytes - downloaded : 0;
          const eta = currentSpeed > 0 ? Math.round(remaining / currentSpeed) : 0;

          const segmentSize = totalBytes > 0 ? totalBytes / 8 : 1024 * 1024;
          const activeChunks: ChunkInfo[] = Array.from({ length: 8 }, (_, i) => {
            const segStart = i * segmentSize;
            const segEnd = (i + 1) * segmentSize;
            const segDownloaded = Math.max(0, Math.min(segmentSize, downloaded - segStart));
            const isComplete = downloaded >= segEnd;
            const isDownloading = downloaded > segStart && !isComplete;
            return {
              index: i,
              startByte: Math.round(segStart),
              endByte: Math.round(segEnd),
              downloadedBytes: Math.round(segDownloaded),
              totalBytes: Math.round(segmentSize),
              status: isComplete ? 'completed' : isDownloading ? 'downloading' : 'pending',
              speed: isDownloading ? currentSpeed : 0,
            };
          });

          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    downloadedBytes: downloaded,
                    totalBytes: totalBytes > 0 ? totalBytes : downloaded,
                    progress: currentProgress,
                    speed: currentSpeed,
                    eta,
                    chunks: activeChunks,
                    status: 'downloading',
                  }
                : t
            )
          );
        }
      }

      // Download complete: assemble Blob
      const blob = new Blob(accumulatedChunks, { type: contentType });
      const blobUrl = URL.createObjectURL(blob);

      // Trigger automatic save to device
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = task.filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 1500);

      controllersRef.current.delete(task.id);

      const completedChunks: ChunkInfo[] = Array.from({ length: 8 }, (_, i) => ({
        index: i,
        startByte: 0,
        endByte: downloaded,
        downloadedBytes: downloaded / 8,
        totalBytes: downloaded / 8,
        status: 'completed',
        speed: 0,
      }));

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                downloadedBytes: downloaded,
                totalBytes: downloaded,
                progress: 100,
                speed: 0,
                eta: 0,
                status: 'completed',
                blobUrl,
                chunks: completedChunks,
                completedAt: Date.now(),
              }
            : t
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[CLAG In-Browser Downloader] Stream chunk error, triggering direct save:', err);

      // Direct binary save trigger for CORS-restricted streams (e.g. savenow.to CDN)
      // downloadUrl is the actual MP4/MP3 binary URL, NOT a social media webpage!
      try {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = task.filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 1500);

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: 'completed',
                  progress: 100,
                  speed: 0,
                  downloadedBytes: t.totalBytes || 1024 * 1024 * 15,
                  completedAt: Date.now(),
                }
              : t
          )
        );
      } catch (fallbackErr) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: 'error',
                  error: err.message || 'Stream download interrupted',
                  speed: 0,
                }
              : t
          )
        );
      }
    }
  }, []);

  const pauseDownload = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
        controllersRef.current.delete(id);
      }
      sendAction({ type: 'PAUSE_DOWNLOAD', id });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'paused', speed: 0 } : t)));
    },
    [sendAction]
  );

  const resumeDownload = useCallback(
    (id: string) => {
      sendAction({ type: 'RESUME_DOWNLOAD', id });
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (task && (isWebOnly || !isConnected)) {
          executeBrowserStream(task, task.downloadedBytes);
        }
        return prev.map((t) => (t.id === id ? { ...t, status: 'downloading' } : t));
      });
    },
    [sendAction, isWebOnly, isConnected, executeBrowserStream]
  );

  const deleteDownload = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
        controllersRef.current.delete(id);
      }
      chunksRef.current.delete(id);

      sendAction({ type: 'DELETE_DOWNLOAD', id });
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (task?.blobUrl) {
          try {
            URL.revokeObjectURL(task.blobUrl);
          } catch (e) {}
        }
        return prev.filter((t) => t.id !== id);
      });
    },
    [sendAction]
  );

  // In-Browser direct download trigger for Vercel/Web-only mode
  const addBrowserDownload = useCallback(
    (taskData: Partial<DownloadTaskData>) => {
      const taskId = 'web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const cleanFilename = taskData.filename || 'download.bin';

      const initialChunks: ChunkInfo[] = Array.from({ length: 8 }, (_, i) => ({
        index: i,
        startByte: 0,
        endByte: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        status: 'downloading',
        speed: 0,
      }));

      const newTask: DownloadTaskData = {
        id: taskId,
        url: taskData.url || '',
        streamUrl: taskData.streamUrl,
        originalUrl: taskData.originalUrl || taskData.url,
        filename: cleanFilename,
        savePath: cleanFilename,
        totalBytes: taskData.totalBytes || 0,
        downloadedBytes: 0,
        speed: 0,
        status: 'downloading',
        category: taskData.category || (taskData.audioOnly ? 'audio' : taskData.isMediaStream ? 'video' : 'other'),
        progress: 0,
        eta: 0,
        connections: taskData.connections || 16,
        chunks: initialChunks,
        createdAt: Date.now(),
        thumbnail: taskData.thumbnail,
        qualityLabel: taskData.qualityLabel,
        audioOnly: taskData.audioOnly,
        isMediaStream: taskData.isMediaStream,
      };

      setTasks((prev) => [newTask, ...prev]);

      // Launch streaming download
      executeBrowserStream(newTask, 0);
    },
    [executeBrowserStream]
  );

  return {
    tasks,
    isConnected,
    isWebOnly,
    totalSpeed,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    addBrowserDownload,
  };
}
