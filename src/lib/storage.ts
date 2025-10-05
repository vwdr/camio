/**
 * Cross-domain storage utility for Camio
 * Handles localStorage synchronization across different access methods (localhost, network IP, etc.)
 */

export interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  isRecording: boolean;
  isLocal: boolean;
  lastActivity: string;
  hasSecurity: boolean;
  thumbnailUrl?: string;
  registeredAt: string;
  token: string;
}

// Storage keys
const CAMERAS_KEY = 'camio:cameras';
const RECORDINGS_KEY_PREFIX = 'camio:recordings:';
const SYNC_KEY = 'camio:sync';

/**
 * Get the current host identifier (for cross-domain sync)
 */
function getHostId(): string {
  if (typeof window === 'undefined') return 'server';
  
  // Normalize host for sync purposes
  const host = window.location.host;
  
  // If it's localhost with different ports, treat as same
  if (host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) {
    return 'localhost';
  }
  
  // If it's a local network IP, extract base IP
  if (host.match(/^192\.168\.\d+\.\d+:/)) {
    return host.split(':')[0]; // Remove port
  }
  
  return host;
}

/**
 * Save cameras to localStorage with cross-domain sync info
 */
export function saveCameras(cameras: Camera[]): void {
  try {
    localStorage.setItem(CAMERAS_KEY, JSON.stringify(cameras));
    
    // Update sync metadata
    const syncData = {
      lastUpdated: new Date().toISOString(),
      hostId: getHostId(),
      cameraCount: cameras.length
    };
    localStorage.setItem(SYNC_KEY, JSON.stringify(syncData));
    
    // Dispatch update event
    window.dispatchEvent(new Event('camio:cameras:updated'));
  } catch (error) {
    console.error('Failed to save cameras:', error);
  }
}

/**
 * Load cameras from localStorage
 */
export function loadCameras(): Camera[] {
  try {
    const raw = localStorage.getItem(CAMERAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Failed to load cameras:', error);
    return [];
  }
}

/**
 * Add a new camera
 */
export function addCamera(camera: Omit<Camera, 'id' | 'registeredAt'>): Camera {
  const newCamera: Camera = {
    ...camera,
    id: `camio-${Math.random().toString(36).substring(2, 10)}`,
    registeredAt: new Date().toISOString(),
  };
  
  const cameras = loadCameras();
  cameras.unshift(newCamera);
  saveCameras(cameras);
  
  return newCamera;
}

/**
 * Update an existing camera
 */
export function updateCamera(id: string, updates: Partial<Camera>): boolean {
  const cameras = loadCameras();
  const index = cameras.findIndex(c => c.id === id);
  
  if (index === -1) return false;
  
  cameras[index] = { ...cameras[index], ...updates };
  saveCameras(cameras);
  
  return true;
}

/**
 * Delete a camera
 */
export function deleteCamera(id: string): boolean {
  const cameras = loadCameras();
  const filtered = cameras.filter(c => c.id !== id);
  
  if (filtered.length === cameras.length) return false;
  
  saveCameras(filtered);
  
  // Also clean up recordings
  try {
    localStorage.removeItem(`${RECORDINGS_KEY_PREFIX}${id}`);
  } catch (error) {
    console.error('Failed to clean up recordings:', error);
  }
  
  return true;
}

/**
 * Get sync status for debugging
 */
export function getSyncInfo() {
  try {
    const syncData = localStorage.getItem(SYNC_KEY);
    return syncData ? JSON.parse(syncData) : null;
  } catch (error) {
    console.error('Failed to get sync info:', error);
    return null;
  }
}

/**
 * Initialize default cameras if none exist (for demo purposes)
 */
export function initializeDefaultCameras(): void {
  const cameras = loadCameras();
  
  if (cameras.length === 0) {
    // Add some default cameras for demo
    const defaultCameras: Omit<Camera, 'id' | 'registeredAt'>[] = [
      {
        name: "Front Door",
        location: "Entry",
        status: "online",
        isRecording: true,
        isLocal: false,
        lastActivity: new Date().toISOString(),
        hasSecurity: true,
        token: "demo-front-door"
      },
      {
        name: "Backyard",
        location: "Garden", 
        status: "online",
        isRecording: false,
        isLocal: false,
        lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        hasSecurity: false,
        token: "demo-backyard"
      }
    ];
    
    defaultCameras.forEach(camera => addCamera(camera));
  }
}