/**
 * OfflineQueue — buffers Supabase writes when offline, replays when back online.
 * Uses IndexedDB for durable storage so data survives page reloads.
 * Wraps the session sync flush so no order data is ever lost.
 */

const DB_NAME = 'rpos-offline';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

let _db = null;
let _isOnline = navigator.onLine;
let _flushTimer = null;

// ── IndexedDB setup ───────────────────────────────────────────────────────────
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_table', 'table_id');
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Queue a write ─────────────────────────────────────────────────────────────
export async function queueWrite(op) {
  // op: { type: 'upsert' | 'delete', table: string, payload: object, match?: object }
  await dbAdd({ ...op, ts: Date.now() });
  if (_isOnline) scheduleFlush();
}

// ── Replay queue when back online ─────────────────────────────────────────────
let _replaying = false;

export async function replayQueue(supabase) {
  if (_replaying) return;
  _replaying = true;

  try {
    const items = await dbGetAll();
    if (!items.length) { _replaying = false; return; }

    console.log(`[OfflineQueue] Replaying ${items.length} queued write(s)`);

    for (const item of items) {
      try {
        if (item.type === 'upsert') {
          const { error } = await supabase
            .from(item.table)
            .upsert(item.payload, { onConflict: item.onConflict || 'id' });
          if (error) throw error;
        } else if (item.type === 'delete') {
          let q = supabase.from(item.table).delete();
          for (const [k, v] of Object.entries(item.match || {})) q = q.eq(k, v);
          const { error } = await q;
          if (error) throw error;
        }
        await dbDelete(item.id);
      } catch (e) {
        console.warn(`[OfflineQueue] Failed to replay item ${item.id}:`, e.message);
        // Leave in queue — will retry next time
        break;
      }
    }
  } finally {
    _replaying = false;
  }
}

// ── Online/offline listeners ──────────────────────────────────────────────────
let _supabaseRef = null;

function scheduleFlush() {
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    if (_supabaseRef) replayQueue(_supabaseRef);
  }, 1000);
}

export function initOfflineQueue(supabase) {
  _supabaseRef = supabase;

  window.addEventListener('online', () => {
    _isOnline = true;
    console.log('[OfflineQueue] Back online — replaying queued writes');
    replayQueue(supabase);
    // Notify UI
    window.dispatchEvent(new CustomEvent('rpos-online'));
  });

  window.addEventListener('offline', () => {
    _isOnline = false;
    console.log('[OfflineQueue] Gone offline — writes will be queued');
    window.dispatchEvent(new CustomEvent('rpos-offline'));
  });

  // Replay any pending items from previous session on startup
  if (_isOnline) {
    setTimeout(() => replayQueue(supabase), 3000);
  }
}

export function isOnline() { return _isOnline; }
export function getQueueSize() { return dbGetAll().then(items => items.length); }
