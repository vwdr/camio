"use client";

import { useEffect, useState } from 'react';
import { getRecordings } from '@/lib/recordings';
import { getTimeline } from '@/lib/timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RecordingItem {
  cameraId: string;
  blobUrl?: string;
  dataUrl?: string;
  timestamp?: string;
  thumbnailUrl?: string;
}

export default function RecordingsPage() {
  const [items, setItems] = useState<RecordingItem[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        // Gather camera IDs from timeline entries first
        const cameras = new Set<string>();
        // naive scan of all localStorage keys for timeline entries
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || '';
          if (key.startsWith('camio:timeline:')) {
            const camId = key.replace('camio:timeline:', '');
            cameras.add(camId);
          }
        }

        const results: RecordingItem[] = [];
        for (const camId of Array.from(cameras)) {
          try {
            const blobs = await getRecordings(camId);
            if (Array.isArray(blobs) && blobs.length > 0) {
              const url = URL.createObjectURL(blobs[0]);
              results.push({ cameraId: camId, blobUrl: url, timestamp: new Date().toISOString() });
              continue;
            }
          } catch (e) {
            // ignore
          }
          // fallback to localStorage dataURL recordings
          try {
            const raw = localStorage.getItem(`camio:recordings:${camId}`);
            const arr = raw ? JSON.parse(raw) as string[] : [];
            if (arr && arr.length) {
              results.push({ cameraId: camId, dataUrl: arr[0], timestamp: new Date().toISOString() });
            }
          } catch (e) {}
        }

        // also surface timeline thumbnails
        for (const camId of Array.from(cameras)) {
          const timeline = getTimeline(camId);
          if (timeline && timeline.length) {
            const t = timeline.find((x) => x.thumbnailUrl);
            if (t) results.push({ cameraId: camId, thumbnailUrl: t.thumbnailUrl, timestamp: t.timestamp });
          }
        }

        setItems(results);
      } catch (e) {
        console.error('Failed to load recordings', e);
      }
    };
    loadAll();

    const onRec = () => loadAll();
    window.addEventListener('camio:recordings:updated', onRec as EventListener);
    window.addEventListener('camio:timeline:updated', onRec as EventListener);
    return () => {
      window.removeEventListener('camio:recordings:updated', onRec as EventListener);
      window.removeEventListener('camio:timeline:updated', onRec as EventListener);
    };
  }, []);

  const download = (url?: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `clip-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Suspect Clips & Timeline Thumbnails</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground">No suspect clips found yet.</div>
        )}
        {items.map((it, idx) => (
          <Card key={`${it.cameraId}-${idx}`}>
            <CardHeader>
              <CardTitle className="text-sm">Camera: {it.cameraId}</CardTitle>
            </CardHeader>
            <CardContent>
              {it.blobUrl && (
                <div className="mb-2">
                  <video src={it.blobUrl} controls className="w-full h-40 object-cover" />
                </div>
              )}
              {it.dataUrl && (
                <div className="mb-2">
                  <video src={it.dataUrl} controls className="w-full h-40 object-cover" />
                </div>
              )}
              {it.thumbnailUrl && !it.blobUrl && (
                <img src={it.thumbnailUrl} alt="thumb" className="w-full h-40 object-cover mb-2" />
              )}
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{it.timestamp}</div>
                <div className="flex items-center gap-2">
                  {it.blobUrl && <Button size="sm" onClick={() => download(it.blobUrl)}>Download</Button>}
                  {it.dataUrl && <Button size="sm" onClick={() => download(it.dataUrl)}>Download</Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
