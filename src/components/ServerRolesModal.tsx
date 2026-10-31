import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  X,
  Users,
  Check,
  Lock,
  Sparkles,
} from 'lucide-react';
import { ServerData, ServerRole, PermissionKey, User } from '../types';

interface ServerRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: ServerData;
  currentUser: User;
  allUsers: User[];
  onUpdateRole: (roleId: string, name: string, color: string, permissions: PermissionKey[]) => void;
  onCreateRole: (name: string, color: string, permissions: PermissionKey[]) => void;
  onAssignMemberRole: (targetUserId: string, roleIds: string[]) => void;
}

const ALL_PERMISSIONS: { key: PermissionKey; label: string; desc: string }[] = [
  { key: 'ADMINISTRATOR', label: 'Administrator', desc: 'Bypasses all channel and role permission restrictions.' },
  { key: 'MANAGE_CHANNELS', label: 'Manage Channels', desc: 'Allows creating and editing server channels.' },
  { key: 'MANAGE_ROLES', label: 'Manage Roles', desc: 'Allows creating and editing roles and permissions.' },
  { key: 'MANAGE_MESSAGES', label: 'Manage Messages', desc: 'Allows deleting messages from other members.' },
  { key: 'SEND_MESSAGES', label: 'Send Messages', desc: 'Allows sending messages in text channels.' },
  { key: 'SEND_ANNOUNCEMENTS', label: 'Post Announcements', desc: 'Allows posting in announcement channels.' },
  { key: 'ATTACH_FILES', label: 'Attach Files & Media', desc: 'Allows uploading images, voice notes, and docs.' },
  { key: 'VOICE_SPEAK', label: 'Speak in Voice Channels', desc: 'Allows unmuting and speaking in voice stages.' },
  { key: 'SCREEN_SHARE', label: 'Share Screen & Presentation', desc: 'Allows broadcasting display stream.' },
];

export const ServerRolesModal: React.FC<ServerRolesModalProps> = ({
  isOpen,
  onClose,
  server,
  currentUser,
  allUsers,
  onUpdateRole,
  onCreateRole,
  onAssignMemberRole,
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'members'>('roles');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(server.roles[0]?.id || '');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#8B5CF6');

  if (!isOpen) return null;

  const isOwner = server.ownerId === currentUser.id;
  const selectedRole = server.roles.find((r) => r.id === selectedRoleId) || server.roles[0];

  const handleTogglePermission = (permKey: PermissionKey) => {
    if (!selectedRole) return;
    const current = selectedRole.permissions || [];
    const next = current.includes(permKey)
      ? current.filter((k) => k !== permKey)
      : [...current, permKey];

    onUpdateRole(selectedRole.id, selectedRole.name, selectedRole.color, next as PermissionKey[]);
  };

  const handleCreateNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    onCreateRole(newRoleName.trim(), newRoleColor, ['SEND_MESSAGES', 'ATTACH_FILES', 'VOICE_SPEAK']);
    setNewRoleName('');
  };

  const serverMembers = allUsers.filter((u) => server.memberIds.includes(u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel p-6 shadow-2xl border border-white/10 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 flex items-center justify-center border border-indigo-500/40 glow-periwinkle">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Server Roles & RBAC Settings</span>
                {isOwner && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                    Owner Access
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Configure role permissions and member privileges</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-2xl bg-slate-900/60 p-1 my-4 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === 'roles' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Roles & Permissions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === 'members' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Member Role Assignments
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'roles' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Role List */}
              <div className="space-y-2 border-r border-white/5 pr-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Server Roles ({server.roles.length})
                </span>
                <div className="space-y-1">
                  {server.roles.map((role) => {
                    const isSelected = role.id === selectedRoleId;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="truncate">{role.name}</span>
                        </div>
                        {role.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/30 text-slate-300">
                            default
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Create Custom Role Inline Form */}
                <form onSubmit={handleCreateNewRole} className="pt-3 border-t border-white/5 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Create Role</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Role name..."
                      className="flex-1 rounded-xl glass-input px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white py-1.5 text-xs font-bold transition-all border border-indigo-500/30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Role</span>
                  </button>
                </form>
              </div>

              {/* Right Permission Checkboxes for Selected Role */}
              <div className="md:col-span-2 space-y-3">
                {selectedRole ? (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selectedRole.color }}
                          />
                          <span>{selectedRole.name} Permissions</span>
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Toggle specific capabilities granted to this role.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {ALL_PERMISSIONS.map((perm) => {
                        const isGranted = (selectedRole.permissions || []).includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => handleTogglePermission(perm.key)}
                            className={`flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isGranted
                                ? 'bg-indigo-950/30 border-indigo-500/40'
                                : 'bg-slate-900/30 border-white/5 hover:border-white/15'
                            }`}
                          >
                            <div className="pr-3">
                              <p className="text-xs font-bold text-white">{perm.label}</p>
                              <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                                {perm.desc}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => {}}
                              className="mt-1 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-600"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Select a role to configure permissions.</p>
                )}
              </div>
            </div>
          ) : (
            /* Member Role Assignments */
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Server Members ({serverMembers.length})
              </span>
              <div className="space-y-2">
                {serverMembers.map((member) => {
                  const assignedRoleIds = server.memberRoles[member.id] || [];

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-2xl glass-card border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <img src={member.avatar} alt={member.name} className="w-9 h-9 rounded-xl bg-slate-800" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{member.name}</span>
                            {server.ownerId === member.id && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                Owner
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">@{member.username}</span>
                        </div>
                      </div>

                      {/* Role Selector Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {server.roles.map((role) => {
                          const isAssigned = assignedRoleIds.includes(role.id);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => {
                                const next = isAssigned
                                  ? assignedRoleIds.filter((id) => id !== role.id)
                                  : [...assignedRoleIds, role.id];
                                onAssignMemberRole(member.id, next);
                              }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                                isAssigned
                                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                  : 'bg-white/5 text-slate-400 hover:text-white border-white/5'
                              }`}
                            >
                              {role.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30"
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
};
