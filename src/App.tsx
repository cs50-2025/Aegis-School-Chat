import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { ServerData, Channel, Message, User, AISummaryData } from './types';
import { AuthScreen } from './components/AuthScreen';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { DirectMessagesView } from './components/DirectMessagesView';
import { VoiceAndScreenStage } from './components/VoiceAndScreenStage';
import { MemberList } from './components/MemberList';
import { AISummaryModal } from './components/AISummaryModal';
import { CreatePollModal } from './components/CreatePollModal';
import { CreateServerModal } from './components/CreateServerModal';
import { ServerRolesModal } from './components/ServerRolesModal';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { soundService } from './utils/soundService';
import { getSocket } from './utils/socket';

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('aegis_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // App navigation state (null activeServerId = Direct Messages / Friends view)
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeDMId, setActiveDMId] = useState<string | null>(null);

  // Data states
  const [servers, setServers] = useState<ServerData[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState<number>(0);
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>({});

  // Modals state
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [activeSummary, setActiveSummary] = useState<AISummaryData | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Authenticate on initial mount
  useEffect(() => {
    const token = localStorage.getItem('aegis_token');
    if (!token) {
      setIsLoadingAuth(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          setAuthToken(token);
          getSocket(token);
        }
      })
      .catch(() => {
        localStorage.removeItem('aegis_token');
        setAuthToken(null);
        setCurrentUser(null);
      })
      .finally(() => {
        setIsLoadingAuth(false);
      });
  }, []);

  // Request browser Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch servers, users, and friend requests when authenticated
  const refreshAppData = useCallback(() => {
    if (!authToken) return;
    const headers = { Authorization: `Bearer ${authToken}` };

    fetch('/api/servers', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.servers) {
          setServers((prev) => {
            const map = new Map<string, ServerData>();
            for (const s of data.servers) {
              if (s && s.id) map.set(s.id, s);
            }
            return Array.from(map.values());
          });
        }
      })
      .catch((err) => console.warn('Could not fetch servers:', err));

    fetch('/api/users/search', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setAllUsers(data.users);
      })
      .catch((err) => console.warn('Could not fetch users:', err));

    fetch('/api/friends', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.incomingRequests) {
          setPendingFriendRequestsCount(data.incomingRequests.length);
        }
      })
      .catch((err) => console.warn('Could not fetch friends:', err));
  }, [authToken]);

  useEffect(() => {
    if (currentUser && authToken) {
      refreshAppData();
      getSocket(authToken);
    }
  }, [currentUser, authToken, refreshAppData]);

  // Connect to SSE and Socket.io for Real-Time Updates
  useEffect(() => {
    if (!authToken || !currentUser) return;

    const socket = getSocket(authToken);
    socket.emit('register_user', { userId: currentUser.id });

    const onNewServerMessage = (msg: Message) => {
      if (msg.channelId) {
        if (currentUser && msg.userId !== currentUser.id) {
          soundService.playMessageNotification();
        }
        setMessages((prev) => {
          const list = prev[msg.channelId!] || [];
          if (list.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [msg.channelId!]: [...list, msg] };
        });
      }
    };

    const onUserStatusChanged = (data: { userId: string; status: 'online' | 'idle' | 'dnd' | 'offline' }) => {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === data.userId ? { ...u, status: data.status } : u))
      );
    };

    socket.on('new_message', onNewServerMessage);
    socket.on('user_status_changed', onUserStatusChanged);

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/events?token=${encodeURIComponent(authToken)}`);

      eventSource.addEventListener('new_message', (e) => {
        const msg = JSON.parse(e.data) as Message;
        onNewServerMessage(msg);
      });

      eventSource.addEventListener('user_status_changed', (e) => {
        try {
          const data = JSON.parse(e.data);
          onUserStatusChanged(data);
        } catch {}
      });

      eventSource.addEventListener('new_dm_message', (e) => {
        try {
          const dmMsg = JSON.parse(e.data) as Message;
          window.dispatchEvent(new CustomEvent('aegis:new_dm_message', { detail: dmMsg }));
        } catch (err) {
          console.warn('Error parsing new_dm_message', err);
        }
      });

      eventSource.addEventListener('user_typing', (e) => {
        try {
          const typingData = JSON.parse(e.data);
          window.dispatchEvent(new CustomEvent('aegis:user_typing', { detail: typingData }));
        } catch {}
      });

      eventSource.addEventListener('friend_request_received', () => {
        setPendingFriendRequestsCount((prev) => prev + 1);
        confetti({ particleCount: 25, spread: 50, origin: { y: 0.2 } });
        window.dispatchEvent(new CustomEvent('aegis:refresh_friends'));
      });

      eventSource.addEventListener('friend_accepted', () => {
        refreshAppData();
        window.dispatchEvent(new CustomEvent('aegis:refresh_friends'));
      });

      eventSource.addEventListener('poll_updated', (e) => {
        const { channelId, messageId, poll } = JSON.parse(e.data);
        if (channelId) {
          setMessages((prev) => {
            const list = prev[channelId] || [];
            return {
              ...prev,
              [channelId]: list.map((m) => (m.id === messageId ? { ...m, poll } : m)),
            };
          });
        }
      });

      eventSource.addEventListener('reaction_updated', (e) => {
        const { channelId, messageId, reactions } = JSON.parse(e.data);
        if (channelId) {
          setMessages((prev) => {
            const list = prev[channelId] || [];
            return {
              ...prev,
              [channelId]: list.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
            };
          });
        }
      });

      eventSource.addEventListener('channel_created', (e) => {
        const { serverId, channel } = JSON.parse(e.data);
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, channels: [...s.channels, channel] } : s))
        );
      });

      eventSource.addEventListener('server_created', (e) => {
        const newServer = JSON.parse(e.data);
        setServers((prev) => {
          if (prev.some((s) => s.id === newServer.id)) return prev;
          return [...prev, newServer];
        });
      });

      eventSource.addEventListener('server_roles_updated', (e) => {
        const { serverId, roles } = JSON.parse(e.data);
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, roles } : s))
        );
      });

      eventSource.addEventListener('server_member_roles_updated', (e) => {
        const { serverId, targetUserId, roleIds } = JSON.parse(e.data);
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? {
                  ...s,
                  memberRoles: { ...s.memberRoles, [targetUserId]: roleIds },
                }
              : s
          )
        );
      });
    } catch (err) {
      console.warn('SSE connection unavailable', err);
    }

    return () => {
      socket.off('new_message', onNewServerMessage);
      socket.off('user_status_changed', onUserStatusChanged);
      eventSource?.close();
    };
  }, [authToken, currentUser, refreshAppData]);

  // Load Channel Messages when activeChannelId changes
  useEffect(() => {
    if (!activeChannelId || !authToken) return;

    fetch(`/api/channels/${activeChannelId}/messages`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          const map = new Map<string, Message>();
          for (const m of data.messages) {
            if (m && m.id) map.set(m.id, m);
          }
          const loadedMsgs = Array.from(map.values());
          setMessages((prev) => ({
            ...prev,
            [activeChannelId]: loadedMsgs,
          }));

          // Mark read automatically when loading channel messages
          if (loadedMsgs.length > 0) {
            const latest = loadedMsgs[loadedMsgs.length - 1];
            setLastReadMap((prev) => ({ ...prev, [activeChannelId]: latest.id }));
            fetch(`/api/channels/${activeChannelId}/read`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ messageId: latest.id }),
            }).catch(() => {});
          }
        }
      })
      .catch((err) => console.warn('Could not fetch channel messages:', err));
  }, [activeChannelId, authToken]);

  // Active Server & Channel
  const activeServer = useMemo(() => {
    if (!activeServerId) return null;
    return servers.find((s) => s.id === activeServerId) || null;
  }, [servers, activeServerId]);

  const activeChannel = useMemo(() => {
    if (!activeServer) return null;
    return activeServer.channels.find((c) => c.id === activeChannelId) || activeServer.channels[0] || null;
  }, [activeServer, activeChannelId]);

  // Handle Channel Selection - Instantly clears unread count & banners
  const handleSelectChannel = useCallback(
    (channelId: string) => {
      setActiveChannelId(channelId);

      // Instantly mark as read in local state
      const channelMsgs = messages[channelId] || [];
      const latestMsg = channelMsgs[channelMsgs.length - 1];
      const readId = latestMsg ? latestMsg.id : 'all_read';

      setLastReadMap((prev) => ({
        ...prev,
        [channelId]: readId,
      }));

      if (authToken && latestMsg) {
        fetch(`/api/channels/${channelId}/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ messageId: latestMsg.id }),
        }).catch(() => {});
      }
    },
    [messages, authToken]
  );

  // Calculate unread count per channel (Active channel is always 0)
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!activeServer) return counts;

    for (const chan of activeServer.channels) {
      if (chan.id === activeChannelId) {
        counts[chan.id] = 0;
        continue;
      }
      const channelMsgs = messages[chan.id] || [];
      const lastReadId = lastReadMap[chan.id];
      if (!lastReadId) {
        counts[chan.id] = channelMsgs.length;
      } else {
        const lastIndex = channelMsgs.findIndex((m) => m.id === lastReadId);
        counts[chan.id] = lastIndex >= 0 ? channelMsgs.length - 1 - lastIndex : 0;
      }
    }
    return counts;
  }, [activeServer, messages, lastReadMap, activeChannelId]);

  // Send message in Server Channel
  const handleSendMessage = async (params: {
    content: string;
    type?: 'text' | 'voice' | 'image' | 'poll';
    mediaUrl?: string;
    mediaDuration?: number;
    fileName?: string;
  }): Promise<{ error?: string; blocked?: boolean } | void> => {
    if (!activeChannel || !authToken) return;

    try {
      const res = await fetch(`/api/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content: params.content,
          type: params.type || 'text',
          mediaUrl: params.mediaUrl,
          mediaDuration: params.mediaDuration,
          fileName: params.fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Failed to send message', blocked: data.blocked };
      }

      if (data.message && data.message.id) {
        setMessages((prev) => {
          const list = prev[activeChannel.id] || [];
          if (list.some((m) => m.id === data.message.id)) return prev;
          return {
            ...prev,
            [activeChannel.id]: [...list, data.message],
          };
        });
        setLastReadMap((prev) => ({
          ...prev,
          [activeChannel.id]: data.message.id,
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending message';
      return { error: msg };
    }
  };

  // Launch Poll in active server channel
  const handleCreatePoll = async (question: string, optionTexts: string[]) => {
    if (!activeChannel || !authToken) return;

    const poll = {
      id: `poll_${Date.now()}`,
      question,
      options: optionTexts.map((text, i) => ({
        id: `opt_${i + 1}`,
        text,
        votes: [],
      })),
      creatorId: currentUser?.id || '',
      closed: false,
    };

    try {
      const res = await fetch(`/api/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content: `📊 New Poll: ${question}`,
          type: 'poll',
          poll,
        }),
      });

      const data = await res.json();
      if (data.message && data.message.id) {
        setMessages((prev) => {
          const list = prev[activeChannel.id] || [];
          if (list.some((m) => m.id === data.message.id)) return prev;
          return {
            ...prev,
            [activeChannel.id]: [...list, data.message],
          };
        });
      }
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
    } catch (err) {
      console.error('Failed to create poll:', err);
    }
  };

  // Vote on Poll
  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!activeChannel || !authToken) return;

    try {
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channelId: activeChannel.id,
          messageId,
          optionId,
        }),
      });

      const data = await res.json();
      if (data.poll) {
        setMessages((prev) => ({
          ...prev,
          [activeChannel.id]: (prev[activeChannel.id] || []).map((m) =>
            m.id === messageId ? { ...m, poll: data.poll } : m
          ),
        }));
        confetti({ particleCount: 20, spread: 45, origin: { y: 0.7 } });
      }
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    }
  };

  // React to Message
  const handleReactMessage = async (messageId: string, emoji: string) => {
    if (!activeChannel || !authToken) return;

    try {
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channelId: activeChannel.id,
          emoji,
        }),
      });

      const data = await res.json();
      if (data.reactions) {
        setMessages((prev) => ({
          ...prev,
          [activeChannel.id]: (prev[activeChannel.id] || []).map((m) =>
            m.id === messageId ? { ...m, reactions: data.reactions } : m
          ),
        }));
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  // AI Chat Summarizer
  const handleSummarizeChat = async () => {
    if (!activeChannel || !authToken) return;

    setIsSummarizing(true);
    const channelMsgs = messages[activeChannel.id] || [];
    const lastReadId = lastReadMap[activeChannel.id];
    let unreadList = channelMsgs;

    if (lastReadId) {
      const idx = channelMsgs.findIndex((m) => m.id === lastReadId);
      if (idx >= 0 && idx < channelMsgs.length - 1) {
        unreadList = channelMsgs.slice(idx + 1);
      }
    }

    try {
      const res = await fetch('/api/summarize-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channelId: activeChannel.id,
          unreadMessages: unreadList,
        }),
      });

      const data = await res.json();
      setActiveSummary({
        overview: data.overview || 'Summary of recent discussion.',
        keyDecisions: data.keyDecisions || [],
        questionsRaised: data.questionsRaised || [],
        actionItems: data.actionItems || [],
        model: data.model || 'Gemini 3.8 Flash',
      });
      setIsSummaryOpen(true);
    } catch (err) {
      console.error('Summarize error:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Mark channel as read
  const handleMarkChannelRead = async () => {
    if (!activeChannel || !authToken) return;
    const channelMsgs = messages[activeChannel.id] || [];
    if (channelMsgs.length === 0) return;

    const latestMsg = channelMsgs[channelMsgs.length - 1];
    setLastReadMap((prev) => ({
      ...prev,
      [activeChannel.id]: latestMsg.id,
    }));

    try {
      await fetch(`/api/channels/${activeChannel.id}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messageId: latestMsg.id }),
      });
    } catch (err) {
      console.warn('Could not persist read receipt:', err);
    }
  };

  // Create Server
  const handleCreateServer = async (
    name: string,
    description: string,
    icon: string,
    bannerColor: string
  ) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name, description, icon, bannerColor }),
      });
      const data = await res.json();
      if (data.server && data.server.id) {
        setServers((prev) => {
          if (prev.some((s) => s.id === data.server.id)) return prev;
          return [...prev, data.server];
        });
        setActiveServerId(data.server.id);
        if (data.server.channels && data.server.channels[0]) {
          handleSelectChannel(data.server.channels[0].id);
        }
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err) {
      console.error('Failed to create server:', err);
    }
  };

  // Join Server via Invite Code
  const handleJoinServerByCode = async (inviteCode: string) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/servers/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();
      if (data.server) {
        setServers((prev) => {
          if (prev.some((s) => s.id === data.server.id)) return prev;
          return [...prev, data.server];
        });
        setActiveServerId(data.server.id);
        if (data.server.channels && data.server.channels[0]) {
          handleSelectChannel(data.server.channels[0].id);
        }
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.5 } });
      }
    } catch (err) {
      console.error('Failed to join server:', err);
    }
  };

  // Add Channel to Server
  const handleAddChannel = async (
    serverId: string,
    name: string,
    type: 'text' | 'voice' | 'announcement'
  ) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name, type }),
      });
      const data = await res.json();
      if (data.channel) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, channels: [...s.channels, data.channel] } : s))
        );
        handleSelectChannel(data.channel.id);
      }
    } catch (err) {
      console.error('Failed to add channel:', err);
    }
  };

  // RBAC: Update Role
  const handleUpdateRole = async (
    roleId: string,
    name: string,
    color: string,
    permissions: string[]
  ) => {
    if (!activeServer || !authToken) return;
    try {
      const res = await fetch(`/api/servers/${activeServer.id}/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name, color, permissions }),
      });
      const data = await res.json();
      if (data.role) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === activeServer.id
              ? {
                  ...s,
                  roles: s.roles.map((r) => (r.id === roleId ? data.role : r)),
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  // RBAC: Create Custom Role
  const handleCreateRole = async (name: string, color: string, permissions: string[]) => {
    if (!activeServer || !authToken) return;
    try {
      const res = await fetch(`/api/servers/${activeServer.id}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name, color, permissions }),
      });
      const data = await res.json();
      if (data.role) {
        setServers((prev) =>
          prev.map((s) => (s.id === activeServer.id ? { ...s, roles: [...s.roles, data.role] } : s))
        );
      }
    } catch (err) {
      console.error('Failed to create role:', err);
    }
  };

  // RBAC: Assign Member Role
  const handleAssignMemberRole = async (targetUserId: string, roleIds: string[]) => {
    if (!activeServer || !authToken) return;
    try {
      const res = await fetch(`/api/servers/${activeServer.id}/members/${targetUserId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ roleIds }),
      });
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === activeServer.id
              ? {
                  ...s,
                  memberRoles: { ...s.memberRoles, [targetUserId]: roleIds },
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error('Failed to assign member role:', err);
    }
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: Partial<User>) => {
    if (!currentUser || !authToken) return;
    setCurrentUser((prev) => (prev ? { ...prev, ...newSettings } : null));

    fetch('/api/auth/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(newSettings),
    }).catch((err) => console.warn('Could not sync user settings to server:', err));
  };

  // Sign Out
  const handleSignOut = () => {
    localStorage.removeItem('aegis_token');
    setAuthToken(null);
    setCurrentUser(null);
    setActiveServerId(null);
    setActiveChannelId(null);
    setActiveDMId(null);
  };

  // If loading session
  if (isLoadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0F19] text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 animate-spin" />
          <span className="text-xs font-semibold">Initializing Aegis Security...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated: Sign In / Create Account
  if (!currentUser || !authToken) {
    return (
      <AuthScreen
        onAuthSuccess={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
          getSocket(token);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19] text-slate-100 font-sans antialiased">
      <OfflineIndicator />

      {/* 1. Leftmost Server Rail */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={(srvId) => {
          setActiveServerId(srvId);
          if (srvId) {
            const srv = servers.find((s) => s.id === srvId);
            if (srv && srv.channels.length > 0) {
              handleSelectChannel(srv.channels[0].id);
            }
          }
        }}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        pendingFriendRequestsCount={pendingFriendRequestsCount}
      />

      {/* 2. Center Content: If activeServerId === null, render Direct Messages View! */}
      {activeServerId === null ? (
        <DirectMessagesView
          currentUser={currentUser}
          activeDMId={activeDMId}
          onSelectDM={(dmId) => setActiveDMId(dmId)}
          allUsers={allUsers}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : (
        /* Server View with Channel Sidebar and Chat Area */
        <>
          {activeServer && (
            <ChannelSidebar
              server={activeServer}
              activeChannelId={activeChannelId || activeServer.channels[0]?.id}
              onSelectChannel={handleSelectChannel}
              currentUser={currentUser}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenRoles={() => setIsRolesModalOpen(true)}
              onAddChannel={handleAddChannel}
              unreadCounts={unreadCounts}
            />
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            {activeChannel?.type === 'voice' ? (
              <VoiceAndScreenStage
                channel={activeChannel}
                currentUser={currentUser}
                users={allUsers.length > 0 ? allUsers : [currentUser]}
                onLeave={() => {
                  const textChan = activeServer?.channels.find((c) => c.type === 'text');
                  if (textChan) handleSelectChannel(textChan.id);
                }}
              />
            ) : activeChannel ? (
              <ChatArea
                channel={activeChannel}
                server={activeServer || undefined}
                messages={messages[activeChannel.id] || []}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onOpenCreatePoll={() => setIsCreatePollOpen(true)}
                onVotePoll={handleVotePoll}
                onReactMessage={handleReactMessage}
                unreadCount={activeChannel ? unreadCounts[activeChannel.id] || 0 : 0}
                onSummarizeChat={handleSummarizeChat}
                isSummarizing={isSummarizing}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Select a channel to start collaborating.
              </div>
            )}
          </div>

          {activeChannel?.type !== 'voice' && (
            <MemberList
              users={allUsers.length > 0 ? allUsers : [currentUser]}
              currentUserId={currentUser.id}
            />
          )}
        </>
      )}

      {/* Modals */}
      <AISummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summary={activeSummary}
        channelName={activeChannel?.name || 'study-channel'}
        onMarkRead={handleMarkChannelRead}
      />

      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        onSubmit={handleCreatePoll}
      />

      <CreateServerModal
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
        onSubmit={handleCreateServer}
        onJoinByCode={handleJoinServerByCode}
      />

      {activeServer && (
        <ServerRolesModal
          isOpen={isRolesModalOpen}
          onClose={() => setIsRolesModalOpen(false)}
          server={activeServer}
          currentUser={currentUser}
          allUsers={allUsers}
          onUpdateRole={handleUpdateRole}
          onCreateRole={handleCreateRole}
          onAssignMemberRole={handleAssignMemberRole}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onUpdateSettings={handleUpdateSettings}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
