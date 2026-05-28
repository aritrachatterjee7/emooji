// src/hooks/useRecording.js
// Records user sessions using rrweb — only during active send→response cycles.
// Stores recordings in localStorage alongside session data.

import { useRef, useCallback, useState } from 'react';

const MAX_RECORDINGS = 10; // max sessions to keep in localStorage
const STORAGE_KEY    = 'emooji_recordings';

// ── localStorage helpers ───────────────────────────────────────────────────
function getStoredRecordings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveStoredRecordings(recordings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
  } catch (e) {
    console.warn('Recording storage full, clearing old recordings');
    // Clear oldest half if storage is full
    try {
      const half = recordings.slice(Math.floor(recordings.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch {}
  }
}

export function getRecording(sessionId) {
  return getStoredRecordings().find(r => r.sessionId === sessionId) || null;
}

export function deleteRecording(sessionId) {
  const recordings = getStoredRecordings().filter(r => r.sessionId !== sessionId);
  saveStoredRecordings(recordings);
}

// ── Export recording as self-contained HTML file ───────────────────────────
export function exportRecordingAsHTML(sessionId, sessionTitle) {
  const recording = getStoredRecordings().find(r => r.sessionId === sessionId);
  if (!recording || !recording.clips || recording.clips.length === 0) {
    alert('No recording found for this session.');
    return;
  }

  // Merge all clips into one flat events array with gaps between clips
  const allEvents = [];
  let timeOffset = 0;

  recording.clips.forEach((clip, clipIdx) => {
    if (!clip.events || clip.events.length === 0) return;

    const firstTs = clip.events[0].timestamp;
    const lastTs  = clip.events[clip.events.length - 1].timestamp;
    const clipDuration = lastTs - firstTs;

    clip.events.forEach(event => {
      allEvents.push({
        ...event,
        timestamp: timeOffset + (event.timestamp - firstTs),
      });
    });

    // Add 1 second gap between clips
    timeOffset += clipDuration + 1000;
  });

  const eventsJson  = JSON.stringify(allEvents);
  const clipsInfo   = recording.clips.map((c, i) =>
    `<li><strong>Clip ${i + 1}:</strong> ${c.question || 'Question ' + (i+1)} — ${c.events?.length || 0} events</li>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>eMooJI Session Replay — ${sessionTitle || 'Session'}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/style.css"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #07090e; color: #e2e8f0; font-family: system-ui, sans-serif; }
    .header {
      background: #0f1a2e;
      border-bottom: 1px solid #1e3a5f;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-brand { font-size: 20px; font-weight: 700; }
    .header-brand span { color: #0bdb6e; }
    .header-meta { flex: 1; }
    .header-title { font-size: 14px; font-weight: 600; color: #e2e8f0; }
    .header-sub { font-size: 11px; color: #64748b; margin-top: 2px; font-family: monospace; }
    .clips-info {
      background: #0f1a2e;
      border-bottom: 1px solid #1e3a5f;
      padding: 12px 24px;
      font-size: 12px;
      color: #64748b;
    }
    .clips-info ul { list-style: none; display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
    .clips-info li { color: #94a3b8; }
    .clips-info li strong { color: #0bdb6e; }
    #player { width: 100%; height: calc(100vh - 120px); }
    .rr-player { width: 100% !important; }
    .rr-player__frame { width: 100% !important; }
    .error { padding: 40px; text-align: center; color: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">eMoo<span>JI</span></div>
    <div class="header-meta">
      <div class="header-title">${sessionTitle || 'Session Replay'}</div>
      <div class="header-sub">Recorded: ${recording.recordedAt ? new Date(recording.recordedAt).toLocaleString() : 'Unknown'} · ${recording.totalClips} clip${recording.totalClips !== 1 ? 's' : ''}</div>
    </div>
  </div>
  <div class="clips-info">
    <div style="font-size:11px;color:#475569;margin-bottom:4px">CLIPS IN THIS SESSION</div>
    <ul>${clipsInfo}</ul>
  </div>
  <div id="player"></div>
  <script src="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js"></script>
  <script>
    const events = ${eventsJson};
    if (!events || events.length === 0) {
      document.getElementById('player').innerHTML = '<div class="error">No events recorded in this session.</div>';
    } else {
      try {
        new rrwebPlayer({
          target: document.getElementById('player'),
          props: {
            events,
            autoPlay: false,
            showController: true,
            width: window.innerWidth,
            height: window.innerHeight - 120,
            skipInactive: true,
            speed: 1,
            speedOption: [1, 2, 4, 8],
          }
        });
      } catch(e) {
        document.getElementById('player').innerHTML = '<div class="error">Replay error: ' + e.message + '</div>';
      }
    }
  </script>
</body>
</html>`;

  // Trigger download
  const blob     = new Blob([html], { type: 'text/html' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `emooji-session-${sessionTitle?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || sessionId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useRecording() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);

  const stopFnRef      = useRef(null);   // rrweb stop function
  const clipsRef       = useRef([]);     // array of {question, events[]}
  const currentClip    = useRef(null);   // current clip being recorded
  const sessionIdRef   = useRef(null);   // current session ID
  const rrwebRef       = useRef(null);   // rrweb module (lazy loaded)

  // ── Lazy load rrweb ────────────────────────────────────────────────────
  const loadRRWeb = useCallback(async () => {
    if (rrwebRef.current) return rrwebRef.current;
    try {
      const rrweb = await import('rrweb');
      rrwebRef.current = rrweb;
      return rrweb;
    } catch (e) {
      console.error('rrweb load failed:', e);
      return null;
    }
  }, []);

  // ── Start a new session ────────────────────────────────────────────────
  const startSession = useCallback((sessionId) => {
    sessionIdRef.current = sessionId || `rec_${Date.now()}`;
    clipsRef.current     = [];
    currentClip.current  = null;
    setIsSessionActive(true);
    console.log('Recording session started:', sessionIdRef.current);
  }, []);

  // ── Start recording a single clip (called when user hits Send) ─────────
  const startClip = useCallback(async (questionText) => {
    if (!isSessionActive) return;
    if (stopFnRef.current) {
      // Stop any existing recording first
      stopFnRef.current();
      stopFnRef.current = null;
    }

    const rrweb = await loadRRWeb();
    if (!rrweb) return;

    const clip = { question: questionText, events: [], startedAt: Date.now() };
    currentClip.current = clip;
    setIsRecording(true);

    stopFnRef.current = rrweb.record({
      emit(event) {
        if (currentClip.current) {
          currentClip.current.events.push(event);
        }
      },
      // Mask sensitive inputs
      maskInputOptions: { password: true },
      // Don't record canvas (Leaflet map) for performance
      recordCanvas: false,
    });

    console.log('Clip recording started:', questionText?.slice(0, 40));
  }, [isSessionActive, loadRRWeb]);

  // ── Pause recording (called when response is received) ─────────────────
  const pauseClip = useCallback(() => {
    if (!stopFnRef.current) return;

    stopFnRef.current();
    stopFnRef.current = null;
    setIsRecording(false);

    if (currentClip.current && currentClip.current.events.length > 0) {
      currentClip.current.endedAt = Date.now();
      clipsRef.current.push({ ...currentClip.current });
      console.log('Clip saved:', currentClip.current.question?.slice(0, 40),
        '—', currentClip.current.events.length, 'events');
    }
    currentClip.current = null;
  }, []);

  // ── End session — stitch all clips and save to localStorage ────────────
  const endSession = useCallback((sessionId, sessionTitle) => {
    // Stop any active recording
    if (stopFnRef.current) {
      stopFnRef.current();
      stopFnRef.current = null;
    }
    if (currentClip.current && currentClip.current.events.length > 0) {
      currentClip.current.endedAt = Date.now();
      clipsRef.current.push({ ...currentClip.current });
    }

    // Use provided sessionId (chat UUID) or fall back to temp recording ID
    const finalSessionId = sessionId || sessionIdRef.current;
    if (!finalSessionId || clipsRef.current.length === 0) {
      console.log('No clips to save — session cancelled');
      setIsSessionActive(false);
      setIsRecording(false);
      return;
    }

    const recording = {
      sessionId:   finalSessionId,
      title:       sessionTitle || 'Session Recording',
      clips:       clipsRef.current,
      totalClips:  clipsRef.current.length,
      recordedAt:  new Date().toISOString(),
    };

    // Remove any existing recording with same ID or old temp ID
    const existing = getStoredRecordings().filter(
      r => r.sessionId !== finalSessionId && r.sessionId !== sessionIdRef.current
    );
    const updated = [recording, ...existing].slice(0, MAX_RECORDINGS);
    saveStoredRecordings(updated);

    console.log('Session recording saved:', finalSessionId,
      '—', clipsRef.current.length, 'clips');

    // Reset
    clipsRef.current     = [];
    currentClip.current  = null;
    sessionIdRef.current = null;
    setIsSessionActive(false);
    setIsRecording(false);
  }, []);

  // ── Cancel session without saving ──────────────────────────────────────
  const cancelSession = useCallback(() => {
    if (stopFnRef.current) {
      stopFnRef.current();
      stopFnRef.current = null;
    }
    clipsRef.current    = [];
    currentClip.current = null;
    sessionIdRef.current = null;
    setIsSessionActive(false);
    setIsRecording(false);
  }, []);

  return {
    isSessionActive,
    isRecording,
    sessionIdRef,
    startSession,
    startClip,
    pauseClip,
    endSession,
    cancelSession,
  };
}