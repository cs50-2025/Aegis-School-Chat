import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  UserPlus,
  MessageSquare,
  Phone,
  Video,
  Search,
  Check,
  X,
  Clock,
  Sparkles,
  Send,
  Mic,
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  PhoneOff,
  PhoneCall,
  BarChart3,
  Smile,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, DMChannel, Message, FriendRequest } from '../types';
import { tokenizeMessageContent } from '../utils/profanityFilter';
import { DMCallModal } from './DMCallModal';
import { CreatePollModal } from './CreatePollModal';
import { soundService } from '../utils/soundService';
import { getSocket } from '../utils/socket';

const CUSTOM_EMOJIS: Record<string, string> = {
  ':rocket:': '🚀',
  ':bulb:': '💡',
  ':books:': '📚',
  ':sparkles:': '✨',
  ':brain:': '🧠',
  ':target:': '🎯',
  ':trophy:': '🏆',
  ':fire:': '🔥',
  ':clap:': '👏',
  ':graduation:': '🎓',
  ':computer:': '💻',
  ':pencil:': '✏️',
  ':check:': '✅',
  ':star:': '⭐',
  ':heart:': '❤️',
  ':eyes:': '👀',
  ':raised_hands:': '🙌',
  ':thinking:': '🤔',
  ':thumbsup:': '👍',
  ':party:': '🎉',
};

export const getStatusInfo = (status?: string) => {
  if (status === 'online') {
    return { dotColor: 'bg-emerald-400', label: 'Online', textColor: 'text-emerald-400', isOffline: false };
  }
  if (status === 'idle') {
    return { dotColor: 'bg-amber-400', label: 'Idle', textColor: 'text-amber-400', isOffline: false };
  }
  if (status === 'dnd') {
    return { dotColor: 'bg-rose-400', label: 'Do Not Disturb', textColor: 'text-rose-400', isOffline: false };
  }
  // Offline or disconnected: gray dot and label
  return { dotColor: 'bg-slate-500', label: 'Offline', textColor: 'text-slate-400', isOffline: true };
};

interface DirectMessagesViewProps {
  currentUser: User;
  activeDMId: string | null;
  onSelectDM: (dmId: string | null) => void;
  allUsers: User[];
  onOpenSettings: () => void;
}

export const DirectMessagesView: React.FC<DirectMessagesViewProps> = ({
  currentUser,
  activeDMId,
  onSelectDM,
  allUsers,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'add'>('all');
  const [friends, setFriends] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [requestFeedback, setRequestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // DM Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [revealedPillIndices, setRevealedPillIndices] = useState<Set<string>>(new Set());

  // DM Features: Image, Poll & Emoji Generation
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isModeratingImage, setIsModeratingImage] = useState(false);
  const [moderationAlert, setModerationAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // DM Call state (Voice vs Video)
  const [activeCall, setActiveCall] = useState<{
    targetUser: User;
    initialVideo: boolean;
    isIncomingAnswer?: boolean;
    callId?: string;
  } | null>(null);

  // Manual Incoming Call Alert (Strictly NO automation or fake pickup)
  const [incomingCallAlert, setIncomingCallAlert] = useState<{
    callId: string;
    caller: { id: string; username: string; avatar: string };
    callType: 'voice' | 'video';
  } | null>(null);

  // Real-time DM Typing Indicator
  const [peerIsTyping, setPeerIsTyping] = useState<string | null>(null);
  const dmTypingTimeoutRef = useRef<number | null>(null);
  const isTypingActiveRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Deduplicate messages by id
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (!m || !m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  // Request browser Notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch Friends and Active DMs
  const refreshFriendsAndDMs = () => {
    const token = localStorage.getItem('aegis_token') || '';
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/friends', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.friends) setFriends(data.friends);
        if (data.incomingRequests) setIncomingRequests(data.incomingRequests);
        if (data.outgoingRequests) setOutgoingRequests(data.outgoingRequests);
      })
      .catch((err) => console.warn('Could not fetch friends:', err));

    fetch('/api/dms', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.dms) setDms(data.dms);
      })
      .catch((err) => console.warn('Could not fetch dms:', err));
  };

  useEffect(() => {
    refreshFriendsAndDMs();
  }, [currentUser.id]);

  // Auto-dismiss incoming call banner after 25s if unattended
  useEffect(() => {
    if (!incomingCallAlert) return;
    const timeout = setTimeout(() => {
      soundService.stopRinging();
      setIncomingCallAlert(null);
    }, 25000);
    return () => clearTimeout(timeout);
  }, [incomingCallAlert]);

  // Socket.io DM Events for incoming texts, calls, and typing
  useEffect(() => {
    const socket = getSocket();

    if (activeDMId) {
      socket.emit('join_room', `dm:${activeDMId}`);
    }

    const handleDMTypingStart = (data: { dmId?: string; username: string; userId: string }) => {
      if (data.dmId === activeDMId && data.userId !== currentUser.id) {
        setPeerIsTyping(data.username);
      }
    };

    const handleDMTypingStop = (data: { dmId?: string; username: string; userId: string }) => {
      if (data.dmId === activeDMId) {
        setPeerIsTyping(null);
      }
    };

    // Incoming DM Call: Play ringtone + show notification + require explicit Attend or Decline click
    const handleIncomingCall = (payload: {
      callId: string;
      caller: { id: string; username: string; avatar: string };
      callType: 'voice' | 'video';
    }) => {
      // Ring sound
      soundService.startRinging();

      // Desktop notification on computer
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`📞 @${payload.caller.username} is calling you...`, {
            body: `Incoming ${payload.callType} call on Aegis. Click Attend or Decline.`,
            icon: payload.caller.avatar,
          });
        } catch {}
      }

      // NO AUTOMATION OR FAKE PICK UP: Set incoming alert dialog for recipient to click
      setIncomingCallAlert(payload);
    };

    socket.on('typing_start', handleDMTypingStart);
    socket.on('typing_stop', handleDMTypingStop);
    socket.on('dm_call_incoming', handleIncomingCall);

    return () => {
      if (activeDMId) {
        socket.emit('leave_room', `dm:${activeDMId}`);
      }
      socket.off('typing_start', handleDMTypingStart);
      socket.off('typing_stop', handleDMTypingStop);
      socket.off('dm_call_incoming', handleIncomingCall);
      setPeerIsTyping(null);
    };
  }, [activeDMId, currentUser.id]);

  // Listen to new messages from SSE / custom event
  useEffect(() => {
    const handleNewDM = (e: Event) => {
      const customEv = e as CustomEvent<Message>;
      const newMsg = customEv.detail;
      if (!newMsg) return;

      if (newMsg.dmId === activeDMId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }

      // If text came from the other user: trigger chime + desktop notification with text snippet!
      if (newMsg.userId !== currentUser.id) {
        soundService.playMessageNotification();

        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const snippet = newMsg.content ? newMsg.content.slice(0, 100) : 'Sent an attachment';
            new Notification(`💬 @${newMsg.user?.username || 'Friend'}`, {
              body: snippet,
              icon: newMsg.user?.avatar,
            });
          } catch {}
        }
      }

      refreshFriendsAndDMs();
    };

    const handleRefresh = () => {
      refreshFriendsAndDMs();
    };

    window.addEventListener('aegis:new_dm_message', handleNewDM);
    window.addEventListener('aegis:refresh_friends', handleRefresh);

    return () => {
      window.removeEventListener('aegis:new_dm_message', handleNewDM);
      window.removeEventListener('aegis:refresh_friends', handleRefresh);
    };
  }, [activeDMId, currentUser.id]);

  // Load DM messages when activeDMId changes
  useEffect(() => {
    if (!activeDMId) {
      setMessages([]);
      return;
    }

    const token = localStorage.getItem('aegis_token') || '';
    fetch(`/api/dms/${activeDMId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          const map = new Map<string, Message>();
          for (const m of data.messages) {
            if (m && m.id) map.set(m.id, m);
          }
          setMessages(Array.from(map.values()));
        }
      })
      .catch((err) => console.warn('Could not fetch DM messages:', err));
  }, [activeDMId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Public User Search (guaranteed to find registered users)
  useEffect(() => {
    const token = localStorage.getItem('aegis_token') || '';
    const query = searchQuery.trim();

    fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          setSearchResults(data.users.filter((u: User) => u.id !== currentUser.id));
        }
      })
      .catch((err) => console.warn('User search error:', err));
  }, [searchQuery, currentUser.id, activeTab]);

  // Typing in DM input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    if (!activeDMId) return;
    const socket = getSocket();

    if (!isTypingActiveRef.current && text.trim().length > 0) {
      isTypingActiveRef.current = true;
      socket.emit('typing_start', {
        dmId: activeDMId,
        username: currentUser.username,
        userId: currentUser.id,
      });
    }

    if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
    dmTypingTimeoutRef.current = window.setTimeout(() => {
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        socket.emit('typing_stop', {
          dmId: activeDMId,
          username: currentUser.username,
          userId: currentUser.id,
        });
      }
    }, 1500);
  };

  const stopTyping = () => {
    if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
    if (isTypingActiveRef.current && activeDMId) {
      isTypingActiveRef.current = false;
      const socket = getSocket();
      socket.emit('typing_stop', {
        dmId: activeDMId,
        username: currentUser.username,
        userId: currentUser.id,
      });
    }
  };

  // Send Direct Message
  const handleSendDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDMId) return;
    const cleanText = inputText.trim();
    if (!cleanText) return;

    stopTyping();
    setModerationWarning(null);

    const token = localStorage.getItem('aegis_token') || '';
    try {
      const res = await fetch(`/api/dms/${activeDMId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: cleanText, type: 'text' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModerationWarning(data.error || 'Failed to send message');
        return;
      }

      if (data.message && data.message.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setInputText('');
      }
    } catch {
      setModerationWarning('Network error sending message.');
    }
  };

  // Attend Incoming Call (Explicit Green Button Click)
  const handleAttendCall = () => {
    if (!incomingCallAlert) return;
    soundService.stopRinging();
    const socket = getSocket();

    socket.emit('dm_call_accept', {
      callId: incomingCallAlert.callId,
      callerId: incomingCallAlert.caller.id,
      receiverId: currentUser.id,
      callType: incomingCallAlert.callType,
    });

    const callerUser: User = {
      id: incomingCallAlert.caller.id,
      username: incomingCallAlert.caller.username,
      name: incomingCallAlert.caller.username,
      avatar: incomingCallAlert.caller.avatar,
      status: 'online',
      blurProfanity: true,
      accentColor: '#6366F1',
    };

    setActiveCall({
      targetUser: callerUser,
      initialVideo: incomingCallAlert.callType === 'video',
      isIncomingAnswer: true,
      callId: incomingCallAlert.callId,
    });

    setIncomingCallAlert(null);
  };

  // Decline Incoming Call (Explicit Red Button Click)
  const handleDeclineCall = () => {
    if (!incomingCallAlert) return;
    soundService.stopRinging();
    const socket = getSocket();

    socket.emit('dm_call_decline', {
      callId: incomingCallAlert.callId,
      callerId: incomingCallAlert.caller.id,
      receiverId: currentUser.id,
    });

    setIncomingCallAlert(null);
  };

  // Start Voice Call (Blocked if user is offline)
  const startVoiceCall = (peerUser: User) => {
    if (peerUser.status === 'offline') {
      setRequestFeedback({
        type: 'error',
        message: `@${peerUser.username} is currently offline and cannot attend calls.`,
      });
      setTimeout(() => setRequestFeedback(null), 4000);
      return;
    }

    const socket = getSocket();
    const callId = `call_${Date.now()}`;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    socket.emit('dm_call_initiate', {
      callId,
      caller: {
        id: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
      },
      receiverId: peerUser.id,
      callType: 'voice',
    });

    setActiveCall({
      targetUser: peerUser,
      initialVideo: false,
      isIncomingAnswer: false,
      callId,
    });
  };

  // Start Video Call (Blocked if user is offline)
  const startVideoCall = (peerUser: User) => {
    if (peerUser.status === 'offline') {
      setRequestFeedback({
        type: 'error',
        message: `@${peerUser.username} is currently offline and cannot attend calls.`,
      });
      setTimeout(() => setRequestFeedback(null), 4000);
      return;
    }

    const socket = getSocket();
    const callId = `call_${Date.now()}`;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    socket.emit('dm_call_initiate', {
      callId,
      caller: {
        id: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
      },
      receiverId: peerUser.id,
      callType: 'video',
    });

    setActiveCall({
      targetUser: peerUser,
      initialVideo: true,
      isIncomingAnswer: false,
      callId,
    });
  };

  // Create Poll in DM
  const handleCreatePoll = async (question: string, options: string[]) => {
    if (!activeDMId) return;
    const pollData = {
      question,
      options: options.map((opt, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text: opt,
        votes: [],
      })),
    };

    const token = localStorage.getItem('aegis_token') || '';
    try {
      const res = await fetch(`/api/dms/${activeDMId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: `📊 ${question}`,
          type: 'poll',
          poll: pollData,
        }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (err) {
      console.warn('Failed to post poll in DM:', err);
    }
  };

  // Vote on Poll in DM
  const handleVotePoll = async (messageId: string, optionId: string) => {
    const token = localStorage.getItem('aegis_token') || '';
    try {
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dmId: activeDMId,
          messageId,
          optionId,
        }),
      });

      const data = await res.json();
      if (data.poll) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, poll: data.poll } : m))
        );
      }
    } catch (err) {
      console.warn('Failed to vote on poll:', err);
    }
  };

  // React to Message in DM
  const handleReactMessage = async (messageId: string, emoji: string) => {
    const token = localStorage.getItem('aegis_token') || '';
    try {
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dmId: activeDMId,
          emoji,
        }),
      });

      const data = await res.json();
      if (data.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (err) {
      console.warn('Failed to react:', err);
    }
  };

  // Select & Moderate Image in DM
  const handleSelectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDMId) return;

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

        const sendRes = await fetch(`/api/dms/${activeDMId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: '🖼️ Shared an image',
            type: 'image',
            mediaUrl: base64Data,
            fileName: file.name,
          }),
        });

        const sendData = await sendRes.json();
        if (sendData.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === sendData.message.id)) return prev;
            return [...prev, sendData.message];
          });
        }
        setTimeout(() => setModerationAlert(null), 4000);
      } catch {
        // fallback
      } finally {
        setIsModeratingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  // Send Friend Request
  const handleSendFriendRequest = async (targetUsername: string) => {
    setRequestFeedback(null);
    const token = localStorage.getItem('aegis_token') || '';

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUsername }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRequestFeedback({ type: 'error', message: data.error || 'Could not send friend request' });
      } else {
        setRequestFeedback({ type: 'success', message: data.message || 'Friend request sent!' });
        refreshFriendsAndDMs();
      }
    } catch {
      setRequestFeedback({ type: 'error', message: 'Failed to send request' });
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (requestId: string) => {
    const token = localStorage.getItem('aegis_token') || '';
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (res.ok) {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
        refreshFriendsAndDMs();
        if (data.dmId) onSelectDM(data.dmId);
      }
    } catch {}
  };

  // Decline Friend Request
  const handleDeclineRequest = async (requestId: string) => {
    const token = localStorage.getItem('aegis_token') || '';
    try {
      await fetch('/api/friends/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId }),
      });
      refreshFriendsAndDMs();
    } catch {}
  };

  // Open Direct Message Channel (Guaranteed chat access)
  const handleOpenDM = async (friendId: string) => {
    const token = localStorage.getItem('aegis_token') || '';
    try {
      const res = await fetch('/api/dms/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      });
      const data = await res.json();
      if (data.dm && data.dm.id) {
        onSelectDM(data.dm.id);
        refreshFriendsAndDMs();
      }
    } catch {}
  };

  // Active DM participant
  const activeDM = dms.find((d) => d.id === activeDMId);
  const otherParticipant = activeDM?.participants.find((p) => p.id !== currentUser.id);

  return (
    <div className="flex-1 flex h-full overflow-hidden select-none bg-[#0B0F19]">
      {/* Active Call Modal Overlay */}
      {activeCall && (
        <DMCallModal
          currentUser={currentUser}
          targetUser={activeCall.targetUser}
          initialVideo={activeCall.initialVideo}
          onEndCall={() => {
            soundService.stopRinging();
            soundService.playCallEnd();
            setActiveCall(null);
          }}
        />
      )}

      {/* DM Left Sidebar */}
      <div className="w-64 bg-[#0E131F]/90 border-r border-white/5 flex flex-col justify-between h-full flex-shrink-0">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Direct Messages</span>
            </h2>
          </div>

          {/* Friends Navigation Button */}
          <div className="p-3">
            <button
              onClick={() => onSelectDM(null)}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeDMId === null
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Friends Hub</span>
              </div>
              {incomingRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* DM Conversations List */}
          <div className="px-3 space-y-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Direct Messages ({dms.length})
            </span>
            <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1">
              {dms.map((dm) => {
                const peer = dm.participants.find((p) => p.id !== currentUser.id) || dm.participants[0];
                const isActive = dm.id === activeDMId;

                return (
                  <button
                    key={dm.id}
                    onClick={() => onSelectDM(dm.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-indigo-600/30 text-white border border-indigo-500/40 glow-periwinkle'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img src={peer.avatar} alt={peer.username} className="w-8 h-8 rounded-xl bg-slate-800" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B0F19]" />
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">@{peer.username}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {dm.lastMessage ? dm.lastMessage.content : 'Direct message'}
                      </p>
                    </div>
                  </button>
                );
              })}
              {dms.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-slate-500 leading-relaxed">
                  No active DMs yet. Add a friend or click a user to start chatting!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* User Mini Bar at Bottom */}
        <div className="p-2.5 bg-[#0A0E17] border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 pr-1">
            <img src={currentUser.avatar} alt={currentUser.username} className="w-8 h-8 rounded-xl bg-slate-800" />
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">@{currentUser.username}</p>
              <p className="text-[10px] text-emerald-400 truncate font-semibold">Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Center View: Either Friends Hub or 1-on-1 DM Chat */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {activeDMId === null ? (
          /* ========================================== */
          /* Friends Management Hub                    */
          /* ========================================== */
          <div className="flex-1 flex flex-col h-full bg-[#0B0F19]">
            {/* Top Navigation Bar */}
            <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between glass-panel flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Friends</span>
                </div>
                <div className="h-4 w-[1px] bg-white/10" />

                {/* Tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Friends ({friends.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'pending' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Pending</span>
                    {incomingRequests.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] text-white">
                        {incomingRequests.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('add')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'add'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Friend / Search</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content Area Based on Active Tab */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'add' && (
                <div className="max-w-xl mx-auto space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Search & Add Friends</h3>
                    <p className="text-xs text-slate-400">
                      Usernames are public. Search any person to guarantee you can chat and start a voice or video call!
                    </p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type username (e.g. alex, devon, maya)..."
                      className="w-full rounded-2xl glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono"
                    />
                  </div>

                  {/* Feedback Banner */}
                  {requestFeedback && (
                    <div
                      className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                        requestFeedback.type === 'success'
                          ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-200'
                          : 'bg-rose-950/60 border border-rose-500/30 text-rose-200'
                      }`}
                    >
                      {requestFeedback.type === 'success' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>{requestFeedback.message}</span>
                    </div>
                  )}

                  {/* Registered Users Found in SQL DB */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Public Directory ({searchResults.length})
                    </span>
                    <div className="space-y-2">
                      {searchResults.map((target) => (
                        <div
                          key={target.id}
                          className="flex items-center justify-between p-3 rounded-2xl glass-card border border-white/5 hover:border-indigo-500/30 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <img src={target.avatar} alt={target.username} className="w-10 h-10 rounded-2xl bg-slate-800" />
                            <div>
                              <p className="text-xs font-bold text-white">@{target.username}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-xs">{target.bio || 'Aegis Member'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Add Friend Button */}
                            <button
                              onClick={() => handleSendFriendRequest(target.username)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
                              title="Send Friend Request"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Friend</span>
                            </button>
                          </div>
                        </div>
                      ))}
                      {searchResults.length === 0 && (
                        <p className="text-xs text-slate-500 p-4 text-center rounded-2xl glass-card">
                          No users matching "{searchQuery}". Try typing another username.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pending' && (
                <div className="max-w-xl mx-auto space-y-6">
                  {/* Incoming Requests */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Incoming Requests ({incomingRequests.length})
                    </h3>
                    <div className="space-y-2">
                      {incomingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-3 rounded-2xl glass-card border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <img src={req.fromUser?.avatar} alt={req.fromUser?.username} className="w-10 h-10 rounded-2xl bg-slate-800" />
                            <div>
                              <p className="text-xs font-bold text-white">@{req.fromUser?.username}</p>
                              <p className="text-[11px] text-slate-400">Incoming Friend Request</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAcceptRequest(req.id)}
                              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30"
                              title="Accept Friend"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(req.id)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-rose-600/30 text-rose-300 text-xs font-bold transition-all"
                              title="Decline"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {incomingRequests.length === 0 && (
                        <p className="text-xs text-slate-500 p-4 text-center rounded-2xl glass-card">
                          No incoming friend requests right now.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Outgoing Requests */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Outgoing Requests ({outgoingRequests.length})
                    </h3>
                    <div className="space-y-2">
                      {outgoingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-3 rounded-2xl glass-card border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <img src={req.toUser?.avatar} alt={req.toUser?.username} className="w-10 h-10 rounded-2xl bg-slate-800" />
                            <div>
                              <p className="text-xs font-bold text-white">@{req.toUser?.username}</p>
                              <p className="text-[11px] text-slate-400">Pending</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                            Waiting for acceptance...
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Online Friends Tab */}
              {activeTab === 'online' && (
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Online Friends ({friends.filter((f) => f.status === 'online').length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {friends
                      .filter((f) => f.status === 'online')
                      .map((friend) => {
                        const statusInfo = getStatusInfo(friend.status);
                        return (
                          <div
                            key={friend.id}
                            className="flex items-center justify-between p-3 rounded-2xl glass-card border border-white/5 hover:border-indigo-500/30 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={friend.avatar}
                                  alt={friend.username}
                                  className="w-10 h-10 rounded-2xl bg-slate-800"
                                />
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusInfo.dotColor} border-2 border-[#0B0F19]`}
                                />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">@{friend.username}</p>
                                <p className={`text-[10px] font-semibold ${statusInfo.textColor}`}>
                                  {statusInfo.label}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => startVoiceCall(friend)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-emerald-600/30 text-emerald-300 hover:text-white transition-all border border-white/5"
                                title="Voice Call"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startVideoCall(friend)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-all border border-white/5"
                                title="Video Call"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenDM(friend.id)}
                                className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-all border border-indigo-500/30"
                                title="Direct Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {friends.filter((f) => f.status === 'online').length === 0 && (
                    <div className="p-12 text-center text-xs text-slate-400 rounded-3xl glass-panel space-y-2">
                      <p className="font-semibold text-slate-300">No friends currently online</p>
                      <p className="text-slate-500 text-[11px]">
                        When friends log into the website, their status turns green and they can attend calls.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* All Friends Tab with Online (Green) and Offline (Gray) Icons */}
              {activeTab === 'all' && (
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      All Friends ({friends.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {friends.map((friend) => {
                      const statusInfo = getStatusInfo(friend.status);
                      return (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-3 rounded-2xl glass-card border border-white/5 hover:border-indigo-500/30 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={friend.avatar}
                                alt={friend.username}
                                className={`w-10 h-10 rounded-2xl bg-slate-800 ${
                                  statusInfo.isOffline ? 'opacity-60 grayscale-[35%]' : ''
                                }`}
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusInfo.dotColor} border-2 border-[#0B0F19]`}
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">@{friend.username}</p>
                              <p className={`text-[10px] font-semibold ${statusInfo.textColor}`}>
                                {statusInfo.label}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Voice Call */}
                            <button
                              onClick={() => startVoiceCall(friend)}
                              className={`p-2 rounded-xl transition-all border ${
                                statusInfo.isOffline
                                  ? 'bg-white/5 text-slate-500 border-white/5 opacity-50 cursor-not-allowed'
                                  : 'bg-white/5 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border-white/5'
                              }`}
                              title={statusInfo.isOffline ? 'User is offline' : 'Voice Call'}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>

                            {/* Video Call */}
                            <button
                              onClick={() => startVideoCall(friend)}
                              className={`p-2 rounded-xl transition-all border ${
                                statusInfo.isOffline
                                  ? 'bg-white/5 text-slate-500 border-white/5 opacity-50 cursor-not-allowed'
                                  : 'bg-white/5 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border-white/5'
                              }`}
                              title={statusInfo.isOffline ? 'User is offline' : 'Video Call'}
                            >
                              <Video className="w-3.5 h-3.5" />
                            </button>

                            {/* Message */}
                            <button
                              onClick={() => handleOpenDM(friend.id)}
                              className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-all border border-indigo-500/30"
                              title="Direct Message"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {friends.length === 0 && (
                    <div className="p-12 text-center text-xs text-slate-400 rounded-3xl glass-panel space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                        <UserPlus className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">You have no friends yet</h4>
                      <p className="max-w-xs mx-auto text-slate-400">
                        Search for a classmate by their username in the "Add Friend" tab to start chatting privately!
                      </p>
                      <button
                        onClick={() => setActiveTab('add')}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30"
                      >
                        Find Friends
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================== */
          /* 1-on-1 Private Direct Message Chat Stage   */
          /* ========================================== */
          <div className="flex-1 flex flex-col h-full bg-[#0B0F19] overflow-hidden">
            {/* DM Top Header */}
            <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between glass-panel flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={otherParticipant?.avatar}
                    alt={otherParticipant?.username}
                    className={`w-9 h-9 rounded-2xl bg-slate-800 ${
                      getStatusInfo(otherParticipant?.status).isOffline ? 'opacity-65 grayscale-[30%]' : ''
                    }`}
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                      getStatusInfo(otherParticipant?.status).dotColor
                    } border-2 border-[#0B0F19]`}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>@{otherParticipant?.username}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        getStatusInfo(otherParticipant?.status).isOffline
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {getStatusInfo(otherParticipant?.status).label}
                    </span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-semibold">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    <span>Private & School-Safe Verified</span>
                  </div>
                </div>
              </div>

              {/* Call Buttons for DM: Voice Call and Video Call! */}
              <div className="flex items-center gap-2">
                {otherParticipant && (
                  <>
                    {/* Voice Call Button */}
                    <button
                      onClick={() => startVoiceCall(otherParticipant)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                        getStatusInfo(otherParticipant.status).isOffline
                          ? 'bg-white/5 text-slate-500 border-white/5 opacity-50 cursor-not-allowed'
                          : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border-emerald-500/30'
                      }`}
                      title={getStatusInfo(otherParticipant.status).isOffline ? 'User is offline' : 'Start Voice Call'}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Voice Call</span>
                    </button>

                    {/* Video Call Button */}
                    <button
                      onClick={() => startVideoCall(otherParticipant)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                        getStatusInfo(otherParticipant.status).isOffline
                          ? 'bg-white/5 text-slate-500 border-white/5 opacity-50 cursor-not-allowed'
                          : 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border-indigo-500/30'
                      }`}
                      title={getStatusInfo(otherParticipant.status).isOffline ? 'User is offline' : 'Start Video Call'}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video Call</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AI Text Moderation Alert Banner */}
            {moderationWarning && (
              <div className="p-3 bg-rose-950/80 border-b border-rose-500/40 text-xs text-rose-200 flex items-center justify-between animate-bounce">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{moderationWarning}</span>
                </div>
                <button onClick={() => setModerationWarning(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Image Screening Alert Banner */}
            {moderationAlert && (
              <div
                className={`p-3 text-xs flex items-center justify-between border-b ${
                  moderationAlert.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {moderationAlert.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{moderationAlert.message}</span>
                </div>
                <button onClick={() => setModerationAlert(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Messages Area - Right aligned with distinct color for self, left aligned for others */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {uniqueMessages.map((msg) => {
                const isSelf = msg.userId === currentUser.id;
                const tokens = tokenizeMessageContent(msg.content, currentUser.blurProfanity, revealedPillIndices, msg.id);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 p-2 rounded-2xl group ${
                      isSelf ? 'justify-end flex-row-reverse text-right' : 'justify-start flex-row text-left'
                    }`}
                  >
                    <img
                      src={msg.user?.avatar}
                      alt={msg.user?.username}
                      className="w-9 h-9 rounded-2xl bg-slate-800 mt-0.5 shadow-md flex-shrink-0"
                    />

                    <div className={`max-w-xl flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 mb-1 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs font-bold text-white">@{msg.user?.username}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Bubble Div: Distinct color for self vs others */}
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-lg ${
                          isSelf
                            ? 'bg-gradient-to-r from-indigo-600/35 to-violet-600/45 border border-indigo-500/50 text-indigo-50 rounded-tr-xs'
                            : 'bg-[#151C2C]/90 border border-white/10 text-slate-200 rounded-tl-xs'
                        }`}
                      >
                        {/* 1. Image Attachment Rendering */}
                        {msg.type === 'image' && msg.mediaUrl && (
                          <div className="mb-2">
                            <div className="relative rounded-xl overflow-hidden max-w-sm group/img border border-white/10">
                              <img
                                src={msg.mediaUrl}
                                alt={msg.fileName || 'Shared image'}
                                className="w-full max-h-60 object-cover cursor-pointer hover:scale-102 transition-transform"
                                onClick={() => setZoomImageUrl(msg.mediaUrl || null)}
                              />
                              <button
                                onClick={() => setZoomImageUrl(msg.mediaUrl || null)}
                                className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                title="Zoom image"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[9px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>AI School-Safe Verified</span>
                            </span>
                          </div>
                        )}

                        {/* 2. Poll Rendering */}
                        {msg.type === 'poll' && msg.poll && (
                          <div className="rounded-2xl p-3.5 bg-black/40 border border-indigo-500/30 text-left min-w-[240px] max-w-md my-1">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                              <BarChart3 className="w-4 h-4 text-indigo-400" />
                              <h4 className="text-xs font-bold text-white">{msg.poll.question}</h4>
                            </div>

                            {(() => {
                              const totalVotes = msg.poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
                              return (
                                <div className="space-y-2">
                                  {msg.poll.options.map((option) => {
                                    const hasVoted = option.votes.includes(currentUser.id);
                                    const pct = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
                                    return (
                                      <button
                                        key={option.id}
                                        onClick={() => handleVotePoll(msg.id, option.id)}
                                        className={`w-full text-left p-2.5 rounded-xl border transition-all relative overflow-hidden flex items-center justify-between group/opt ${
                                          hasVoted
                                            ? 'border-indigo-500 bg-indigo-600/30 text-white'
                                            : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
                                        }`}
                                      >
                                        <div
                                          className="absolute inset-0 bg-indigo-500/20 transition-all"
                                          style={{ width: `${pct}%` }}
                                        />
                                        <span className="relative z-10 text-xs font-medium truncate pr-2">
                                          {hasVoted && <span className="text-indigo-400 font-bold mr-1">✓</span>}
                                          {option.text}
                                        </span>
                                        <span className="relative z-10 text-[10px] text-slate-400 font-bold">
                                          {pct}% ({option.votes.length})
                                        </span>
                                      </button>
                                    );
                                  })}
                                  <p className="text-[10px] text-slate-400 text-right mt-1">
                                    {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* 3. Text Content & Profanity Pills */}
                        {msg.type !== 'poll' && (
                          <div>
                            {tokens.map((token) => {
                              const tokenKey = `${msg.id}-tok-${token.tokenIndex}`;
                              if (token.type === 'profanity') {
                                const isRevealed = revealedPillIndices.has(tokenKey);
                                return (
                                  <button
                                    key={tokenKey}
                                    type="button"
                                    onClick={() => {
                                      setRevealedPillIndices((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(tokenKey)) next.delete(tokenKey);
                                        else next.add(tokenKey);
                                        return next;
                                      });
                                    }}
                                    className={isRevealed ? 'profanity-pill-revealed' : 'profanity-pill-blurred'}
                                    title="School-Safe Filter: Click to momentarily toggle reveal"
                                  >
                                    {token.content}
                                  </button>
                                );
                              }
                              return <span key={tokenKey}>{token.content}</span>;
                            })}
                          </div>
                        )}
                      </div>

                      {/* 4. Emoji Reactions List */}
                      <div className={`flex flex-wrap items-center gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        {msg.reactions &&
                          Object.entries(msg.reactions).map(([emoji, userIds]) => {
                            if (!userIds || userIds.length === 0) return null;
                            const hasReacted = userIds.includes(currentUser.id);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReactMessage(msg.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all ${
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
                          onClick={() => handleReactMessage(msg.id, '👍')}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
                          title="React thumbs up"
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

            {/* Real-time Typing Indicator in DM */}
            {peerIsTyping && (
              <div className="px-6 py-1.5 flex items-center gap-2 text-xs text-indigo-300 animate-in fade-in flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                </div>
                <span className="font-semibold">@{peerIsTyping} is typing...</span>
              </div>
            )}

            {/* Emoji Picker Popover in DM */}
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

            {/* DM Input Bar: Image Upload, Poll Creation, Emoji Generation */}
            <div className="p-4 border-t border-white/5 glass-panel flex-shrink-0">
              <form onSubmit={handleSendDM} className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleSelectImageFile}
                  accept="image/*"
                  className="hidden"
                />

                <div className="flex items-center gap-1">
                  {/* Image Upload with AI Moderation */}
                  <button
                    type="button"
                    disabled={isModeratingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
                    title="Upload image (with AI moderation check)"
                  >
                    <ImageIcon className={`w-4 h-4 ${isModeratingImage ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>

                  {/* Poll Creation Button */}
                  <button
                    type="button"
                    onClick={() => setIsCreatePollOpen(true)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Create study poll"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>

                  {/* Emoji Picker Popover Toggle */}
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
                  onBlur={stopTyping}
                  placeholder={`Message @${otherParticipant?.username || 'Friend'} (School-Safe Filter active)...`}
                  className="flex-1 rounded-2xl glass-input px-4 py-2.5 text-xs text-white placeholder-slate-500"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Manual Incoming Call Dialog Alert (User on other side MUST click Green Attend or Red Decline) */}
      {incomingCallAlert && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top duration-300">
          <div className="rounded-3xl glass-panel bg-[#0B0F19]/95 border-2 border-indigo-500/50 p-5 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 max-w-sm w-80 ring-4 ring-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={incomingCallAlert.caller.avatar}
                  alt={incomingCallAlert.caller.username}
                  className="w-12 h-12 rounded-2xl bg-slate-800 ring-2 ring-emerald-400 animate-pulse"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0F19]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>@{incomingCallAlert.caller.username}</span>
                </h4>
                <p className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                  <span>Incoming {incomingCallAlert.callType === 'video' ? 'Video' : 'Voice'} Call...</span>
                </p>
              </div>
            </div>

            {/* Explicit Manual Green Attend Button & Red Decline Button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleAttendCall}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95"
              >
                <Phone className="w-4 h-4" />
                <span>Attend</span>
              </button>

              <button
                onClick={handleDeclineCall}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Poll Modal in DM */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        onSubmit={handleCreatePoll}
      />

      {/* Zoom Image Modal in DM */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden glass-panel border border-white/20 p-2">
            <img src={zoomImageUrl} alt="Full view" className="max-h-[85vh] w-auto object-contain rounded-2xl" />
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Call Modal */}
      {activeCall && (
        <DMCallModal
          currentUser={currentUser}
          targetUser={activeCall.targetUser}
          initialVideo={activeCall.initialVideo}
          isIncomingAnswer={activeCall.isIncomingAnswer}
          callId={activeCall.callId}
          onEndCall={() => setActiveCall(null)}
        />
      )}
    </div>
  );
};
