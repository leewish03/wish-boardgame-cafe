import { useState, useEffect, useRef, useCallback } from 'react';

export function useSTT(socket, roomCode, userId) {
  const [isSTTEnabled, setIsSTTEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState([]); // [{ id, userId, text, timestamp }]
  const [activeBubbles, setActiveBubbles] = useState({}); // userId -> { text, timestamp }

  const recognitionRef = useRef(null);

  // Initialize Speech Recognition safely
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart if user still has STT enabled
        if (recognitionRef.current && isSTTEnabled) {
          try {
            recognition.start();
          } catch (e) {
            // ignore already started error
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('STT Error:', event.error);
        if (event.error === 'not-allowed') {
          setIsSTTEnabled(false);
        }
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        const trimmed = finalTranscript.trim();
        if (trimmed && socket && roomCode) {
          socket.emit('stt:transcript', {
            roomCode,
            userId,
            text: trimmed,
            timestamp: Date.now(),
          });
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [socket, roomCode, userId, isSTTEnabled]);

  // Toggle STT listening
  const toggleSTT = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isSTTEnabled) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsSTTEnabled(false);
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsSTTEnabled(true);
      } catch (e) {
        console.warn('STT Start Error:', e);
      }
    }
  }, [isSTTEnabled]);

  // Socket listener for incoming transcripts
  useEffect(() => {
    if (!socket) return;

    const handleTranscript = (data) => {
      const { userId: speakerId, text, timestamp } = data || {};
      if (!text) return;

      const item = {
        id: `stt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        userId: speakerId,
        text,
        timestamp: timestamp || Date.now(),
      };

      setTranscripts((prev) => [...prev.slice(-49), item]);

      // Set active bubble for floating overlay
      setActiveBubbles((prev) => ({
        ...prev,
        [speakerId]: { text, timestamp: Date.now() },
      }));
    };

    socket.on('stt:transcript', handleTranscript);

    return () => {
      socket.off('stt:transcript', handleTranscript);
    };
  }, [socket]);

  // Clean expired floating speech bubbles every 1s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveBubbles((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([uid, bubble]) => {
          if (now - bubble.timestamp > 3500) {
            delete next[uid];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    isSTTEnabled,
    isListening,
    transcripts,
    activeBubbles,
    toggleSTT,
  };
}
