import React, { useState } from 'react';
import { School, Plus, Hash, X, LogIn, Sparkles, Key } from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, icon: string, bannerColor: string) => void;
  onJoinByCode: (inviteCode: string) => void;
}

const SERVER_PRESETS = [
  { name: 'AP Biology & Genetics Review', icon: '🧬', desc: 'Cellular respiration and lab data', color: 'from-emerald-600 to-teal-800' },
  { name: 'Robotics Club #42', icon: '🤖', desc: 'CAD design and motor control firmware', color: 'from-indigo-600 to-violet-800' },
  { name: 'Calculus BC & Linear Algebra', icon: '📐', desc: 'Integration techniques and problem sets', color: 'from-blue-600 to-indigo-800' },
  { name: 'Computer Science & AI Lab', icon: '💻', desc: 'Algorithms, data structures, and Python', color: 'from-purple-600 to-pink-800' },
];

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onJoinByCode,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎓');
  const [bannerColor, setBannerColor] = useState('from-indigo-600 to-violet-800');
  const [inviteCode, setInviteCode] = useState('');

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), description.trim(), icon, bannerColor);
    setName('');
    setDescription('');
    onClose();
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    onJoinByCode(inviteCode.trim());
    setInviteCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel p-6 shadow-2xl border border-white/10 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 flex items-center justify-center border border-indigo-500/40 glow-periwinkle">
              <School className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Study Server Hub</h3>
              <p className="text-xs text-slate-400">Create a study community or join your friends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-2xl bg-slate-900/60 p-1 my-4 border border-white/5">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              tab === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Server
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              tab === 'join' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Join with Invite Code
          </button>
        </div>

        {tab === 'create' ? (
          <>
            {/* Quick Presets */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Quick Start Templates
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SERVER_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setName(preset.name);
                      setDescription(preset.desc);
                      setIcon(preset.icon);
                      setBannerColor(preset.color);
                    }}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/40 hover:bg-indigo-950/40 border border-white/5 hover:border-indigo-500/30 text-left transition-all"
                  >
                    <span className="text-xl">{preset.icon}</span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">{preset.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{preset.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Icon</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-12 h-10 text-center rounded-xl glass-input text-lg font-bold"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Server Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Physics C Study Group"
                    className="w-full rounded-xl glass-input px-3.5 py-2 text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will your members collaborate on?"
                  className="w-full rounded-xl glass-input px-3.5 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-500 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Server</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Invite Code
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. STUDY-4281"
                  className="w-full rounded-2xl glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono uppercase font-bold tracking-wider"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Ask your friend or instructor for their server's invite code to join immediately.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Join Server</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
