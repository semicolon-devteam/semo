/**
 * SEMO Voice Softphone — WebRTC Client (Phase 3B)
 *
 * 브라우저에서 getUserMedia → WebRTC PeerConnection → 서버(channel-voice)와 음성 통화
 * 시그널링: WebSocket (offer/answer/ICE)
 * Phase 3B: reconnect, debug panel, fallback UX, device handling
 */

const btnCall = document.getElementById('btnCall');
const btnStandby = document.getElementById('btnStandby');
const btnHangup = document.getElementById('btnHangup');
const btnTtsTest = document.getElementById('btnTtsTest');
const btnAccept = document.getElementById('btnAccept');
const btnReject = document.getElementById('btnReject');
const ringOverlay = document.getElementById('ringOverlay');
const ringReason = document.getElementById('ringReason');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const dot = document.getElementById('dot');
const logEl = document.getElementById('log');
const debugPanel = document.getElementById('debugPanel');

let ws = null;
let pc = null;
let localStream = null;
let remoteAudio = null;
let callStartTime = null;
let statsInterval = null;
let authToken = null;
let audioCtx = null; // TTS 재생용 AudioContext
let nextPlayTime = 0;

// ── PostMessage Auth (dashboard iframe embed 시) ──

function isEmbedded() {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

if (isEmbedded()) {
  // 부모에게 ready 알림
  window.parent.postMessage({ type: 'VOICE_READY' }, '*');

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'VOICE_AUTH' && msg.token) {
      authToken = msg.token;
      const serverInput = document.getElementById('serverUrl');
      if (serverInput) {
        // signalingUrl이 있으면 사용, 없으면 기존 base 유지
        const base =
          msg.signalingUrl || serverInput.value.split('?')[0] || 'ws://localhost:8922/signal';
        serverInput.value = base + '?token=' + encodeURIComponent(msg.token);
      }
      log('Dashboard에서 인증 토큰 수신');
    }
  });
}

/** 부모 프레임에 call state 전파 */
function broadcastState(state) {
  if (isEmbedded()) {
    window.parent.postMessage({ type: 'VOICE_STATE', state }, '*');
  }
}

function broadcastError(message) {
  if (isEmbedded()) {
    window.parent.postMessage({ type: 'VOICE_ERROR', message }, '*');
  }
}

// ── Metrics ──
const metrics = {
  iceState: '-',
  candidatePair: '-',
  rttMs: 0,
  jitterMs: 0,
  packetsLost: 0,
  packetsReceived: 0,
  audioLevel: 0,
  callDuration: '0:00',
  reconnects: 0,
};

function updateDebugPanel() {
  if (!debugPanel) return;
  debugPanel.innerHTML = [
    `ICE: ${metrics.iceState}`,
    `RTT: ${metrics.rttMs}ms | Jitter: ${metrics.jitterMs}ms`,
    `Packets: ${metrics.packetsReceived} recv / ${metrics.packetsLost} lost`,
    `Duration: ${metrics.callDuration}`,
    `Reconnects: ${metrics.reconnects}`,
  ].join('\n');
}

async function collectStats() {
  if (!pc) return;
  try {
    const stats = await pc.getStats();
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        metrics.rttMs = Math.round(report.currentRoundTripTime * 1000 || 0);
        metrics.candidatePair = `${report.localCandidateId} ↔ ${report.remoteCandidateId}`;
      }
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        metrics.jitterMs = Math.round((report.jitter || 0) * 1000);
        metrics.packetsLost = report.packetsLost || 0;
        metrics.packetsReceived = report.packetsReceived || 0;
      }
    });
  } catch {
    /* stats unavailable */
  }

  if (callStartTime) {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    metrics.callDuration = `${min}:${sec.toString().padStart(2, '0')}`;
  }
  updateDebugPanel();
}

// ── UI ──

function setStatus(state, text) {
  statusText.textContent = text;
  dot.className = 'dot ' + state;
  statusEl.className = 'status' + (state === 'on' ? ' connected' : state === 'err' ? ' error' : '');
  // Dashboard에 상태 전파
  const stateMap = { off: 'idle', connecting: 'connecting', on: 'in-call', err: 'ended' };
  broadcastState(stateMap[state] || 'idle');
}

function log(msg) {
  const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  logEl.textContent += `[${ts}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Call ──

btnCall.onclick = async () => {
  try {
    btnCall.disabled = true;
    setStatus('connecting', '연결 중...');
    log('통화 시작...');

    // 1. 마이크 접근
    const constraints = {
      audio: {
        echoCancellation: document.getElementById('echoCancellation').checked,
        noiseSuppression: document.getElementById('noiseSuppression').checked,
        autoGainControl: document.getElementById('autoGainControl').checked,
      },
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    log('마이크 접근 허용');

    // 2. WebSocket 시그널링 연결
    const serverUrl = document.getElementById('serverUrl').value;
    if (!serverUrl) {
      log('서버 URL을 입력하세요');
      setStatus('err', '설정 필요');
      cleanup();
      return;
    }
    ws = new WebSocket(serverUrl);
    ws.binaryType = 'arraybuffer';

    // TTS AudioContext 초기화
    if (!audioCtx) {
      audioCtx = new AudioContext({ sampleRate: 48000 });
    }
    audioCtx.resume();
    nextPlayTime = audioCtx.currentTime + 0.1;

    ws.onopen = async () => {
      log('시그널링 서버 연결');

      // 3. PeerConnection 생성
      pc = new RTCPeerConnection({ iceServers: buildIceServers() });

      localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // 원격 오디오 트랙 수신
      pc.ontrack = (event) => {
        log('원격 오디오 트랙 수신');
        if (remoteAudio) {
          remoteAudio.pause();
          remoteAudio.srcObject = null;
        }
        remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(() => log('자동 재생 차단 — 화면을 클릭하세요'));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        metrics.iceState = state;
        log('ICE: ' + state);

        if (state === 'connected' || state === 'completed') {
          setStatus('on', '통화 중');
          btnHangup.disabled = false;
          if (btnTtsTest) btnTtsTest.disabled = false;
          if (!callStartTime) callStartTime = Date.now();
          if (!statsInterval) statsInterval = setInterval(collectStats, 1000);
          startBrowserSTT();
        } else if (state === 'disconnected') {
          setStatus('connecting', '재연결 중...');
          metrics.reconnects++;
          log('재연결 시도...');
        } else if (state === 'failed') {
          setStatus('err', '연결 실패');
          log('ICE 연결 실패 — 네트워크를 확인하세요');
          cleanup();
        }
      };

      // 4. Offer 생성 → 전송
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
      log('SDP Offer 전송');
    };

    ws.onmessage = async (event) => {
      // 바이너리 = TTS PCM → AudioContext 재생
      if (event.data instanceof ArrayBuffer) {
        if (audioCtx && audioCtx.state === 'running') {
          const int16 = new Int16Array(event.data);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
          const buf = audioCtx.createBuffer(1, float32.length, 48000);
          buf.getChannelData(0).set(float32);
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioCtx.destination);
          if (nextPlayTime < audioCtx.currentTime) nextPlayTime = audioCtx.currentTime;
          src.start(nextPlayTime);
          nextPlayTime += buf.duration;
        }
        return;
      }
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          log('SDP Answer 수신');
        }

        if (msg.type === 'offer' && msg.sdp) {
          // ICE restart — 서버 re-offer 처리
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
          log('ICE restart — re-answer 전송');
        }

        if (msg.type === 'ice-candidate' && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }

        if (msg.type === 'hangup') {
          log('서버에서 통화 종료');
          cleanup();
        }
      } catch (err) {
        log('메시지 처리 에러: ' + err.message);
      }
    };

    ws.onerror = () => {
      log('시그널링 서버 연결 실패 — URL과 토큰을 확인하세요');
      setStatus('err', '연결 실패');
      cleanup();
    };

    ws.onclose = (event) => {
      if (event.code === 4001) {
        log('인증 실패 — 토큰을 확인하세요');
      } else if (event.code === 4002) {
        log('이미 통화 중인 세션이 있습니다');
      } else {
        log('시그널링 연결 종료');
      }
      if (pc && pc.iceConnectionState !== 'closed') {
        cleanup();
      }
    };
  } catch (err) {
    log('에러: ' + err.message);
    setStatus('err', err.name === 'NotAllowedError' ? '마이크 권한 거부' : '에러 발생');
    cleanup();
  }
};

btnHangup.onclick = () => {
  log('통화 종료');
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'hangup' }));
  }
  cleanup();
};

// TTS 테스트 버튼
if (btnTtsTest) {
  btnTtsTest.onclick = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'tts-test' }));
      btnTtsTest.textContent = 'TTS 생성 중...';
      btnTtsTest.disabled = true;
      log('TTS 테스트 요청 전송');
      // 5초 후 버튼 복구
      setTimeout(() => {
        btnTtsTest.textContent = 'TTS 테스트';
        btnTtsTest.disabled = false;
      }, 5000);
    } else {
      log('통화 연결 후 사용 가능합니다');
    }
  };
}

function cleanup() {
  if (cleaning) return; // P0 fix: 재진입 방지
  cleaning = true;
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (remoteAudio) {
    remoteAudio.pause();
    remoteAudio.srcObject = null;
    remoteAudio = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (pc) {
    pc.close();
    pc = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  callStartTime = null;
  earlyMessages = [];
  pendingCallId = null;
  stopBrowserSTT();
  if (ringOverlay) ringOverlay.style.display = 'none';
  setStatus('off', '연결 대기');
  btnCall.disabled = false;
  btnStandby.disabled = false;
  btnHangup.disabled = true;
  if (btnTtsTest) btnTtsTest.disabled = true;
  metrics.iceState = '-';
  updateDebugPanel();
  cleaning = false;
}

// ── Browser STT (Web Speech API) — VOICE_STT_PROVIDER=browser 모드 ──
// Chrome/Edge desktop, HTTPS or localhost 에서만 동작.
// 통화 시작 시 SpeechRecognition 활성화 → ws.send({type:'transcript',...})

let recognition = null;
let recognitionStopRequested = false;

function startBrowserSTT() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    log('⚠️ Web Speech API 미지원 — 서버 STT(Deepgram 등)만 동작');
    return;
  }
  if (recognition) return;
  recognitionStopRequested = false;

  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = (result[0] && result[0].transcript) || '';
      const isFinal = !!result.isFinal;
      if (!text.trim()) continue;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'transcript', text, isFinal }));
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    log('🎤 STT 오류: ' + e.error);
  };

  recognition.onend = () => {
    // continuous=true 라도 일정 시간 후 자동 종료됨 → 통화 중이면 재시작
    if (!recognitionStopRequested && recognition) {
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    }
  };

  try {
    recognition.start();
    log('🎤 Web Speech STT 시작 (ko-KR)');
  } catch (err) {
    log('🎤 STT 시작 실패: ' + (err && err.message));
    recognition = null;
  }
}

function stopBrowserSTT() {
  recognitionStopRequested = true;
  if (recognition) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
    recognition = null;
  }
}

// ── ICE servers (STUN + TURN, NAT traversal 보강) ──
function buildIceServers() {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
}

// ── Standby Mode (대기 — 에이전트 발신 수신 대기) ──

let pendingCallId = null;
let earlyMessages = []; // P0 fix: pc 생성 전 도착한 signaling 메시지 버퍼
let cleaning = false; // P0 fix: cleanup 재진입 방지

function getUserId() {
  let uid = localStorage.getItem('semo_user_id');
  if (!uid) {
    uid = prompt('SEMO User ID (전화 수신용 식별자, 예: reus)') || '';
    if (uid) localStorage.setItem('semo_user_id', uid.trim());
  }
  return (uid || '').trim();
}

btnStandby.onclick = async () => {
  try {
    btnStandby.disabled = true;
    btnCall.disabled = true;
    setStatus('connecting', '대기 모드 연결 중...');
    log('대기 모드 시작 — 에이전트 전화 수신 대기');

    const serverUrl = document.getElementById('serverUrl').value;
    if (!serverUrl) {
      log('서버 URL 필요');
      setStatus('err', '설정 필요');
      btnStandby.disabled = false;
      btnCall.disabled = false;
      return;
    }

    ws = new WebSocket(serverUrl);
    ws.binaryType = 'arraybuffer';
    if (!audioCtx) audioCtx = new AudioContext({ sampleRate: 48000 });
    audioCtx.resume();
    nextPlayTime = audioCtx.currentTime + 0.1;

    ws.onopen = () => {
      setStatus('on', '대기 중 — 등록 요청 중...');
      log('시그널링 서버 연결 (대기 모드)');
      const uid = getUserId();
      if (uid) {
        ws.send(JSON.stringify({ type: 'register-as-standby', user_id: uid }));
        log('Standby 등록 요청: user=' + uid);
      } else {
        log(
          '⚠️ user_id 미설정 — 브라우저 콘솔에서 localStorage.setItem("semo_user_id", "...") 후 새로고침',
        );
      }
    };

    ws.onmessage = async (event) => {
      // 바이너리 = TTS PCM → AudioContext 재생
      if (event.data instanceof ArrayBuffer) {
        if (audioCtx && audioCtx.state === 'running') {
          const int16 = new Int16Array(event.data);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
          const buf = audioCtx.createBuffer(1, float32.length, 48000);
          buf.getChannelData(0).set(float32);
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioCtx.destination);
          if (nextPlayTime < audioCtx.currentTime) nextPlayTime = audioCtx.currentTime;
          src.start(nextPlayTime);
          nextPlayTime += buf.duration;
        }
        return;
      }
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'standby-ack') {
          setStatus('on', '대기 중 — user=' + msg.user_id);
          log('✅ Standby 등록 완료: user=' + msg.user_id);
        }

        if (msg.type === 'incoming-call') {
          pendingCallId = msg.callId;
          ringReason.textContent = msg.reason || '';
          ringOverlay.style.display = 'flex';
          log('📞 수신 전화: ' + (msg.reason || ''));
          // 소리 재생 (간이)
          try {
            new Audio(
              'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQ==',
            ).play();
          } catch {}
        }

        // 통화 중 offer/answer/ICE — pc 없으면 버퍼링 (accept 후 flush)
        if (msg.type === 'answer' || (msg.type === 'ice-candidate' && msg.candidate)) {
          if (pc) {
            if (msg.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              log('SDP Answer 수신');
            } else {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
          } else {
            earlyMessages.push(msg); // P0 fix: pc 생성 전 버퍼링
          }
        }
        if (msg.type === 'hangup') {
          log('서버에서 통화 종료');
          cleanup();
        }
      } catch (err) {
        log('메시지 에러: ' + err.message);
      }
    };

    ws.onerror = () => {
      log('연결 실패');
      setStatus('err', '연결 실패');
      cleanup();
    };
    ws.onclose = (event) => {
      if (event.code === 4001) log('인증 실패');
      else if (event.code === 4002) log('이미 통화 중');
      else log('연결 종료');
      cleanup();
    };
  } catch (err) {
    log('에러: ' + err.message);
    setStatus('err', '에러');
    cleanup();
  }
};

// 수락 → 마이크 접근 + offer 전송
btnAccept.onclick = async () => {
  if (!pendingCallId || !ws) return;
  ringOverlay.style.display = 'none';

  try {
    const constraints = {
      audio: {
        echoCancellation: document.getElementById('echoCancellation').checked,
        noiseSuppression: document.getElementById('noiseSuppression').checked,
        autoGainControl: document.getElementById('autoGainControl').checked,
      },
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    ws.send(JSON.stringify({ type: 'accept-call', callId: pendingCallId }));
    log('전화 수락 — 연결 중...');
    setStatus('connecting', '연결 중...');

    // PeerConnection 생성 + offer
    pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    localStream.getAudioTracks().forEach((t) => pc.addTrack(t, localStream));

    pc.ontrack = (event) => {
      if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
      }
      remoteAudio = new Audio();
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play().catch(() => log('자동 재생 차단'));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      metrics.iceState = state;
      log('ICE: ' + state);
      if (state === 'connected' || state === 'completed') {
        setStatus('on', '통화 중');
        btnHangup.disabled = false;
        if (!callStartTime) callStartTime = Date.now();
        if (!statsInterval) statsInterval = setInterval(collectStats, 1000);
        startBrowserSTT();
      } else if (state === 'disconnected') {
        setStatus('connecting', '재연결 중...');
        metrics.reconnects++;
      } else if (state === 'failed') {
        setStatus('err', '연결 실패');
        cleanup();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));

    // P0 fix: pc 생성 전 버퍼링된 메시지 flush
    for (const em of earlyMessages) {
      try {
        if (em.type === 'answer') await pc.setRemoteDescription(new RTCSessionDescription(em.sdp));
        if (em.type === 'ice-candidate' && em.candidate)
          await pc.addIceCandidate(new RTCIceCandidate(em.candidate));
      } catch (e) {
        log('early msg flush: ' + e.message);
      }
    }
    earlyMessages = [];
    pendingCallId = null;
  } catch (err) {
    log('수락 에러: ' + err.message);
    cleanup();
  }
};

// 거절
btnReject.onclick = () => {
  if (pendingCallId && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'reject-call', callId: pendingCallId }));
  }
  ringOverlay.style.display = 'none';
  pendingCallId = null;
  log('전화 거절');
};

// ── Device change detection ──
if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    log('오디오 장치 변경 감지');
    if (localStream) {
      // 현재 트랙이 여전히 유효한지 확인
      const tracks = localStream.getAudioTracks();
      if (tracks.length === 0 || tracks[0].readyState === 'ended') {
        log('마이크 연결 해제됨 — 통화 종료');
        cleanup();
      }
    }
  });
}
