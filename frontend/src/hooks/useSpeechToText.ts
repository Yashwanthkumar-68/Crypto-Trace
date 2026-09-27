import { useState, useEffect, useRef, useCallback } from 'react';

// SpeechRecognition type declarations for browsers
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    __cryptoTraceUtterance?: any;
  }
}

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  onResult?: (transcript: string) => void;
  onSpeechFinal?: (finalTranscript: string) => void;
  onError?: (error: any) => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const {
    lang = 'en-IN',
    continuous = true,
    onResult,
    onSpeechFinal,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const speechWatchdogRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const shouldBeListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const onSpeechFinalRef = useRef(onSpeechFinal);
  onSpeechFinalRef.current = onSpeechFinal;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Preload speech synthesis voices immediately on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            window.speechSynthesis.getVoices();
          } catch (e) {}
        };
      } catch (e) {}
    }
  }, []);

  // Initialize SpeechRecognition on mount & when lang changes
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onstart = () => {
          setIsListening(true);
          simulateWaveform();
        };

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          let isFinalResult = false;

          // Assemble the complete transcript across all results in this session
          for (let i = 0; i < event.results.length; i++) {
            const piece = event.results[i][0]?.transcript || '';
            fullTranscript += piece + ' ';
            if (event.results[i].isFinal) {
              isFinalResult = true;
            }
          }

          const trimmed = fullTranscript.trim();
          if (trimmed.length > 0) {
            latestTranscriptRef.current = trimmed;
            setTranscript(trimmed);
            if (onResultRef.current) onResultRef.current(trimmed);

            // Clear previous silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }

            // Auto-advance after silence (800ms for final, 1200ms for interim)
            silenceTimerRef.current = setTimeout(() => {
              const textToEmit = latestTranscriptRef.current.trim();
              if (textToEmit.length > 0 && onSpeechFinalRef.current) {
                latestTranscriptRef.current = '';
                setTranscript('');
                onSpeechFinalRef.current(textToEmit);
              }
            }, isFinalResult ? 800 : 1200);
          }
        };

        recognition.onerror = (event: any) => {
          // 'no-speech' is a normal timeout when the user is silent
          if (event.error !== 'no-speech') {
            console.warn('[SpeechToText] recognition error:', event.error);
          }
          if (event.error === 'not-allowed') {
            shouldBeListeningRef.current = false;
            setIsListening(false);
            stopWaveform();
          }
          if (onErrorRef.current) onErrorRef.current(event);
        };

        recognition.onend = () => {
          stopWaveform();
          // In Chrome, recognition stops automatically after silence.
          // If we should still be listening and we're not speaking, restart it!
          if (shouldBeListeningRef.current && !isSpeakingRef.current) {
            try {
              recognition.start();
              setIsListening(true);
              simulateWaveform();
            } catch (e) {
              // Might already be active
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('[SpeechToText] Failed to initialize recognition:', err);
        setIsSupported(false);
      }
    } else {
      setIsSupported(false);
    }

    return () => {
      shouldBeListeningRef.current = false;
      stopWaveform();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [lang, continuous]);

  // Waveform level simulator during listening
  const simulateWaveform = () => {
    let t = 0;
    const loop = () => {
      t += 0.2;
      const val = Math.min(100, Math.max(15, Math.floor(Math.sin(t) * 35 + Math.random() * 45 + 30)));
      setAudioLevel(val);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const stopWaveform = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  };

  const startListening = useCallback(() => {
    shouldBeListeningRef.current = true;
    if (!recognitionRef.current) return;
    try {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      latestTranscriptRef.current = '';
      setTranscript('');
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setIsListening(true);
      simulateWaveform();
    } catch (e) {
      // In case it's already active, ignore or restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            if (shouldBeListeningRef.current) {
              recognitionRef.current.lang = lang;
              recognitionRef.current.start();
              setIsListening(true);
              simulateWaveform();
            }
          } catch (err) {}
        }, 150);
      } catch (err) {}
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
    setIsListening(false);
    stopWaveform();
  }, []);

  const resetTranscript = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    latestTranscriptRef.current = '';
    setTranscript('');
  }, []);

  // Text-To-Speech (Virtual Police Officer Voice) with Chrome GC protection and watchdog
  const speak = useCallback((text: string, voiceLang: string = lang, onFinish?: () => void) => {
    if (!('speechSynthesis' in window)) {
      if (onFinish) onFinish();
      return;
    }

    try {
      // Cancel previous speech and resume if paused
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      if (speechWatchdogRef.current) {
        clearTimeout(speechWatchdogRef.current);
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Select matching voice
      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find(v => v.lang === voiceLang || v.lang.startsWith(voiceLang.slice(0, 2)));
      if (matchVoice) {
        utterance.voice = matchVoice;
      }

      // CRITICAL: Store utterance in ref AND window to prevent Chrome V8 Garbage Collection bug
      utteranceRef.current = utterance;
      window.__cryptoTraceUtterance = utterance;

      let hasFinished = false;
      const safeFinish = () => {
        if (hasFinished) return;
        hasFinished = true;
        if (speechWatchdogRef.current) clearTimeout(speechWatchdogRef.current);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        utteranceRef.current = null;
        if (onFinish) onFinish();
      };

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        safeFinish();
      };

      utterance.onerror = () => {
        safeFinish();
      };

      // Watchdog: If browser audio hangs or blocks autoplay, trigger safeFinish automatically!
      // ~70ms per character + 1500ms grace period, max 8 seconds
      const maxSpeechMs = Math.min(8000, Math.max(2000, text.length * 70 + 1500));
      speechWatchdogRef.current = setTimeout(() => {
        if (!hasFinished) {
          console.warn('[SpeechSynthesis] Watchdog timeout elapsed, resuming flow.');
          safeFinish();
        }
      }, maxSpeechMs);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SpeechSynthesis] Failed to speak:', err);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (onFinish) onFinish();
    }
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      utteranceRef.current = null;
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    isSupported,
    audioLevel,
    startListening,
    stopListening,
    resetTranscript,
    speak,
    stopSpeaking
  };
}
