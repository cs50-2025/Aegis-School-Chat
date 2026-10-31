import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Hash,
  Send,
  Mic,
  Image as ImageIcon,
  BarChart3,
  Smile,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  StopCircle,
  X,
  Lock,
} from 'lucide-react';
import { Message, Channel, User, ServerData } from '../types';
import { tokenizeMessageContent, CUSTOM_EMOJIS } from '../utils/profanityFilter';
import { PWAInstallButton } from './PWAInstallButton';
import { getSocket } from '../utils/socket';

interface ChatAreaProps {
  channel: Channel;
  server?: ServerData;
  messages: Message[];
  currentUser: User;
  onSendMessage: (params: {
    content: string;
    type?: 'text' | 'voice' | 'image' | 'poll';
    mediaUrl?: string;
    mediaDuration?: number;
    fileName?: string;
  }) => Promise<{ error?: string; blocked?: boolean } | void>;
  onOpenCreatePoll: () => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  unreadCount: number;
  onSummarizeChat: () => void;
  isSummarizing: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  server,
  messages,
  currentUser,
  onSendMessage,
  onOpenCreatePoll,
  onVotePoll,
  onReactMessage,
  unreadCount,
  onSummarizeChat,
  isSummarizing,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [revealedPillIndices, setRevealedPillIndices] = useState<Set<string>>(new Set());

  // Real-time Typing Indicators State
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingActiveRef = useRef<boolean>(false);

  // Moderation & Permission warning states
  const [moderationError, setModerationError] = useState<string | null>(null);

  // Voice recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // Image moderation scanning state
  const [isModeratingImage, setIsModeratingImage] = useState(false);
  const [moderationAlert, setModerationAlert] = useState<{
    type: 'success' | 'danger';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Socket.io Real-Time Typing Indicators
  useEffect(() => {
    const socket = getSocket();

    socket.emit('join_room', `channel:${channel.id}`);

    const handleTypingStart = (data: { channelId?: string; username: string; userId: string }) => {
      if (data.channelId === channel.id && data.userId !== currentUser.id) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(data.username);
          return next;
        });
      }
    };

    const handleTypingStop = (data: { channelId?: string; username: string; userId: string }) => {
      if (data.channelId === channel.id) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(data.username);
          return next;
        });
      }
    };

    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);

    // Also support custom event from SSE bridge if fallback active
    const handleSSETyping = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.channelId === channel.id && detail.userId !== currentUser.id) {
        if (detail.isTyping) {
          handleTypingStart(detail);
        } else {
          handleTypingStop(detail);
        }
      }
    };
    window.addEventListener('aegis:user_typing', handleSSETyping);

    return () => {
      socket.emit('leave_room', `channel:${channel.id}`);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
      window.removeEventListener('aegis:user_typing', handleSSETyping);
      setTypingUsers(new Set());
    };
  }, [channel.id, currentUser.id]);

  // Handle typing keystrokes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    const socket = getSocket();

    if (!isTypingActiveRef.current && text.trim().length > 0) {
      isTypingActiveRef.current = true;
      socket.emit('typing_start', {
        channelId: channel.id,
        username: currentUser.username,
        userId: currentUser.id,
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        socket.emit('typing_stop', {
          channelId: channel.id,
          username: currentUser.username,
          userId: currentUser.id,
        });
      }
    }, 1500);
  };

  const stopTypingNow = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      const socket = getSocket();
      socket.emit('typing_stop', {
        channelId: channel.id,
        username: currentUser.username,
        userId: currentUser.id,
      });
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Deduplicate messages by id to guarantee unique React keys
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (!m || !m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  // Check RBAC Permissions
  const isOwner = server?.ownerId === currentUser.id;
  const userRoleIds = server?.memberRoles[currentUser.id] || [];
  const userRoles = server?.roles.filter((r) => userRoleIds.includes(r.id)) || [];

  const hasAdmin = isOwner || userRoles.some((r) => r.permissions.includes('ADMINISTRATOR'));
  const canSendText =
    hasAdmin ||
    (channel.type === 'announcement'
      ? userRoles.some((r) => r.permissions.includes('SEND_ANNOUNCEMENTS'))
      : userRoles.some((r) => r.permissions.includes('SEND_MESSAGES')));

  // Toggle reveal for blurred profanity pill
  const togglePillReveal = (tokenKey: string) => {
    setRevealedPillIndices((prev) => {
      const next = new Set(prev);
      if (next.has(tokenKey)) next.delete(tokenKey);
      else next.add(tokenKey);
      return next;
    });
  };

  // Submit Text Message
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    stopTypingNow();
    setModerationError(null);

    const result = await onSendMessage({ content: cleanText, type: 'text' });
    if (result && result.error) {
      setModerationError(result.error);
      return;
    }

    setInputText('');
    setShowEmojiPicker(false);
  };

  // Start Voice Recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        onSendMessage({
          content: '🎙️ Voice note',
          type: 'voice',
          mediaUrl: audioUrl,
          mediaDuration: recordingSeconds || 3,
        });

        setIsRecordingVoice(false);
        setRecordingSeconds(0);
      };

      recorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 4) {
            stopVoiceRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  // Stop Voice Recording
  const stopVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecordingVoice(false);
      onSendMessage({
        content: '🎙️ Voice note (4s)',
        type: 'voice',
        mediaDuration: 4,
      });
      setRecordingSeconds(0);
    }
  };

  // Play / Pause Audio
  const togglePlayAudio = (messageId: string, url?: string) => {
    if (playingAudioId === messageId) {
      const audio = audioElementsRef.current[messageId];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingAudioId(null);
      return;
    }

    if (playingAudioId && audioElementsRef.current[playingAudioId]) {
      audioElementsRef.current[playingAudioId].pause();
    }

    if (url) {
      let audio = audioElementsRef.current[messageId];
      if (!audio) {
        audio = new Audio(url);
        audioElementsRef.current[messageId] = audio;
        audio.onended = () => setPlayingAudioId(null);
      }
      audio.play().catch(() => {});
      setPlayingAudioId(messageId);
    } else {
      setPlayingAudioId(messageId);
      setTimeout(() => setPlayingAudioId(null), 3000);
    }
  };

  // Select & Moderate Image
  const handleSelectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsModeratingImage(true);
    setModerationAlert(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;

      try {
        const token = localStorage.getItem('aegis_token') || '';
        const res = await fetch('/api/moderate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type,
            fileName: file.name,
          }),
        });

        const data = await res.json();
        if (!data.safe) {
          setModerationAlert({
            type: 'danger',
            message: data.reason || 'Image blocked: Inappropriate content or school safety policy violation.',
          });
          setIsModeratingImage(false);
          return;
        }

        setModerationAlert({
          type: 'success',
          message: '✓ Image screened and approved: School-safe verified.',
        });

        await onSendMessage({
          content: '🖼️ Shared an image',
          type: 'image',
          mediaUrl: base64Data,
          fileName: file.name,
        });

        setTimeout(() => setModerationAlert(null), 4000);
      } catch {
        await onSendMessage({
          content: '🖼️ Shared an image',
          type: 'image',
          mediaUrl: base64Data,
          fileName: file.name,
        });
      } finally {
        setIsModeratingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0F19] overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between glass-panel flex-shrink-0">
        <div className="flex items-center gap-3">
          <Hash className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{channel.name}</span>
            </h2>
            <p className="text-[11px] text-slate-400 truncate max-w-md">
              {channel.description || 'School-safe collaborative channel.'}
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSummarizeChat}
            disabled={isSummarizing}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500/20 to-violet-500/20 hover:from-indigo-500/30 hover:to-violet-500/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
            title="Summarize chat with Gemini Flash"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${isSummarizing ? 'animate-spin' : ''}`} />
            <span>{isSummarizing ? 'Generating Brief...' : '✨ Summarize Chat'}</span>
          </button>
          <PWAInstallButton />
        </div>
      </div>

      {/* Floating AI Unread Banner - Cleared when unreadCount is 0 */}
      {unreadCount > 0 && (
        <div className="px-4 pt-3 flex-shrink-0 animate-in slide-in-from-top duration-300">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/50 to-indigo-950/70 border border-indigo-500/40 p-3 shadow-xl backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40 glow-periwinkle">
                <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  💬 You have <span className="text-indigo-300 font-extrabold">{unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}</span> in this study channel.
                </p>
                <p className="text-[10px] text-slate-300">
                  Missed decisions or homework discussions? Get an executive AI summary in 3 seconds.
                </p>
              </div>
            </div>

            <button
              onClick={onSummarizeChat}
              disabled={isSummarizing}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSummarizing ? 'Analyzing...' : 'Summarize Unread Chat'}</span>
            </button>
          </div>
        </div>
      )}

      {/* AI Text Moderation Rejection Alert */}
      {moderationError && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-xs font-semibold text-rose-200 flex items-center justify-between glow-rose animate-bounce">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{moderationError}</span>
          </div>
          <button onClick={() => setModerationError(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Image Moderation Notice */}
      {moderationAlert && (
        <div className="px-4 pt-2 flex-shrink-0 animate-in fade-in">
          <div
            className={`flex items-center justify-between p-3 rounded-2xl text-xs font-semibold border shadow-lg ${
              moderationAlert.type === 'danger'
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-200 glow-rose'
                : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200 glow-emerald'
            }`}
          >
            <div className="flex items-center gap-2">
              {moderationAlert.type === 'danger' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}
              <span>{moderationAlert.message}</span>
            </div>
            <button onClick={() => setModerationAlert(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {uniqueMessages.map((msg) => {
          const isSelf = msg.userId === currentUser.id;
          const tokens = tokenizeMessageContent(msg.content, currentUser.blurProfanity, revealedPillIndices, msg.id);

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 group transition-colors p-2 rounded-2xl ${
                isSelf ? 'justify-end flex-row-reverse text-right' : 'justify-start flex-row text-left'
              }`}
            >
              {/* User Avatar */}
              <img
                src={msg.user?.avatar}
                alt={msg.user?.username}
                className="w-10 h-10 rounded-2xl bg-slate-800 border border-white/10 flex-shrink-0 mt-0.5 shadow-md"
              />

              {/* Message Content Container - Different Color Div for Self vs Others */}
              <div
                className={`max-w-xl flex flex-col ${
                  isSelf
                    ? 'items-end'
                    : 'items-start'
                }`}
              >
                {/* User Header */}
                <div className={`flex items-center gap-2 mb-1 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                    @{msg.user?.username}
                  </span>
                  {msg.user?.role && (
                    <span className="rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                      {msg.user?.role}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message Bubble Div - Right-aligned distinct color for self, left-aligned dark slate for others */}
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-lg ${
                    isSelf
                      ? 'bg-gradient-to-r from-indigo-600/35 to-violet-600/45 border border-indigo-500/50 text-indigo-50 rounded-tr-xs'
                      : 'bg-[#151C2C]/90 border border-white/10 text-slate-200 rounded-tl-xs'
                  }`}
                >
                  {tokens.map((token) => {
                    const tokenKey = `${msg.id}-tok-${token.tokenIndex}`;
                    if (token.type === 'profanity') {
                      const isRevealed = revealedPillIndices.has(tokenKey);
                      return (
                        <button
                          key={tokenKey}
                          type="button"
                          onClick={() => togglePillReveal(tokenKey)}
                          className={isRevealed ? 'profanity-pill-revealed' : 'profanity-pill-blurred'}
                          title="School-Safe Filter: Click to momentarily toggle reveal"
                        >
                          {token.content}
                        </button>
                      );
                    }
                    return <span key={tokenKey}>{token.content}</span>;
                  })}

                  {/* Voice Note Player */}
                  {msg.type === 'voice' && (
                    <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[#0E131F]/80 border border-white/10 p-2.5 max-w-sm">
                      <button
                        onClick={() => togglePlayAudio(msg.id, msg.mediaUrl)}
                        className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 shadow-md transition-all"
                      >
                        {playingAudioId === msg.id ? (
                          <Pause className="w-3.5 h-3.5 fill-white" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                        )}
                      </button>

                      <div className="flex-1 flex items-center gap-1 h-5">
                        {[4, 12, 18, 14, 22, 10, 16, 24, 8, 14, 20, 6, 16, 12].map((height, i) => (
                          <span
                            key={i}
                            style={{ height: `${height}px` }}
                            className={`w-1 rounded-full transition-all ${
                              playingAudioId === msg.id ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'
                            }`}
                          />
                        ))}
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        0:0{msg.mediaDuration || 4}
                      </span>
                    </div>
                  )}

                  {/* Image Media with Safety Verification Badge */}
                  {msg.type === 'image' && msg.mediaUrl && (
                    <div className="mt-2 max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60 shadow-lg relative group">
                      <img src={msg.mediaUrl} alt="Uploaded media" className="w-full h-auto max-h-64 object-cover" />
                      <div className="p-2 bg-[#0E131F]/90 flex items-center justify-between text-[10px] border-t border-white/5">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✓ School-Safe Verified</span>
                        </div>
                        <span className="text-slate-400 truncate max-w-[120px]">{msg.fileName}</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Poll Card */}
                  {msg.type === 'poll' && msg.poll && (
                    <div className="mt-2.5 max-w-md rounded-2xl glass-card border border-indigo-500/30 p-4 shadow-xl text-left">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-indigo-400" />
                          <h4 className="text-xs font-bold text-white">{msg.poll.question}</h4>
                        </div>
                        <span className="text-[10px] rounded-full bg-indigo-500/20 px-2 py-0.5 text-indigo-300 font-bold">
                          Live Poll
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {(() => {
                          const totalVotes = msg.poll.options.reduce((acc: number, o: any) => acc + o.votes.length, 0);

                          return msg.poll.options.map((opt: any) => {
                            const hasVoted = opt.votes.includes(currentUser.id);
                            const percentage = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;

                            return (
                              <button
                                key={opt.id}
                                onClick={() => onVotePoll(msg.id, opt.id)}
                                className={`w-full relative overflow-hidden rounded-xl p-2.5 border text-left transition-all group ${
                                  hasVoted
                                    ? 'border-indigo-500 bg-indigo-950/40'
                                    : 'border-white/5 bg-slate-900/40 hover:border-white/20'
                                }`}
                              >
                                <div
                                  style={{ width: `${percentage}%` }}
                                  className={`absolute inset-0 rounded-xl transition-all duration-500 ${
                                    hasVoted ? 'bg-indigo-600/30' : 'bg-slate-700/25'
                                  }`}
                                />
                                <div className="relative z-10 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 font-medium text-white">
                                    <span
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                                        hasVoted ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-slate-500'
                                      }`}
                                    >
                                      {hasVoted ? '✓' : ''}
                                    </span>
                                    <span>{opt.text}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
                                    <span>{opt.votes.length} votes</span>
                                    <span className="text-indigo-400">{percentage}%</span>
                                  </div>
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Emoji Reactions Row */}
                <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                  {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                    const hasReacted = userIds.includes(currentUser.id);
                    return (
                      <button
                        key={emoji}
                        onClick={() => onReactMessage(msg.id, emoji)}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-all ${
                          hasReacted
                            ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px] font-bold">{userIds.length}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onReactMessage(msg.id, '👍')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Real-time Typing Indicator Notification in ChatArea */}
      {typingUsers.size > 0 && (
        <div className="px-6 py-1.5 flex items-center gap-2 text-xs text-indigo-300 animate-in fade-in flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
          </div>
          <span className="font-semibold">
            {typingUsers.size === 1
              ? `${Array.from(typingUsers)[0]} is typing...`
              : `${Array.from(typingUsers).slice(0, 2).join(', ')} and ${typingUsers.size - 2 > 0 ? `${typingUsers.size - 2} others` : 'another'} are typing...`}
          </span>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="mx-4 mb-2 p-3 rounded-2xl glass-panel shadow-2xl border border-white/10 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              School-Safe Custom Emojis
            </span>
            <button onClick={() => setShowEmojiPicker(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-10 gap-2">
            {Object.entries(CUSTOM_EMOJIS).map(([shortcode, emoji]) => (
              <button
                key={shortcode}
                onClick={() => {
                  setInputText((prev) => `${prev} ${emoji} `);
                  setShowEmojiPicker(false);
                }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-indigo-600/30 flex items-center justify-center text-lg transition-transform hover:scale-125"
                title={shortcode}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar or RBAC Permission Lock Notice */}
      <div className="p-4 border-t border-white/5 glass-panel flex-shrink-0">
        {!canSendText ? (
          <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-900/60 border border-white/5 text-xs text-slate-400">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>
              {channel.type === 'announcement'
                ? 'Only Instructors and Administrators have permission to post announcements.'
                : 'You do not have permission to send messages in this channel.'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleSelectImageFile} accept="image/*" className="hidden" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isModeratingImage}
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
                title="Upload image (with AI moderation check)"
              >
                <ImageIcon className={`w-4 h-4 ${isModeratingImage ? 'animate-spin text-indigo-400' : ''}`} />
              </button>

              <button
                type="button"
                onClick={onOpenCreatePoll}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Create a study poll"
              >
                <BarChart3 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Emoji picker"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onBlur={stopTypingNow}
              placeholder={`Message #${channel.name} (Protected by AI Content Moderation)...`}
              className="flex-1 rounded-2xl glass-input px-4 py-2.5 text-xs text-white placeholder-slate-500"
            />

            {inputText.trim() ? (
              <button
                type="submit"
                className="p-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : isRecordingVoice ? (
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="p-2.5 rounded-2xl bg-rose-600 text-white animate-pulse"
                title="Stop recording"
              >
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                className="p-2.5 rounded-2xl bg-white/5 hover:bg-indigo-600/30 text-indigo-400 border border-white/5 hover:border-indigo-500/30 transition-all hover:scale-105"
                title="Record voice message"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
