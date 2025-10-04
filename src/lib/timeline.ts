// Simple localStorage-backed timeline helper for camera events
export interface TimelineEvent {
  id: string;
  timestamp: string; // ISO
  type: string;
  description: string;
  thumbnailUrl?: string;
  aiAnalysis?: string;
  severity: 'low' | 'medium' | 'high' | string;
}

const keyFor = (cameraId: string) => `camio:timeline:${cameraId}`;

export function getTimeline(cameraId: string): TimelineEvent[] {
  try {
    const raw = localStorage.getItem(keyFor(cameraId));
    const arr = raw ? JSON.parse(raw) as TimelineEvent[] : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

export function addTimelineEvent(cameraId: string, event: Omit<TimelineEvent, 'id' | 'timestamp'>) {
  try {
    const now = new Date().toISOString();
    const evt: TimelineEvent = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, timestamp: now, ...event };
    const existing = getTimeline(cameraId);
    existing.unshift(evt);
    localStorage.setItem(keyFor(cameraId), JSON.stringify(existing.slice(0, 200)));
    window.dispatchEvent(new CustomEvent('camio:timeline:updated', { detail: { cameraId } }));
    return evt;
  } catch (e) {
    console.error('Failed to add timeline event', e);
    return null;
  }
}
