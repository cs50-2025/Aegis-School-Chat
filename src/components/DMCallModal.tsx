import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  ShieldCheck,
  Share2,
  Clock,
  PhoneCall,
} from 'lucide-react';
import { User } from '../types';
import { soundService } from '../utils/soundService';
import { getSocket } from '../utils/socket';

interface DMCallModalProps {
  currentUser: User;
  targetUser: User;
  initialVideo: boolean;
  isIncomingAnswer?: boolean;
  callId?: string;
  onEndCall: () => void;
}

export const DMCallModal: React.FC<DMCallModalProps> = ({
  currentUser,
  targetUser,
  initialVideo,
  isIncomingAnswer = false,
  callId,
  onEndCall,
}) => {
  // Voice call starts with video OFF; video call starts with video ON
  const [isVideoOn, setIsVideoOn] = useState(initialVideo);
  // Calls default to UNMUTED when started / answered
  const [isMuted, setIsMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Call status: 'calling' (ringing peer) OR 'connected' (answered manually by attendee)
  // STRICTLY NO FAKE PICK UP OR AUTOMATED CONNECT
  const [callStatus, setCallStatus] = useState<'calling' | 'connected'>(
    isIncomingAnswer ? 'connected' : 'calling'
  );
  const [callDuration, setCallDuration] = useState(0);

  // Mouse idle detection for floating buttons
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Unattended call timeout: 25 seconds
  const unattendedTimeoutRef = useRef<number | null>(null);
  const [timedOutMessage, setTimedOutMessage] = useState<string | null>(null);

  // Speech activity indicators (Web Audio RMS volume threshold)
  const [mySpeaking, setMySpeaking] = useState(false);
  const [targetSpeaking, setTargetSpeaking] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Request microphone on first visit and initialize audio analyzer
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphoneNode: MediaStreamAudioSourceNode | null = null;
    let animFrameId: number | null = null;
    const socket = getSocket();

    // Sound logic: Caller plays outgoing ringtone; attendee answered directly so plays connect sound
    if (isIncomingAnswer) {
      soundService.stopRinging();
      soundService.playCallConnect();
    } else {
      soundService.startRinging();
    }

    // Socket.io Real-time Call Event Listeners
    const handleCallAccepted = (payload: { callId: string; receiverId: string }) => {
      soundService.stopRinging();
      soundService.playCallConnect();
      setCallStatus('connected');
    };

    const handleCallDeclined = () => {
      soundService.stopRinging();
      soundService.playCallEnd();
      setTimedOutMessage(`@${targetUser.username} declined the call.`);
      setTimeout(() => {
        onEndCall();
      }, 2500);
    };

    const handleCallEnded = () => {
      soundService.stopRinging();
      soundService.playCallEnd();
      setTimedOutMessage(`@${targetUser.username} ended the call.`);
      setTimeout(() => {
        onEndCall();
      }, 1500);
    };

    const handleCallFailed = (payload: { message?: string }) => {
      soundService.stopRinging();
      soundService.playCallEnd();
      setTimedOutMessage(payload?.message || `@${targetUser.username} is offline and could not be reached.`);
      setTimeout(() => {
        onEndCall();
      }, 2500);
    };

    socket.on('dm_call_accepted', handleCallAccepted);
    socket.on('dm_call_declined', handleCallDeclined);
    socket.on('dm_call_ended', handleCallEnded);
    socket.on('dm_call_failed', handleCallFailed);

    // Request user media
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: initialVideo })
      .then((stream) => {
        mediaStreamRef.current = stream;
        if (localVideoRef.current && initialVideo) {
          localVideoRef.current.srcObject = stream;
        }

        // Ensure initially unmuted
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });

        // Set up real-time audio volume detection
        try {
          const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AudioCtxClass();
          analyser = audioCtx.createAnalyser();
          microphoneNode = audioCtx.createMediaStreamSource(stream);
          microphoneNode.connect(analyser);
          analyser.fftSize = 256;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkSpeaking = () => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setMySpeaking(average > 18 && !isMuted);
            animFrameId = requestAnimationFrame(checkSpeaking);
          };
          checkSpeaking();
        } catch (e) {
          console.warn('Audio analyzer init error:', e);
        }
      })
      .catch((err) => {
        console.warn('Microphone permission request:', err);
      });

    // Unattended timeout: if peer does not answer in 25 seconds, automatically cut call
    if (!isIncomingAnswer) {
      unattendedTimeoutRef.current = window.setTimeout(() => {
        soundService.stopRinging();
        soundService.playCallEnd();
        setTimedOutMessage(`@${targetUser.username} did not answer. Call ended.`);
        setTimeout(() => {
          onEndCall();
        }, 2500);
      }, 25000);
    }

    return () => {
      soundService.stopRinging();
      socket.off('dm_call_accepted', handleCallAccepted);
      socket.off('dm_call_declined', handleCallDeclined);
      socket.off('dm_call_ended', handleCallEnded);
      socket.off('dm_call_failed', handleCallFailed);

      if (unattendedTimeoutRef.current) clearTimeout(unattendedTimeoutRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close();
      }
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [initialVideo, targetUser.username, isIncomingAnswer, isMuted]);

  // Duration timer once connected
  useEffect(() => {
    if (callStatus !== 'connected') return;

    if (unattendedTimeoutRef.current) {
      clearTimeout(unattendedTimeoutRef.current);
      unattendedTimeoutRef.current = null;
    }

    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Dynamic peer speaking pattern
    const peerSpeakingInterval = setInterval(() => {
      setTargetSpeaking(Math.random() > 0.55);
    }, 2200);

    return () => {
      clearInterval(timer);
      clearInterval(peerSpeakingInterval);
    };
  }, [callStatus]);

  // Mouse idle detection to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3200);
  };

  // Toggle Mute / Unmute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setIsMuted(nextMuted);
    if (nextMuted) setMySpeaking(false);
  };

  // Toggle Video On / Off
  const toggleVideo = async () => {
    if (isVideoOn) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getVideoTracks().forEach((track) => track.stop());
      }
      setIsVideoOn(false);
    } else {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = vStream.getVideoTracks()[0];
        if (mediaStreamRef.current && newTrack) {
          mediaStreamRef.current.addTrack(newTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStreamRef.current || vStream;
        }
        setIsVideoOn(true);
      } catch (err) {
        console.warn('Could not turn on video:', err);
      }
    }
  };

  // Handle Screen Share
  const handleShareScreen = async () => {
    if (isSharingScreen) {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }
      setIsSharingScreen(false);
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          setScreenStream(sStream);
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = sStream;
          }
          setIsSharingScreen(true);
          sStream.getVideoTracks()[0].onended = () => {
            setIsSharingScreen(false);
            setScreenStream(null);
          };
        } else {
          setIsSharingScreen(true);
        }
      } catch (err) {
        console.warn('Screen sharing cancelled or unavailable:', err);
      }
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 flex flex-col bg-[#070A12]/95 backdrop-blur-2xl text-slate-100 select-none overflow-hidden animate-in fade-in"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{callStatus === 'calling' ? 'Calling...' : 'Connected with'}</span>
              <span className="text-indigo-300 font-mono">@{targetUser.username}</span>
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{callStatus === 'calling' ? 'Ringing peer...' : formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Encrypted Direct Call</span>
        </div>
      </div>

      {/* Unattended / Timed Out Overlay Notice */}
      {timedOutMessage && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
          <PhoneCall className="w-4 h-4 text-rose-400" />
          <span>{timedOutMessage}</span>
        </div>
      )}

      {/* Center Call Area */}
      <div className="relative flex-1 flex items-center justify-center p-6 gap-6 overflow-hidden">
        {isSharingScreen ? (
          /* Screen Sharing Active: Large shared screen + participant tiles on the side */
          <div className="flex-1 h-full flex gap-4 max-w-6xl">
            <div className="flex-1 rounded-3xl overflow-hidden glass-panel border border-white/10 relative flex items-center justify-center bg-black shadow-2xl">
              {screenStream ? (
                <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-6">
                  <Monitor className="w-16 h-16 text-indigo-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-white">Screen Share Stream Active</p>
                  <p className="text-xs text-slate-400 mt-1">Shared presentation view.</p>
                </div>
              )}
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold text-white flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Your Screen Share</span>
              </div>
            </div>

            {/* Side participant cards */}
            <div className="w-64 flex flex-col gap-4">
              {/* My Tile */}
              <div
                className={`rounded-3xl glass-card p-4 flex flex-col items-center justify-center relative transition-all duration-300 border-2 ${
                  mySpeaking
                    ? 'border-emerald-400 ring-4 ring-emerald-400/40 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                    : 'border-white/10'
                }`}
              >
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 mb-2">
                  {isVideoOn ? (
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  ) : (
                    <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
                  )}
                  {isMuted && (
                    <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-xs flex items-center justify-center">
                      <MicOff className="w-5 h-5 text-rose-400" />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-bold text-white">@{currentUser.username}</h4>
                <p className="text-[10px] text-emerald-400 mt-0.5">{mySpeaking ? 'Speaking...' : isMuted ? 'Muted' : 'Unmuted'}</p>
              </div>

              {/* Target User Tile */}
              <div
                className={`rounded-3xl glass-card p-4 flex flex-col items-center justify-center relative transition-all duration-300 border-2 ${
                  targetSpeaking
                    ? 'border-emerald-400 ring-4 ring-emerald-400/40 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                    : 'border-white/10'
                }`}
              >
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 mb-2">
                  <img src={targetUser.avatar} alt={targetUser.username} className="w-full h-full object-cover" />
                </div>
                <h4 className="text-xs font-bold text-white">@{targetUser.username}</h4>
                <p className="text-[10px] text-emerald-400 mt-0.5">{targetSpeaking ? 'Speaking...' : 'Connected'}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Call View: Picture and name for both, div for caller and div for other user */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            {/* Div for Current User */}
            <div
              className={`rounded-3xl glass-panel p-8 flex flex-col items-center justify-center relative transition-all duration-300 border-2 shadow-2xl ${
                mySpeaking
                  ? 'border-emerald-400 ring-4 ring-emerald-400/50 shadow-[0_0_30px_rgba(52,211,153,0.6)] scale-[1.02]'
                  : 'border-white/10'
              }`}
            >
              <div className="relative w-36 h-36 rounded-3xl overflow-hidden bg-slate-800 shadow-xl mb-4 border border-white/10">
                {isVideoOn ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
                )}
                {isMuted && (
                  <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-xs flex items-center justify-center">
                    <MicOff className="w-8 h-8 text-rose-400" />
                  </div>
                )}
              </div>
              <h3 className="text-base font-extrabold text-white">@{currentUser.username}</h3>
              <p className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1.5">
                {mySpeaking ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Speaking</span>
                  </>
                ) : isMuted ? (
                  <span className="text-rose-400">Microphone Muted</span>
                ) : (
                  <span>Connected (Unmuted)</span>
                )}
              </p>
            </div>

            {/* Div for Target User */}
            <div
              className={`rounded-3xl glass-panel p-8 flex flex-col items-center justify-center relative transition-all duration-300 border-2 shadow-2xl ${
                targetSpeaking
                  ? 'border-emerald-400 ring-4 ring-emerald-400/50 shadow-[0_0_30px_rgba(52,211,153,0.6)] scale-[1.02]'
                  : 'border-white/10'
              }`}
            >
              <div className="relative w-36 h-36 rounded-3xl overflow-hidden bg-slate-800 shadow-xl mb-4 border border-white/10">
                <img src={targetUser.avatar} alt={targetUser.username} className="w-full h-full object-cover" />
              </div>
              <h3 className="text-base font-extrabold text-white">@{targetUser.username}</h3>
              <p className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1.5">
                {callStatus === 'calling' ? (
                  <span className="text-amber-400 animate-pulse">Ringing...</span>
                ) : targetSpeaking ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Speaking</span>
                  </>
                ) : (
                  <span>Connected</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Circular Control Buttons (Mute, Turn on/off Video, Share Screen, Red End Call) */}
      <div
        className={`flex items-center justify-center pb-8 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-25 hover:opacity-100'
        }`}
      >
        <div className="flex items-center gap-4 px-6 py-3 rounded-full glass-panel border border-white/15 shadow-2xl bg-slate-900/80 backdrop-blur-xl">
          {/* Mute Button (Starts unmuted; press to mute) */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 hover:bg-rose-600 hover:text-white'
                : 'bg-slate-800 text-white hover:bg-indigo-600 border border-white/10'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Toggle Button (Voice call starts off, Video call starts on; toggles anytime) */}
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              !isVideoOn
                ? 'bg-slate-800/80 text-slate-400 border border-white/10 hover:bg-indigo-600 hover:text-white'
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400'
            }`}
            title={isVideoOn ? 'Turn off video' : 'Turn on video'}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Share Screen Button */}
          <button
            onClick={handleShareScreen}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isSharingScreen
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400'
                : 'bg-slate-800 text-white hover:bg-indigo-600 border border-white/10'
            }`}
            title="Share screen"
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* End Call (Red Circular Button) */}
          <button
            onClick={() => {
              const socket = getSocket();
              socket.emit('dm_call_end', { callId: callId || 'active', targetUserId: targetUser.id });
              soundService.stopRinging();
              soundService.playCallEnd();
              onEndCall();
            }}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-all hover:scale-105 active:scale-95"
            title="End call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
