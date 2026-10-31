import React, { useState } from 'react';
import { Shield, ArrowRight, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { User } from '../types';

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: User) => void;
}

const AVATAR_SEEDS = ['alex', 'sarah', 'marcus', 'maya', 'devon', 'jordan', 'taylor', 'sam'];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('https://api.dicebear.com/7.x/bottts/svg?seed=alex');
  const [customAvatarUploaded, setCustomAvatarUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedAvatar(event.target.result as string);
        setCustomAvatarUploaded(true);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering
      ? {
          username: cleanUsername,
          password,
          avatar: selectedAvatar,
        }
      : {
          username: cleanUsername,
          password,
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      localStorage.setItem('aegis_token', data.token);
      onAuthSuccess(data.token, data.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0B0F19] p-4 text-slate-100 select-none relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl glass-panel p-8 shadow-2xl border border-white/10 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 mb-3 glow-periwinkle">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Aegis Communication</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            School-safe real-time messaging, private DMs, and RBAC study servers.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-2xl bg-slate-900/60 p-1 mb-6 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(false);
              setError(null);
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              !isRegistering
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(true);
              setError(null);
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              isRegistering
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-950/70 border border-rose-500/40 p-3 text-xs text-rose-200 glow-rose">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload Feature (Primary option on account creation) */}
          {isRegistering && (
            <div className="rounded-2xl glass-card p-3.5 border border-white/5 space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Upload Your Avatar
              </label>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border-2 border-indigo-500/40 shadow-md flex-shrink-0 relative group">
                  <img
                    src={selectedAvatar}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                  {customAvatarUploaded && (
                    <span className="absolute bottom-0 right-0 bg-emerald-500 w-3.5 h-3.5 rounded-full border-2 border-slate-900" />
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/25 hover:scale-[1.02]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <p className="text-[10px] text-slate-400">
                    {customAvatarUploaded ? '✓ Custom photo loaded' : 'PNG, JPG, or GIF up to 5MB'}
                  </p>
                </div>
              </div>

              {/* Preset avatars as backup choice */}
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 block">
                  Or pick a preset:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {AVATAR_SEEDS.map((seed) => {
                    const presetUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
                    const isSelected = selectedAvatar === presetUrl;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => {
                          setSelectedAvatar(presetUrl);
                          setCustomAvatarUploaded(false);
                        }}
                        className={`w-8 h-8 rounded-xl p-0.5 border-2 transition-all flex-shrink-0 ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-600/30 scale-110'
                            : 'border-transparent bg-slate-800 opacity-60 hover:opacity-100'
                        }`}
                        title={seed}
                      >
                        <img src={presetUrl} alt={seed} className="w-full h-full rounded-lg" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Username Input (Username is the Full Display Name - No separate Display Name input) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Username {isRegistering && <span className="text-slate-500">(Your public name)</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                className="w-full rounded-2xl glass-input pl-8 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 lowercase font-mono"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl glass-input px-3.5 py-2.5 text-xs text-white placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-500 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <span>{isLoading ? 'Connecting...' : isRegistering ? 'Create Free Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">Live multi-user ready:</strong> Open an Incognito window or another browser tab, register another username, and chat & call in real-time!
          </p>
        </div>
      </div>
    </div>
  );
};
