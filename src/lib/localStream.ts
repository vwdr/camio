// Simple shared MediaStream manager for local cameras.
// Keeps a reference count so multiple UI pieces can attach the same stream.

type Entry = {
  stream: MediaStream;
  count: number;
  pendingRelease?: number;
};

declare global {
  interface Window { __camio_streams?: Record<string, Entry>; }
}

export async function acquireStream(cameraId: string, constraints: MediaStreamConstraints = { video: true, audio: false }): Promise<MediaStream> {
  if (!window.__camio_streams) window.__camio_streams = {};
  const existing = window.__camio_streams[cameraId];
  if (existing && existing.stream) {
    existing.count += 1;
    // If there was a pending release, cancel it because someone re-acquired quickly
    if (existing.pendingRelease) {
      clearTimeout(existing.pendingRelease);
      delete existing.pendingRelease;
    }
    return existing.stream;
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  window.__camio_streams[cameraId] = { stream, count: 1 };
  return stream;
}

export function releaseStream(cameraId: string) {
  if (!window.__camio_streams) return;
  const entry = window.__camio_streams[cameraId];
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) {
    // Delay actually stopping the tracks to avoid flapping when components mount/unmount quickly
    try {
      if (entry.pendingRelease) clearTimeout(entry.pendingRelease);
    } catch (e) {}
    entry.pendingRelease = window.setTimeout(() => {
      try {
        entry.stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        // ignore
      }
      try { if (window.__camio_streams && window.__camio_streams[cameraId]) delete window.__camio_streams[cameraId]; } catch (e) {}
    }, 1500) as unknown as number;
  }
}

export function getExistingStream(cameraId: string): MediaStream | undefined {
  return window.__camio_streams?.[cameraId]?.stream;
}

// Attach existing or newly-acquired stream to a video element and attempt to play.
// Returns true if this call caused a new acquire (the caller should release if appropriate).
export async function attachStreamToElement(videoEl: HTMLVideoElement, cameraId: string, constraints: MediaStreamConstraints = { video: true, audio: false }): Promise<boolean> {
  if (!videoEl) return false;
  const existing = getExistingStream(cameraId);
  if (existing) {
    try {
      videoEl.srcObject = existing;
      try { await videoEl.play(); } catch (e) { /* ignore */ }
    } catch (e) {
      console.warn('Failed to attach existing stream to video element', e);
    }
    return false;
  }

  // No existing stream — acquire one and attach
  try {
    const stream = await acquireStream(cameraId, constraints);
    videoEl.srcObject = stream;
    try { await videoEl.play(); } catch (e) { /* ignore */ }
    return true;
  } catch (e) {
    console.warn('Failed to acquire stream for video element', e);
    return false;
  }
}
