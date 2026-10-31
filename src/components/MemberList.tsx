import React from 'react';
import { Users, Shield, Award, GraduationCap } from 'lucide-react';
import { User } from '../types';

interface MemberListProps {
  users: User[];
  currentUserId: string;
}

export const MemberList: React.FC<MemberListProps> = ({ users, currentUserId }) => {
  const uniqueUsers = React.useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) {
      if (u && u.id) map.set(u.id, u);
    }
    return Array.from(map.values());
  }, [users]);

  const teachers = uniqueUsers.filter((u) => u.role === 'teacher' || u.role === 'Admin');
  const moderators = uniqueUsers.filter((u) => u.role === 'moderator' || u.role === 'Moderator');
  const students = uniqueUsers.filter((u) => !u.role || u.role === 'student' || u.role === 'Member');

  return (
    <div className="w-60 bg-[#0A0E17]/95 border-l border-white/5 flex flex-col h-full select-none flex-shrink-0 z-10 hidden xl:flex">
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>Members — {users.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Teachers */}
        {teachers.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-2 flex items-center gap-1.5">
              <GraduationCap className="w-3 h-3" />
              <span>Instructors — {teachers.length}</span>
            </span>
            {teachers.map((u) => (
              <MemberCard key={u.id} user={u} isSelf={u.id === currentUserId} />
            ))}
          </div>
        )}

        {/* Moderators */}
        {moderators.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              <span>Moderators / TAs — {moderators.length}</span>
            </span>
            {moderators.map((u) => (
              <MemberCard key={u.id} user={u} isSelf={u.id === currentUserId} />
            ))}
          </div>
        )}

        {/* Students */}
        {students.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1.5">
              <Award className="w-3 h-3 text-indigo-400" />
              <span>Study Peers — {students.length}</span>
            </span>
            {students.map((u) => (
              <MemberCard key={u.id} user={u} isSelf={u.id === currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MemberCard: React.FC<{ user: User; isSelf: boolean }> = ({ user, isSelf }) => {
  const isOnline = user.status === 'online';
  const isIdle = user.status === 'idle';
  const isDnd = user.status === 'dnd';
  const isOffline = !user.status || user.status === 'offline';

  const dotColor = isOnline
    ? 'bg-emerald-400'
    : isIdle
    ? 'bg-amber-400'
    : isDnd
    ? 'bg-rose-400'
    : 'bg-slate-500';

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-colors group">
      <div className="relative">
        <img
          src={user.avatar}
          alt={user.username}
          className={`w-8 h-8 rounded-xl bg-slate-800 ${isOffline ? 'opacity-65 grayscale-[35%]' : ''}`}
        />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0A0E17] ${dotColor}`}
        />
      </div>
      <div className="min-w-0 flex-1 truncate">
        <div className="flex items-center gap-1">
          <p className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
            @{user.username}
          </p>
          {isSelf && <span className="text-[9px] text-indigo-400 font-bold">(You)</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-slate-400 capitalize truncate">{user.role || 'Member'}</span>
          <span className="text-slate-600">•</span>
          <span
            className={`capitalize font-medium ${
              isOnline
                ? 'text-emerald-400'
                : isIdle
                ? 'text-amber-400'
                : isDnd
                ? 'text-rose-400'
                : 'text-slate-500'
            }`}
          >
            {user.status || 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};
