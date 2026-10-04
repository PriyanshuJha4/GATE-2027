// Tiny IndexedDB wrapper. This is the PHONE-SIDE permanent copy:
//   files  : key "<batchId>|<original path>"  -> { blob, size }        (PDFs, screenshots, card images)
//   tables : key table name                   -> { columns, rows }     (cards, error_logs, pdfs, ...)
//   meta   : key string                       -> any                   (currentBatch, deviceId, lastSync, dirty ...)

const DB_NAME = "gate-offline";
const DB_VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of ["files", "tables", "meta"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error("IndexedDB transaction aborted (storage full?)"));
  });
}
const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function idbGet<T = any>(store: "files" | "tables" | "meta", key: string): Promise<T | undefined> {
  const d = await open();
  return req(d.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
}
export async function idbPut(store: "files" | "tables" | "meta", key: string, value: any): Promise<void> {
  const d = await open();
  const tx = d.transaction(store, "readwrite");
  tx.objectStore(store).put(value, key);
  await done(tx);
}
export async function idbPutMany(store: "tables" | "meta", entries: [string, any][]): Promise<void> {
  const d = await open();
  const tx = d.transaction(store, "readwrite");
  for (const [k, v] of entries) tx.objectStore(store).put(v, k);
  await done(tx);
}
export async function idbKeys(store: "files" | "tables" | "meta"): Promise<string[]> {
  const d = await open();
  return (await req(d.transaction(store).objectStore(store).getAllKeys())).map(String);
}
export async function idbDeleteKeys(store: "files" | "tables" | "meta", keys: string[]): Promise<void> {
  if (!keys.length) return;
  const d = await open();
  const tx = d.transaction(store, "readwrite");
  for (const k of keys) tx.objectStore(store).delete(k);
  await done(tx);
}

/** Asks the browser not to evict this data when the phone is low on space. Installed PWAs are usually granted it. */
export async function requestPersistence(): Promise<{ persisted: boolean; usageMB: number; quotaMB: number }> {
  let persisted = false, usage = 0, quota = 0;
  try { if (navigator.storage?.persisted) persisted = await navigator.storage.persisted(); } catch {}
  try { if (!persisted && navigator.storage?.persist) persisted = await navigator.storage.persist(); } catch {}
  try { const e = await navigator.storage?.estimate?.(); usage = e?.usage || 0; quota = e?.quota || 0; } catch {}
  return { persisted, usageMB: Math.round(usage / 1048576), quotaMB: Math.round(quota / 1048576) };
}
