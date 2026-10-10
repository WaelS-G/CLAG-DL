export type DownloadStatus = 
  | 'idle' 
  | 'fetching_meta' 
  | 'queued' 
  | 'downloading' 
  | 'paused' 
  | 'completed' 
  | 'error' 
  | 'merging';

export type DownloadCategory = 
  | 'all' 
  | 'video' 
  | 'audio' 
  | 'document' 
  | 'compressed' 
  | 'program' 
  | 'image' 
  | 'other';

export interface ChunkInfo {
  index: number;
  startByte: number;
  endByte: number;
  downloadedBytes: number;
  totalBytes: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  speed: number; // bytes/sec
}

export interface DownloadTaskData {
  id: string;
  url: string;
  originalUrl?: string;
  filename: string;
  savePath: string;
  totalBytes: number;
  downloadedBytes: number;
  speed: number; // bytes/sec
  status: DownloadStatus;
  category: DownloadCategory;
  progress: number; // 0 to 100
  eta: number; // seconds remaining
  connections: number; // 1 - 32
  chunks: ChunkInfo[];
  createdAt: number;
  completedAt?: number;
  error?: string;
  headers?: Record<string, string>;
  isMediaStream?: boolean;
  mediaFormat?: string;
  qualityLabel?: string;
  source?: string;
  audioOnly?: boolean;
  thumbnail?: string;
  downloadSubtitles?: boolean;
  subtitlesPath?: string;
  subtitlesTextPath?: string;
  subtitlesTimestampsPath?: string;
  subtitlesDir?: string;
  hasSubtitles?: boolean;
  subtitleLanguages?: string[];
  blobUrl?: string;
  streamUrl?: string;
}

export interface MediaFormatOption {
  formatId: string;
  ext: string;
  resolution?: string;
  fps?: number;
  filesize?: number;
  filesizeFormatted?: string;
  vcodec?: string;
  acodec?: string;
  qualityLabel?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  isBest?: boolean;
}

export interface PlaylistEntryItem {
  id?: string;
  url: string;
  title: string;
  duration?: number;
  durationFormatted?: string;
  thumbnail?: string;
}

export interface MediaProbeResult {
  url: string;
  title: string;
  uploader?: string;
  duration?: number;
  durationFormatted?: string;
  thumbnail?: string;
  formats: MediaFormatOption[];
  isStream: boolean;
  extractor: string; // e.g. "youtube", "tiktok", "generic"
  isPlaylist?: boolean;
  entryCount?: number;
  entries?: PlaylistEntryItem[];
  hasSubtitles?: boolean;
  subtitlesList?: string[];
}

export interface GrabberLinkItem {
  id: string;
  url: string;
  title: string;
  filename: string;
  filesize: number;
  category: DownloadCategory;
  selected: boolean;
  status: 'ready' | 'probing' | 'error';
  formats?: MediaFormatOption[];
  selectedFormatId?: string;
  qualityLabel?: string;
  audioOnly?: boolean;
  thumbnail?: string;
  error?: string;
}

export interface AppSettings {
  downloadDir: string;
  maxConcurrentDownloads: number;
  defaultConnections: number; // 1 - 32
  speedLimitKBps: number; // 0 for unlimited
  autoStartDownloads: boolean;
  clipboardMonitoring: boolean;
  theme: 'dark' | 'light' | 'system';
  enableSoundAlerts: boolean;
  clickNLoadEnabled: boolean;
  clickNLoadPort: number;
  apiPort: number;
  downloadSubtitles?: boolean;
  subtitlesFormat?: 'txt' | 'srt' | 'both';
  subtitleLanguages?: string[];
  subtitlesInSubfolder?: boolean;
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  diskFreeBytes: number;
  diskTotalBytes: number;
  activeDownloadsCount: number;
  totalSpeed: number;
}

export type WSClientMessage = 
  | { type: 'SUBSCRIBE' }
  | { type: 'PAUSE_DOWNLOAD'; id: string }
  | { type: 'RESUME_DOWNLOAD'; id: string }
  | { type: 'CANCEL_DOWNLOAD'; id: string }
  | { type: 'RETRY_DOWNLOAD'; id: string }
  | { type: 'DELETE_DOWNLOAD'; id: string; deleteFile?: boolean }
  | { type: 'START_GRABBER_ITEMS'; itemIds: string[] };

export type WSServerMessage = 
  | { type: 'DOWNLOAD_CREATED'; task: DownloadTaskData }
  | { type: 'DOWNLOAD_UPDATED'; task: DownloadTaskData }
  | { type: 'DOWNLOAD_PROGRESS'; id: string; downloadedBytes: number; speed: number; progress: number; eta: number; chunks: ChunkInfo[] }
  | { type: 'DOWNLOAD_STATUS_CHANGED'; id: string; status: DownloadStatus; error?: string }
  | { type: 'DOWNLOAD_DELETED'; id: string }
  | { type: 'STATS_UPDATE'; stats: SystemStats }
  | { type: 'CLIPBOARD_URL_DETECTED'; url: string; probeResult?: MediaProbeResult };
