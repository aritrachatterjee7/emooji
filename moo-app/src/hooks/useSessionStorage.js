// src/hooks/useSessionStorage.js
// Manages chat session persistence:
// - Unauthenticated: saves to localStorage
// - Authenticated: saves to PostgreSQL via proxy API
// - On sign-in: migrates localStorage sessions to PostgreSQL

const PROXY_BASE   = '';
const LOCAL_KEY    = 'emooji_sessions';
const MAX_LOCAL    = 20; // max sessions in localStorage

// ── Local storage helpers ──────────────────────────────────────────────────
function getLocalSessions() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sessions));
  } catch {}
}

function generateId() {
  return 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function autoTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  return first?.content?.slice(0, 60) || 'New Chat';
}

// ── Save session locally ───────────────────────────────────────────────────
export function saveLocalSession(messages, polygon, fieldStats) {
  if (!messages || messages.length === 0) return null;
  const sessions = getLocalSessions();
  const session = {
    id:          generateId(),
    title:       autoTitle(messages),
    messages,
    polygon:     polygon || null,
    field_stats: fieldStats || null,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
    local:       true,
  };
  // Prepend and limit
  const updated = [session, ...sessions].slice(0, MAX_LOCAL);
  saveLocalSessions(updated);
  return session.id;
}

// ── Get all local sessions ─────────────────────────────────────────────────
export function getLocalSessionList() {
  return getLocalSessions();
}

// ── Delete local session ───────────────────────────────────────────────────
export function deleteLocalSession(id) {
  const sessions = getLocalSessions().filter(s => s.id !== id);
  saveLocalSessions(sessions);
}

// ── Get single local session ───────────────────────────────────────────────
export function getLocalSession(id) {
  return getLocalSessions().find(s => s.id === id) || null;
}

// ── Save session to PostgreSQL ─────────────────────────────────────────────
export async function saveRemoteSession(userId, messages, polygon, fieldStats) {
  if (!userId || !messages || messages.length === 0) return null;
  try {
    const res = await fetch(`${PROXY_BASE}/api/sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({
        messages,
        polygon:    polygon || null,
        fieldStats: fieldStats || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch (e) {
    console.error('Remote save failed:', e);
  }
  return null;
}

// ── Get all remote sessions ────────────────────────────────────────────────
export async function getRemoteSessions(userId) {
  if (!userId) return [];
  try {
    const res = await fetch(`${PROXY_BASE}/api/sessions`, {
      headers: { 'X-User-Id': userId },
    });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

// ── Get single remote session ──────────────────────────────────────────────
export async function getRemoteSession(userId, sessionId) {
  try {
    const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}`, {
      headers: { 'X-User-Id': userId },
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// ── Delete remote session ──────────────────────────────────────────────────
export async function deleteRemoteSession(userId, sessionId) {
  try {
    await fetch(`${PROXY_BASE}/api/sessions/${sessionId}`, {
      method:  'DELETE',
      headers: { 'X-User-Id': userId },
    });
  } catch {}
}

// ── Migrate local sessions to PostgreSQL on sign-in ───────────────────────
export async function migrateLocalToRemote(userId) {
  const locals = getLocalSessions();
  if (locals.length === 0) return;

  for (const session of locals) {
    try {
      await fetch(`${PROXY_BASE}/api/sessions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          messages:   session.messages,
          polygon:    session.polygon,
          fieldStats: session.field_stats,
          title:      session.title,
        }),
      });
    } catch {}
  }

  // Clear local after migration
  saveLocalSessions([]);
  console.log(`Migrated ${locals.length} local sessions to PostgreSQL`);
}

// ── Upsert remote session (create or update) ───────────────────────────────
// Returns the session ID. Pass existingId to update, omit to create new.
export async function upsertRemoteSession(userId, messages, polygon, fieldStats, existingId = null) {
  if (!userId || !messages || messages.length === 0) return null;
  try {
    if (existingId) {
      // Update existing session
      const res = await fetch(`${PROXY_BASE}/api/sessions/${existingId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ messages, polygon: polygon || null, fieldStats: fieldStats || null }),
      });
      if (res.ok) return existingId;
    }
    // Create new session
    return await saveRemoteSession(userId, messages, polygon, fieldStats);
  } catch (e) {
    console.error('Upsert failed:', e);
    return null;
  }
}

// ── Upsert local session (create or update) ────────────────────────────────
export function upsertLocalSession(messages, polygon, fieldStats, existingId = null) {
  if (!messages || messages.length === 0) return null;
  const sessions = getLocalSessions();

  if (existingId) {
    const idx = sessions.findIndex(s => s.id === existingId);
    if (idx !== -1) {
      sessions[idx] = {
        ...sessions[idx],
        messages,
        polygon:     polygon || null,
        field_stats: fieldStats || null,
        updated_at:  new Date().toISOString(),
      };
      saveLocalSessions(sessions);
      return existingId;
    }
  }

  // Create new
  return saveLocalSession(messages, polygon, fieldStats);
}