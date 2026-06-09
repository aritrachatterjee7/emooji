// src/hooks/useSessionStorage.js
// Session persistence using sessions_full table for all users

const LOCAL_KEY = 'emooji_local_sessions'; // tracks anonymous session IDs
const MAX_LOCAL = 20;

// ── Track anonymous session IDs in localStorage ───────────────────────────
function getLocalSessionIds() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch { return []; }
}

function addLocalSessionId(id) {
  try {
    const ids = [id, ...getLocalSessionIds().filter(i => i !== id)].slice(0, MAX_LOCAL);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {}
}

function removeLocalSessionId(id) {
  try {
    const ids = getLocalSessionIds().filter(i => i !== id);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {}
}

// ── Remote sessions via sessions_full API ─────────────────────────────────

export async function getRemoteSessions(userId) {
  try {
    const res = await fetch('/api/sessions-full', {
      headers: userId ? { 'X-User-Id': userId } : {},
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function getAnonymousSessions() {
  try {
    const ids = getLocalSessionIds();
    if (ids.length === 0) return [];
    const res = await fetch(`/api/sessions-full?ids=${ids.join(',')}`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function getRemoteSession(sessionId) {
  try {
    const res = await fetch(`/api/sessions-full/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function deleteRemoteSession(sessionId, userId) {
  try {
    await fetch(`/api/sessions-full/${sessionId}`, { method: 'DELETE' });
    removeLocalSessionId(sessionId);
  } catch {}
}

// ── Init new session in DB, returns UUID ──────────────────────────────────
export async function initRemoteSession(userId) {
  try {
    const res = await fetch('/api/sessions-full/init', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!userId) addLocalSessionId(data.id); // track anonymous sessions
    return data.id;
  } catch { return null; }
}

// ── Called when session ID is known (anonymous tracking) ─────────────────
export function trackSessionId(id) {
  addLocalSessionId(id);
}

// ── Migrate anonymous sessions to signed-in user ─────────────────────────
export async function migrateLocalToRemote(userId) {
  // Sessions are already in DB — just update their user_id
  // This is handled automatically by the stream endpoint going forward
  // For existing anonymous sessions, we can't retroactively assign them
  // so just clear the local ID list
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {}
}

// ── Legacy exports for backwards compatibility ────────────────────────────
// These are no-ops since sessions_full handles everything server-side

export function getLocalSessionList() { return []; }
export function getLocalSession()     { return null; }
export function deleteLocalSession()  {}
export function saveLocalSession()    { return null; }

export function upsertLocalSession(messages, polygon, fieldStats, existingId) {
  // No-op — sessions_full handles this via stream endpoint
  return existingId || null;
}

export async function upsertRemoteSession(userId, messages, polygon, fieldStats, existingId) {
  // No-op — sessions_full is updated by proxy stream endpoint directly
  // Just return the existing ID so sessionIdRef stays set
  return existingId || null;
}