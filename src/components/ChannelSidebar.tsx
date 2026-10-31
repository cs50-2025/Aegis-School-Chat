import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Megaphone,
  Plus,
  Copy,
  Check,
  Mic,
  MicOff,
  VolumeX,
  Settings,
  Shield,
  ShieldCheck,
  Radio,
  Sliders,
} from 'lucide-react';
import { ServerData, Channel, User } from '../types';

interface ChannelSidebarProps {
  server: ServerData;
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  currentUser: User;
  onOpenSettings: () => void;
  onOpenRoles: () => void;
  onAddChannel: (serverId: string, name: string, type: 'text' | 'voice' | 'announcement') => void;
  unreadCounts: Record<string, number>;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  server,
  activeChannelId,
  onSelectChannel,
  currentUser,
  onOpenSettings,
  onOpenRoles,
  onAddChannel,
  unreadCounts,
}) => {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isSelfMuted, setIsSelfMuted] = useState(false);
  const [isSelfDeafened, setIsSelfDeafened] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanType, setNewChanType] = useState<'text' | 'voice' | 'announcement'>('text');

  const copyInvite = () => {
    navigator.clipboard.writeText(server.inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    onAddChannel(server.id, newChanName.trim(), newChanType);
    setNewChanName('');
    setShowAddChannel(false);
  };

  const isOwner = server.ownerId === currentUser.id;
  const userRoleIds = server.memberRoles[currentUser.id] || [];
  const canManageRoles =
    isOwner ||
    server.roles.some(
      (r) =>
        userRoleIds.includes(r.id) &&
        (r.permissions.includes('ADMINISTRATOR') || r.permissions.includes('MANAGE_ROLES'))
    );

  // Deduplicate channels by id
  const uniqueChannels = React.useMemo(() => {
    const map = new Map<string, Channel>();
    for (const c of server.channels || []) {
      if (c && c.id) map.set(c.id, c);
    }
    return Array.from(map.values());
  }, [server.channels]);

  const announcements = uniqueChannels.filter((c) => c.type === 'announcement');
  const textChannels = uniqueChannels.filter((c) => c.type === 'text');
  const voiceChannels = uniqueChannels.filter((c) => c.type === 'voice');

  return (
    <div className="w-64 bg-[#0E131F]/90 border-r border-white/5 flex flex-col justify-between h-full select-none flex-shrink-0 z-20">
      {/* Top Server Header */}
      <div className="flex flex-col border-b border-white/5">
        <div className="p-4 flex items-center justify-between">
          <div className="truncate pr-2">
            <h1 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{server.icon}</span>
              <span className="truncate">{server.name}</span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate">{server.description}</p>
          </div>
          <button
            onClick={copyInvite}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-indigo-300 border border-white/5 transition-all"
            title="Copy Server Invite Code"
          >
            {copiedInvite ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedInvite ? 'Copied' : server.inviteCode}</span>
          </button>
        </div>

        {/* Roles & RBAC Settings Quick Access */}
        <div className="px-4 pb-2.5 flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 border border-emerald-500/20 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">RBAC Protected</span>
          </div>

          {canManageRoles && (
            <button
              onClick={onOpenRoles}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-bold border border-indigo-500/30 transition-all flex-shrink-0"
              title="Configure Server Roles & Permissions"
            >
              <Sliders className="w-3 h-3" />
              <span>Roles</span>
            </button>
          )}
        </div>
      </div>

      {/* Channel Categories & List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Announcements
            </div>
            {announcements.map((chan) => {
              const isActive = chan.id === activeChannelId;
              const unread = unreadCounts[chan.id] || 0;
              return (
                <button
                  key={chan.id}
                  onClick={() => onSelectChannel(chan.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600/30 text-white border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Megaphone className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="truncate">{chan.name}</span>
                  </div>
                  {unread > 0 && (
                    <span className="rounded-full bg-indigo-500 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-sm">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Text Channels */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Text Channels</span>
            <button
              onClick={() => {
                setNewChanType('text');
                setShowAddChannel(true);
              }}
              className="text-slate-400 hover:text-white"
              title="Add text channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {textChannels.map((chan) => {
            const isActive = chan.id === activeChannelId;
            const unread = unreadCounts[chan.id] || 0;
            return (
              <button
                key={chan.id}
                onClick={() => onSelectChannel(chan.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600/30 text-white border border-indigo-500/40 glow-periwinkle'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{chan.name}</span>
                </div>
                {unread > 0 && (
                  <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Voice & Stage Channels */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Voice & Screen Stages</span>
            <button
              onClick={() => {
                setNewChanType('voice');
                setShowAddChannel(true);
              }}
              className="text-slate-400 hover:text-white"
              title="Add voice stage"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {voiceChannels.map((chan) => {
            const isActive = chan.id === activeChannelId;
            return (
              <button
                key={chan.id}
                onClick={() => onSelectChannel(chan.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40 glow-emerald'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Radio className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 animate-pulse" />
                  <span className="truncate">{chan.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                  Stage
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Channel Inline Form */}
        {showAddChannel && (
          <form
            onSubmit={handleCreateChannel}
            className="p-3 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2 mt-2"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              New {newChanType} Channel
            </span>
            <input
              type="text"
              required
              autoFocus
              value={newChanName}
              onChange={(e) => setNewChanName(e.target.value)}
              placeholder="channel-name"
              className="w-full rounded-xl glass-input px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddChannel(false)}
                className="px-2 py-1 text-[11px] text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-indigo-600 text-[11px] font-bold text-white hover:bg-indigo-500"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </div>

      {/* User Mini Dock at Bottom */}
      <div className="p-2.5 bg-[#0A0E17] border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 pr-1">
          <div className="relative flex-shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0A0E17] ${
                currentUser.status === 'online'
                  ? 'bg-emerald-400'
                  : currentUser.status === 'idle'
                  ? 'bg-amber-400'
                  : currentUser.status === 'dnd'
                  ? 'bg-rose-400'
                  : 'bg-slate-500'
              }`}
            />
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate leading-tight font-mono">@{currentUser.username}</p>
            <p className="text-[10px] text-emerald-400 truncate capitalize">{currentUser.status || 'online'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsSelfMuted(!isSelfMuted)}
            className={`p-1.5 rounded-xl border transition-colors ${
              isSelfMuted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
            title={isSelfMuted ? 'Unmute' : 'Mute'}
          >
            {isSelfMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsSelfDeafened(!isSelfDeafened)}
            className={`p-1.5 rounded-xl border transition-colors ${
              isSelfDeafened
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
            title={isSelfDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isSelfDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="User & Safety Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
