import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  ShieldAlert,
  Users,
  MousePointer,
  Sparkles,
  Volume2,
  VolumeX,
  Radio,
  Share2,
} from 'lucide-react';
import { User, Channel } from '../types';

interface VoiceAndScreenStageProps {
  channel: Channel;
  currentUser: User;
  users: User[];
  onLeave: () => void;
}

export const VoiceAndScreenStage: React.FC<VoiceAndScreenStageProps> = ({
  channel,
  currentUser,
  users,
  onLeave,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remoteControlGranted, setRemoteControlGranted] = useState(false);
  const [controllerUser, setControllerUser] = useState<User | null>(null);
  const [killSwitchAlert, setKillSwitchAlert] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [clickRipples, setClickRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({
    [currentUser.id]: false,
    user_sarah: true,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const escapePressesRef = useRef<number[]>([]);

  // Safety Kill-Switch (Escape x3 within 1.5 seconds)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        const recentPresses = escapePressesRef.current.filter((t) => now - t <= 1500);
        recentPresses.push(now);
        escapePressesRef.current = recentPresses;

        if (recentPresses.length >= 3) {
          // Trigger instant kill-switch
          escapePressesRef.current = [];
          if (remoteControlGranted || isSharingScreen) {
            setRemoteControlGranted(false);
            setControllerUser(null);
            setKillSwitchAlert('Remote control terminated by host.');
            
            // Auto dismiss alert after 4 seconds
            setTimeout(() => {
              setKillSwitchAlert(null);
            }, 4500);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [remoteControlGranted, isSharingScreen]);

  // Handle Screen Sharing
  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsSharingScreen(false);
      setRemoteControlGranted(false);
      setControllerUser(null);
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setIsSharingScreen(true);

          // Handle when browser stop-sharing button is clicked
          stream.getVideoTracks()[0].onended = () => {
            setIsSharingScreen(false);
            setRemoteControlGranted(false);
            setControllerUser(null);
          }
        } else {
          // In environments without getDisplayMedia permission, enable collaborative virtual canvas
          setIsSharingScreen(true);
        }
      } catch (err) {
        console.warn('Screen share permission canceled or not supported; falling back to interactive virtual screen mode.', err);
        setIsSharingScreen(true);
      }
    }
  };

  // Remote Control Pointer Handling on Screen Area
  const handleScreenMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!remoteControlGranted && !isSharingScreen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newRipple = { id: Date.now(), x, y };
    setClickRipples((prev) => [...prev.slice(-4), newRipple]);

    setTimeout(() => {
      setClickRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 800);
  };

  // Toggle Remote Control Permission
  const toggleRemoteControl = () => {
    if (remoteControlGranted) {
      setRemoteControlGranted(false);
      setControllerUser(null);
    } else {
      setRemoteControlGranted(true);
      const peer = users.find((u) => u.id === 'user_sarah') || users[1];
      setControllerUser(peer);
    }
  };

  // Simulate subtle voice speaking activity
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeakingUsers({
        [currentUser.id]: !isMuted && Math.random() > 0.6,
        user_sarah: Math.random() > 0.4,
        user_maya: Math.random() > 0.8,
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [currentUser.id, isMuted]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F19] overflow-hidden select-none">
      {/* Top Stage Bar */}
      <div className="h-14 px-6 border-b border-white/10 flex items-center justify-between glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{channel.name}</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                Connected • 64kbps Opus
              </span>
            </div>
            <p className="text-[11px] text-slate-400">School-Safe Encrypted Voice & WebRTC Room</p>
          </div>
        </div>

        {/* Safety Kill-Switch Alert Banner */}
        {killSwitchAlert && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-600/90 text-white px-3.5 py-1.5 text-xs font-bold shadow-lg shadow-rose-600/30 animate-bounce border border-rose-400/40">
            <ShieldAlert className="w-4 h-4" />
            <span>{killSwitchAlert}</span>
          </div>
        )}

        {/* Kill-switch guidance reminder if remote control is active */}
        {remoteControlGranted && !killSwitchAlert && (
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>
              Remote Control Active (<strong className="text-white">{controllerUser?.name}</strong>) • Press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[10px] border border-white/20">
                Esc x3
              </kbd>{' '}
              to sever instantly
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleRemoteControl}
            disabled={!isSharingScreen}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
              !isSharingScreen
                ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/5 text-slate-400'
                : remoteControlGranted
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 glow-periwinkle'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10'
            }`}
            title="Allows invited peer to send pointer and control events"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>{remoteControlGranted ? 'Revoke Remote Control' : 'Grant Remote Control'}</span>
          </button>

          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-3 py-1.5 text-xs font-semibold border border-rose-500/30 transition-all"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave Stage</span>
          </button>
        </div>
      </div>

      {/* Main Stage View Area */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden">
        {/* Screen Share / Presentation Canvas (Takes 3 columns on desktop) */}
        <div
          onClick={handleScreenClick}
          onMouseMove={handleScreenMouseMove}
          className="lg:col-span-3 rounded-3xl glass-card relative overflow-hidden flex flex-col items-center justify-center p-4 border border-white/10 group cursor-crosshair min-h-[360px]"
        >
          {isSharingScreen ? (
            <div className="w-full h-full relative rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />

              {/* If no hardware video feed, render interactive high-fidelity CAD/Study canvas */}
              {(!streamRef.current || !streamRef.current.getVideoTracks().length) && (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-[#0F172A] to-[#0B0F19] text-center">
                  <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mb-4 glow-periwinkle">
                    <Monitor className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    Interactive Virtual Collaboration Screen
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Live WebRTC stream simulation. Click anywhere on this stage to test pointer coordinates and remote control events.
                  </p>

                  <div className="grid grid-cols-2 gap-3 max-w-sm w-full text-left">
                    <div className="rounded-xl bg-slate-900/60 p-3 border border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Framerate</span>
                      <p className="text-sm font-bold text-emerald-400">60 FPS Ultra-HD</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/60 p-3 border border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Signaling Protocol</span>
                      <p className="text-sm font-bold text-indigo-400">WebRTC DataChannel</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Collaborative Remote Pointer Tag */}
              {remoteControlGranted && (
                <div
                  className="absolute pointer-events-none transition-all duration-75 ease-out z-20"
                  style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%` }}
                >
                  <div className="relative">
                    <MousePointer className="w-5 h-5 text-indigo-400 drop-shadow-md -rotate-12 fill-indigo-500/80" />
                    <div className="absolute top-4 left-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-lg whitespace-nowrap">
                      {controllerUser?.name || 'Remote Peer'}
                    </div>
                  </div>
                </div>
              )}

              {/* Click Ripple Markers */}
              {clickRipples.map((ripple) => (
                <div
                  key={ripple.id}
                  className="absolute w-8 h-8 rounded-full border-2 border-indigo-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-ping"
                  style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }}
                />
              ))}

              {/* Status Badge Overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10 text-xs font-semibold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Screen Share Active ({currentUser.name})</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-slate-400">
                <MonitorOff className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Active Screen Stream</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-6">
                Start sharing your screen to collaborate on CAD files, code reviews, and presentations with remote control safety.
              </p>
              <button
                onClick={toggleScreenShare}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
              >
                <Monitor className="w-4 h-4" />
                <span>Start Screen Share</span>
              </button>
            </div>
          )}
        </div>

        {/* Voice Room Participants Column */}
        <div className="rounded-3xl glass-panel p-4 flex flex-col justify-between border border-white/10 overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>In Voice Channel ({users.length})</span>
              </div>
            </div>

            {/* Participant Cards */}
            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {users.map((u) => {
                const isSpeaking = speakingUsers[u.id];
                const isSelf = u.id === currentUser.id;

                return (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl transition-all border ${
                      isSpeaking
                        ? 'bg-emerald-950/20 border-emerald-500/40 glow-emerald'
                        : 'bg-slate-900/30 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className={`w-9 h-9 rounded-2xl bg-slate-800 border-2 transition-all ${
                            isSpeaking ? 'border-emerald-400 scale-105' : 'border-transparent'
                          }`}
                        />
                        {isSpeaking && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0B0F19] animate-pulse" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] text-indigo-400 font-semibold">(You)</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSpeaking && (
                        <div className="flex items-center gap-0.5 px-1 py-0.5">
                          <div className="w-1 h-2 rounded-full bg-emerald-400 animate-soundwave-1" />
                          <div className="w-1 h-3 rounded-full bg-emerald-400 animate-soundwave-2" />
                          <div className="w-1 h-2.5 rounded-full bg-emerald-400 animate-soundwave-3" />
                        </div>
                      )}
                      {isSelf && isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Stage Controls */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all text-xs font-semibold ${
                  isMuted
                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                    : 'bg-white/5 text-slate-200 hover:bg-white/10 border-white/10'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4 mb-1 text-rose-400" /> : <Mic className="w-4 h-4 mb-1 text-emerald-400" />}
                <span>{isMuted ? 'Muted' : 'Mute'}</span>
              </button>

              <button
                onClick={() => setIsDeafened(!isDeafened)}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all text-xs font-semibold ${
                  isDeafened
                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                    : 'bg-white/5 text-slate-200 hover:bg-white/10 border-white/10'
                }`}
                title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
              >
                {isDeafened ? <VolumeX className="w-4 h-4 mb-1 text-rose-400" /> : <Volume2 className="w-4 h-4 mb-1 text-indigo-400" />}
                <span>{isDeafened ? 'Deafened' : 'Deafen'}</span>
              </button>

              <button
                onClick={toggleScreenShare}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all text-xs font-semibold ${
                  isSharingScreen
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 glow-periwinkle'
                    : 'bg-white/5 text-slate-200 hover:bg-white/10 border-white/10'
                }`}
                title="Toggle screen sharing"
              >
                {isSharingScreen ? <Monitor className="w-4 h-4 mb-1 text-indigo-400" /> : <Share2 className="w-4 h-4 mb-1 text-slate-400" />}
                <span>{isSharingScreen ? 'Sharing' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
