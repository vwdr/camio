// Simple shared MediaStream manager for local cameras.
// Keeps a reference count so multiple UI pieces can attach the same stream.

type Entry = {
  stream: MediaStream;
  count: number;
};

declare global {
  interface Window { __camio_streams?: Record<string, Entry>; }
}

export async function acquireStream(cameraId: string, constraints: MediaStreamConstraints = { video: true, audio: false }): Promise<MediaStream> {
  if (!window.__camio_streams) window.__camio_streams = {};
  const existing = window.__camio_streams[cameraId];
  if (existing && existing.stream) {
    existing.count += 1;
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
    try {
      entry.stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      // ignore
    }
    delete window.__camio_streams[cameraId];
  }
}

export function getExistingStream(cameraId: string): MediaStream | undefined {
  return window.__camio_streams?.[cameraId]?.stream;
}
