// Lightweight IndexedDB helper for storing camera recordings (Blob objects)
// Provides saveRecording, getRecordings, deleteRecordings

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('camio-recordings', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(cameraId: string, blob: Blob) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    const store = tx.objectStore('recordings');
    const getReq = store.get(cameraId);
    getReq.onsuccess = () => {
      const arr: Blob[] = Array.isArray(getReq.result) ? getReq.result : [];
      arr.unshift(blob);
      const toSave = arr.slice(0, 5);
      const putReq = store.put(toSave, cameraId);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getRecordings(cameraId: string): Promise<Blob[]> {
  const db = await openDB();
  return new Promise<Blob[]>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readonly');
    const store = tx.objectStore('recordings');
    const req = store.get(cameraId);
    req.onsuccess = () => {
      const res = req.result;
      resolve(Array.isArray(res) ? res as Blob[] : []);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteRecordings(cameraId: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    const store = tx.objectStore('recordings');
    const req = store.delete(cameraId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
