import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC(socket, roomCode, userId) {
  const [localStream, setLocalStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState({}); // userId -> boolean

  const peerConnections = useRef({}); // peerUserId -> RTCPeerConnection
  const audioElements = useRef({}); // peerUserId -> HTMLAudioElement
  const vadAnalyserRef = useRef(null);
  const vadAnimFrameRef = useRef(null);

  // Initialize local microphone stream
  const initLocalAudio = useCallback(async () => {
    try {
      if (localStream) return localStream;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Default mute initially until user enables
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      setLocalStream(stream);
      setIsMicOn(false);

      // Setup VAD for local stream
      setupVAD(stream, userId);

      return stream;
    } catch (err) {
      console.warn('Microphone access not granted or unavailable:', err);
      return null;
    }
  }, [localStream, userId]);

  // Setup Voice Activity Detection (VAD)
  const setupVAD = (stream, targetUserId) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const isSpeaking = avg > 18; // VAD threshold

        setSpeakingUsers((prev) => {
          if (prev[targetUserId] === isSpeaking) return prev;
          return { ...prev, [targetUserId]: isSpeaking };
        });

        vadAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };

      vadAnalyserRef.current = analyser;
      vadAnimFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn('VAD Setup Error:', e);
    }
  };

  // Toggle Microphone
  const toggleMic = useCallback(async () => {
    let stream = localStream;
    if (!stream) {
      stream = await initLocalAudio();
    }
    if (!stream) return;

    const tracks = stream.getAudioTracks();
    if (tracks.length > 0) {
      const newState = !tracks[0].enabled;
      tracks[0].enabled = newState;
      setIsMicOn(newState);
    }
  }, [localStream, initLocalAudio]);

  // Toggle Speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      Object.values(audioElements.current).forEach((audio) => {
        if (audio) audio.muted = !next;
      });
      return next;
    });
  }, []);

  // WebRTC Signaling Handlers
  useEffect(() => {
    if (!socket || !roomCode || !userId) return;

    const createPeerConnection = (targetUserId, isInitiator) => {
      if (peerConnections.current[targetUserId]) {
        return peerConnections.current[targetUserId];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[targetUserId] = pc;

      // Add local tracks if available
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', {
            roomCode,
            fromUserId: userId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle Remote Stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        let audio = audioElements.current[targetUserId];
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.muted = !isSpeakerOn;
          audioElements.current[targetUserId] = audio;
        }
        audio.srcObject = remoteStream;

        // Attach VAD for remote peer
        setupVAD(remoteStream, targetUserId);
      };

      // If initiator, create and send offer
      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('webrtc:offer', {
              roomCode,
              fromUserId: userId,
              targetUserId,
              offer: pc.localDescription,
            });
          })
          .catch((err) => console.warn('WebRTC Offer Error:', err));
      }

      return pc;
    };

    const handlePeerJoined = ({ newUserId }) => {
      if (newUserId !== userId) {
        createPeerConnection(newUserId, true);
      }
    };

    const handleOffer = async ({ fromUserId, offer }) => {
      const pc = createPeerConnection(fromUserId, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          roomCode,
          fromUserId: userId,
          targetUserId: fromUserId,
          answer,
        });
      } catch (err) {
        console.warn('WebRTC Handle Offer Error:', err);
      }
    };

    const handleAnswer = async ({ fromUserId, answer }) => {
      const pc = peerConnections.current[fromUserId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.warn('WebRTC Handle Answer Error:', err);
        }
      }
    };

    const handleIceCandidate = async ({ fromUserId, candidate }) => {
      const pc = peerConnections.current[fromUserId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('WebRTC Handle ICE Error:', err);
        }
      }
    };

    const handlePeerLeft = ({ leftUserId }) => {
      const pc = peerConnections.current[leftUserId];
      if (pc) {
        pc.close();
        delete peerConnections.current[leftUserId];
      }
      const audio = audioElements.current[leftUserId];
      if (audio) {
        audio.srcObject = null;
        delete audioElements.current[leftUserId];
      }
      setSpeakingUsers((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        return next;
      });
    };

    socket.on('webrtc:peer-joined', handlePeerJoined);
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
    socket.on('webrtc:peer-left', handlePeerLeft);

    return () => {
      socket.off('webrtc:peer-joined', handlePeerJoined);
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('webrtc:peer-left', handlePeerLeft);
    };
  }, [socket, roomCode, userId, isSpeakerOn, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadAnimFrameRef.current) {
        cancelAnimationFrame(vadAnimFrameRef.current);
      }
      Object.values(peerConnections.current).forEach((pc) => pc && pc.close());
      Object.values(audioElements.current).forEach((audio) => {
        if (audio) audio.srcObject = null;
      });
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream]);

  return {
    localStream,
    isMicOn,
    isSpeakerOn,
    speakingUsers,
    toggleMic,
    toggleSpeaker,
    initLocalAudio,
  };
}
