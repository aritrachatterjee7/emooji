// src/hooks/useVoice.js
// Handles voice input (SpeechRecognition) and voice output (SpeechSynthesis)
// Works on Chrome, Edge, Android Chrome, iOS Safari 15.4+

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Detect support ─────────────────────────────────────────────────────────
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export function useVoice({ onTranscript, onSpeakStart, onSpeakEnd }) {
  const [isListening,  setIsListening]  = useState(false);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // TTS on/off
  const [supported,    setSupported]    = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef   = useRef(null);

  useEffect(() => {
    setSupported(!!SpeechRecognition && !!synth);
  }, []);

  // ── Start voice input ──────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;

    // Stop any ongoing TTS first
    if (synth) synth.cancel();

    const recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = 'en-US';
    recognitionRef.current      = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interim = '';
      let final   = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      // Pass interim result for live display, final for sending
      if (onTranscript) onTranscript(final || interim, !!final);
    };

    recognition.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [onTranscript]);

  // ── Stop voice input ───────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ── Speak text (TTS) ───────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!synth || !voiceEnabled || !text) return;

    // Cancel any ongoing speech
    synth.cancel();

    // Clean markdown from text before speaking
    const clean = text
      .replace(/#{1,6}\s/g, '')           // headers
      .replace(/\*\*(.*?)\*\*/g, '$1')    // bold
      .replace(/\*(.*?)\*/g, '$1')        // italic
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // code
      .replace(/\n·\s/g, '. ')            // bullets
      .replace(/\n/g, '. ')              // newlines
      .replace(/\.{2,}/g, '.')           // multiple dots
      .trim();

    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utteranceRef.current = utterance;

    // Pick best available voice
    const voices = synth.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && v.name.includes('Google')
    ) || voices.find(v =>
      v.lang.startsWith('en')
    ) || voices[0];

    if (preferred) utterance.voice = preferred;
    utterance.rate   = 1.0;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (onSpeakStart) onSpeakStart();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onSpeakEnd) onSpeakEnd();
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    // Small delay for iOS Safari
    setTimeout(() => synth.speak(utterance), 100);
  }, [voiceEnabled, onSpeakStart, onSpeakEnd]);

  // ── Stop speaking ──────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (synth) synth.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, []);

  // ── Toggle TTS on/off ──────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (isSpeaking) stopSpeaking();
    setVoiceEnabled(prev => !prev);
  }, [isSpeaking, stopSpeaking]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synth) synth.cancel();
    };
  }, []);

  return {
    supported,
    isListening,
    isSpeaking,
    voiceEnabled,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleVoice,
  };
}