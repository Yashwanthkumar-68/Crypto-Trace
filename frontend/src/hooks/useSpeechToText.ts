import { useState, useEffect, useRef, useCallback } from 'react';

// SpeechRecognition type declarations for browsers
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
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
    continuous = false,
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
  const latestTranscriptRef = useRef<string>('');

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const onSpeechFinalRef = useRef(onSpeechFinal);
  onSpeechFinalRef.current = onSpeechFinal;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Preload speech synthesis voices immediately on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Check SpeechRecognition support on mount
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
          let currentTranscript = '';
          let isFinalResult = false;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinalResult = true;
            }
          }

          const trimmed = currentTranscript.trim();
          latestTranscriptRef.current = trimmed;
          setTranscript(trimmed);
          if (onResultRef.current) onResultRef.current(trimmed);

          // Clear previous silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // If silence detected or browser marks result as final
          if (trimmed.length > 0) {
            silenceTimerRef.current = setTimeout(() => {
              const textToEmit = latestTranscriptRef.current.trim();
              if (textToEmit.length > 0 && onSpeechFinalRef.current) {
                // Reset so the same phrase is not processed repeatedly
                latestTranscriptRef.current = '';
                setTranscript('');
                onSpeechFinalRef.current(textToEmit);
              }
            }, isFinalResult ? 700 : 1200);
          }
        };

        recognition.onerror = (event: any) => {
          // 'no-speech' is a normal timeout when user is silent
          if (event.error !== 'no-speech') {
            console.warn('[SpeechToText] recognition error:', event.error);
          }
          setIsListening(false);
          stopWaveform();
          if (onError) onError(event);
        };

        recognition.onend = () => {
          setIsListening(false);
          stopWaveform();
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
    if (!recognitionRef.current) return;
    try {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      latestTranscriptRef.current = '';
      setTranscript('');
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
    } catch (e) {
      // In case it's already active, ignore or restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.lang = lang;
            recognitionRef.current.start();
          } catch (err) {}
        }, 150);
      } catch (err) {}
    }
  }, [lang]);

  const stopListening = useCallback(() => {
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

  // Text-To-Speech (Virtual Police Officer Voice)
  const speak = useCallback((text: string, voiceLang: string = lang, onFinish?: () => void) => {
    if (!('speechSynthesis' in window)) {
      if (onFinish) onFinish();
      return;
    }
    try {
      window.speechSynthesis.cancel(); // Stop prior speech immediately

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 1.05; // Slightly faster, natural pacing
      utterance.pitch = 1.0;

      // Select high quality voice if available
      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find(v => v.lang === voiceLang || v.lang.startsWith(voiceLang.slice(0, 2)));
      if (matchVoice) {
        utterance.voice = matchVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onFinish) onFinish();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (onFinish) onFinish();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SpeechSynthesis] Failed to speak:', err);
      setIsSpeaking(false);
      if (onFinish) onFinish();
    }
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
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
