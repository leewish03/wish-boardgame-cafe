import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function rtcConfiguration() {
  const turnUrl = import.meta.env.VITE_WEBRTC_TURN_URL;
  const username = import.meta.env.VITE_WEBRTC_TURN_USERNAME;
  const credential = import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL;
  const iceServers = [...DEFAULT_ICE_SERVERS];
  if (turnUrl && username && credential) iceServers.push({ urls: turnUrl, username, credential });
  return { iceServers };
}

function closeAudio(audio) {
  if (!audio) return;
  audio.pause?.();
  audio.srcObject = null;
  audio.remove?.();
}

/** Shared, room-level WebRTC voice client. Entering a room never requests a mic. */
export function useWebRTC(socket, roomCode, userId) {
  const [localStream, setLocalStream] = useState(null);
  const [isVoiceJoined, setIsVoiceJoined] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [peerPresence, setPeerPresence] = useState({});
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [voiceError, setVoiceError] = useState(null);

  const peersRef = useRef({});
  const audiosRef = useRef({});
  const pendingIceRef = useRef({});
  const vadCleanupsRef = useRef({});
  const localStreamRef = useRef(null);
  const joinedRef = useRef(false);
  const socketRef = useRef(socket);
  const roomRef = useRef(roomCode);
  const userRef = useRef(userId);
  const speakerRef = useRef(true);
  const voiceJoinInFlightRef = useRef(null);

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { roomRef.current = roomCode; }, [roomCode]);
  useEffect(() => { userRef.current = userId; }, [userId]);
  useEffect(() => { joinedRef.current = isVoiceJoined; }, [isVoiceJoined]);
  useEffect(() => { speakerRef.current = isSpeakerOn; }, [isSpeakerOn]);

  const clearVAD = useCallback((id) => {
    vadCleanupsRef.current[id]?.();
    delete vadCleanupsRef.current[id];
  }, []);

  const startVAD = useCallback((stream, id) => {
    if (!stream || !id || typeof window === 'undefined') return;
    clearVAD(id);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      let active = true;
      const tick = () => {
        if (!active) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let index = 0; index < data.length; index += 1) sum += data[index];
        const speaking = sum / data.length > 18;
        setSpeakingUsers((previous) => previous[id] === speaking ? previous : { ...previous, [id]: speaking });
        frame = requestAnimationFrame(tick);
      };
      tick();
      vadCleanupsRef.current[id] = () => {
        active = false;
        cancelAnimationFrame(frame);
        source.disconnect();
        context.close?.();
      };
    } catch (error) {
      console.warn('Voice activity detection unavailable:', error);
    }
  }, [clearVAD]);

  const removePeer = useCallback((peerId) => {
    const connection = peersRef.current[peerId];
    if (!connection && !audiosRef.current[peerId] && !pendingIceRef.current[peerId]) return;
    connection?.close();
    delete peersRef.current[peerId];
    delete pendingIceRef.current[peerId];
    closeAudio(audiosRef.current[peerId]);
    delete audiosRef.current[peerId];
    clearVAD(peerId);
    setSpeakingUsers((previous) => {
      if (!(peerId in previous)) return previous;
      const next = { ...previous }; delete next[peerId]; return next;
    });
    setPeerPresence((previous) => {
      if (!(peerId in previous)) return previous;
      const next = { ...previous }; delete next[peerId]; return next;
    });
  }, [clearVAD]);

  const emitSignal = useCallback((event, targetUserId, payload) => {
    if (!socketRef.current || !roomRef.current || !userRef.current) return;
    socketRef.current.emit(event, { roomCode: roomRef.current, targetUserId, fromUserId: userRef.current, ...payload });
  }, []);

  const flushIce = useCallback(async (peerId, connection) => {
    const candidates = pendingIceRef.current[peerId] || [];
    delete pendingIceRef.current[peerId];
    for (const candidate of candidates) {
      try { await connection.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (error) { console.warn('Queued voice ICE candidate failed:', error); }
    }
  }, []);

  const createPeer = useCallback((peerId) => {
    if (!peerId || peerId === userRef.current) return null;
    const existing = peersRef.current[peerId];
    if (existing && existing.connectionState !== 'closed') return existing;

    const connection = new RTCPeerConnection(rtcConfiguration());
    peersRef.current[peerId] = connection;
    // Listen-only participants get a recvonly audio line, then add a sender only
    // if they explicitly turn on their microphone.
    connection.addTransceiver('audio', { direction: 'recvonly' });
    const stream = localStreamRef.current;
    stream?.getAudioTracks().forEach((track) => connection.addTrack(track, stream));
    connection.onicecandidate = ({ candidate }) => { if (candidate) emitSignal('webrtc:ice-candidate', peerId, { candidate }); };
    connection.ontrack = ({ streams }) => {
      const remoteStream = streams[0];
      if (!remoteStream) return;
      let audio = audiosRef.current[peerId];
      if (!audio) {
        audio = new Audio(); audio.autoplay = true; audio.playsInline = true;
        audiosRef.current[peerId] = audio;
      }
      audio.muted = !speakerRef.current;
      audio.srcObject = remoteStream;
      audio.play?.().catch(() => {});
      startVAD(remoteStream, peerId);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed' || connection.connectionState === 'closed') removePeer(peerId);
    };
    return connection;
  }, [emitSignal, removePeer, startVAD]);

  const negotiatePeer = useCallback(async (peerId) => {
    const connection = createPeer(peerId);
    if (!connection || connection.signalingState !== 'stable') return;
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      emitSignal('webrtc:offer', peerId, { offer: connection.localDescription });
    } catch (error) { console.warn('Voice offer failed:', error); }
  }, [createPeer, emitSignal]);

  const joinVoice = useCallback(() => {
    if (voiceJoinInFlightRef.current) return voiceJoinInFlightRef.current;
    if (!socketRef.current || !roomRef.current || !userRef.current) {
      setVoiceError('방에 연결된 뒤 음성 채팅에 참여할 수 있습니다.');
      return Promise.resolve(false);
    }
    setVoiceError(null);
    setVoiceStatus('joining');
    const request = new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        voiceJoinInFlightRef.current = null;
        resolve(result);
      };
      const timeout = window.setTimeout(() => {
        joinedRef.current = false;
        setIsVoiceJoined(false);
        setVoiceStatus('error');
        setVoiceError('음성 서버 응답이 지연됩니다. 다시 시도해 주세요.');
        finish(false);
      }, 4000);
      socketRef.current.emit('voice:join', { roomCode: roomRef.current }, (result) => {
        window.clearTimeout(timeout);
        if (!result?.success) {
          joinedRef.current = false;
          setIsVoiceJoined(false);
          setVoiceStatus('error');
          setVoiceError(result?.error || '음성 채팅 참여에 실패했습니다. 다시 시도해 주세요.');
          finish(false);
          return;
        }
        joinedRef.current = true;
        setIsVoiceJoined(true);
        setVoiceStatus('connected');
        setVoiceError(null);
        (result.peers || []).forEach((peer) => {
          const peerId = typeof peer === 'string' ? peer : peer?.userId || peer?.id;
          if (peerId && !peer?.isBot) negotiatePeer(peerId);
        });
        socketRef.current?.emit('voice:presence', { roomCode: roomRef.current, listening: true, micEnabled: !!localStreamRef.current?.getAudioTracks?.()[0]?.enabled });
        finish(true);
      });
    });
    voiceJoinInFlightRef.current = request;
    return request;
  }, [negotiatePeer]);

  const leaveVoice = useCallback(() => {
    socketRef.current?.emit('voice:leave', { roomCode: roomRef.current });
    Object.keys(peersRef.current).forEach(removePeer);
    clearVAD(userRef.current);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    joinedRef.current = false;
    voiceJoinInFlightRef.current = null;
    setLocalStream(null); setIsMicOn(false); setIsVoiceJoined(false); setVoiceStatus('idle'); setSpeakingUsers({});
  }, [clearVAD, removePeer]);

  const ensureLocalAudio = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('이 브라우저는 마이크 입력을 지원하지 않습니다.'); return null;
    }
    try {
      setVoiceStatus('requesting-mic');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      localStreamRef.current = stream; setLocalStream(stream); startVAD(stream, userRef.current); setVoiceStatus('connected');
      return stream;
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      setVoiceError(denied ? '마이크 권한이 필요합니다. 브라우저 권한을 확인해 주세요.' : '마이크를 사용할 수 없습니다. 장치를 확인해 주세요.');
      setVoiceStatus('error'); return null;
    }
  }, [startVAD]);

  const setMicrophoneEnabled = useCallback(async (enabled) => {
    if (enabled && !joinedRef.current && !(await joinVoice())) return false;
    const stream = await ensureLocalAudio();
    if (!stream) return false;
    stream.getAudioTracks().forEach((track) => { track.enabled = enabled; });
    setIsMicOn(enabled); setVoiceError(null);
    const track = stream.getAudioTracks()[0] || null;
    for (const [peerId, connection] of Object.entries(peersRef.current)) {
      const sender = connection.getSenders().find((item) => item.track?.kind === 'audio');
      if (sender) await sender.replaceTrack(track);
      else if (track) connection.addTrack(track, stream);
      await negotiatePeer(peerId);
    }
    socketRef.current?.emit('voice:presence', { roomCode: roomRef.current, listening: true, micEnabled: enabled });
    return true;
  }, [ensureLocalAudio, joinVoice, negotiatePeer]);

  const toggleMic = useCallback(() => setMicrophoneEnabled(!isMicOn), [isMicOn, setMicrophoneEnabled]);
  const initLocalAudio = useCallback(async () => { if (!joinedRef.current && !(await joinVoice())) return null; return ensureLocalAudio(); }, [ensureLocalAudio, joinVoice]);
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((previous) => {
      const next = !previous;
      Object.values(audiosRef.current).forEach((audio) => { audio.muted = !next; });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket || !roomCode || !userId) return undefined;
    const getId = (payload) => payload?.userId || payload?.newUserId || payload?.peerUserId || payload?.id;
    const onPeers = (payload) => {
      if (!joinedRef.current) return;
      const peers = payload?.peers || payload?.peerUserIds || payload || [];
      (Array.isArray(peers) ? peers : []).forEach((peer) => {
        const id = typeof peer === 'string' ? peer : getId(peer);
        if (id && id !== userId && !peer?.isBot) negotiatePeer(id);
      });
    };
    const onPeerJoined = (payload) => { const id = getId(payload); if (joinedRef.current && id && id !== userId) negotiatePeer(id); };
    const onOffer = async ({ fromUserId, offer }) => {
      if (!joinedRef.current || !fromUserId || fromUserId === userId) return;
      const connection = createPeer(fromUserId); if (!connection) return;
      try {
        if (connection.signalingState !== 'stable') await connection.setLocalDescription({ type: 'rollback' });
        await connection.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(fromUserId, connection);
        const answer = await connection.createAnswer(); await connection.setLocalDescription(answer);
        emitSignal('webrtc:answer', fromUserId, { answer: connection.localDescription });
      } catch (error) { console.warn('Voice answer failed:', error); }
    };
    const onAnswer = async ({ fromUserId, answer }) => {
      const connection = peersRef.current[fromUserId]; if (!connection) return;
      try { await connection.setRemoteDescription(new RTCSessionDescription(answer)); await flushIce(fromUserId, connection); }
      catch (error) { console.warn('Voice answer apply failed:', error); }
    };
    const onIce = async ({ fromUserId, candidate }) => {
      if (!fromUserId || !candidate) return;
      const connection = peersRef.current[fromUserId];
      if (!connection || !connection.remoteDescription) { pendingIceRef.current[fromUserId] = [...(pendingIceRef.current[fromUserId] || []), candidate]; return; }
      try { await connection.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (error) { console.warn('Voice ICE candidate failed:', error); }
    };
    const onPeerLeft = (payload) => { const id = getId(payload); if (id) removePeer(id); };
    const onPresence = (payload) => {
      const id = getId(payload); if (!id || id === userId) return;
      setPeerPresence((previous) => ({ ...previous, [id]: { ...previous[id], ...payload } }));
    };
    const onSocketConnect = () => {
      // The server deliberately clears voice membership on a transport close.
      // Re-register only people who explicitly joined before the reconnect.
      if (joinedRef.current) joinVoice();
    };
    socket.on('voice:peers', onPeers); socket.on('voice:peer-joined', onPeerJoined); socket.on('voice:peer-reconnected', onPeerJoined); socket.on('voice:peer-left', onPeerLeft); socket.on('voice:presence', onPresence);
    socket.on('connect', onSocketConnect); socket.on('webrtc:peer-joined', onPeerJoined); socket.on('webrtc:peer-reconnected', onPeerJoined); socket.on('webrtc:peer-left', onPeerLeft); socket.on('webrtc:offer', onOffer); socket.on('webrtc:answer', onAnswer); socket.on('webrtc:ice-candidate', onIce);
    return () => {
      socket.off('voice:peers', onPeers); socket.off('voice:peer-joined', onPeerJoined); socket.off('voice:peer-reconnected', onPeerJoined); socket.off('voice:peer-left', onPeerLeft); socket.off('voice:presence', onPresence);
      socket.off('connect', onSocketConnect); socket.off('webrtc:peer-joined', onPeerJoined); socket.off('webrtc:peer-reconnected', onPeerJoined); socket.off('webrtc:peer-left', onPeerLeft); socket.off('webrtc:offer', onOffer); socket.off('webrtc:answer', onAnswer); socket.off('webrtc:ice-candidate', onIce);
    };
  }, [socket, roomCode, userId, createPeer, emitSignal, flushIce, negotiatePeer, removePeer, joinVoice]);

  useEffect(() => () => { leaveVoice(); }, [leaveVoice]);

  return { localStream, isVoiceJoined, isMicOn, isSpeakerOn, speakingUsers, peerPresence, voiceStatus, voiceError, joinVoice, leaveVoice, initLocalAudio, setMicrophoneEnabled, toggleMic, toggleSpeaker };
}
