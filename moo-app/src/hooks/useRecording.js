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