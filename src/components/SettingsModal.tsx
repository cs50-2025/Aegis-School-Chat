import React from 'react';
import {
  Settings,
  Shield,
  ShieldAlert,
  Smartphone,
  Eye,
  EyeOff,
  UserCheck,
  X,
  FileCheck2,
  LogOut,
} from 'lucide-react';
import { User } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateSettings: (newSettings: Partial<User>) => void;
  onSignOut: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateSettings,
  onSignOut,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-3xl glass-panel p-6 shadow-2xl border border-white/10 text-slate-100 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 flex items-center justify-center border border-indigo-500/40 glow-periwinkle">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Aegis Settings & Safety Controls</h3>
              <p className="text-xs text-slate-400">PWA preferences & content moderation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Content */}
        <div className="overflow-y-auto py-4 space-y-5 pr-1">
          {/* User Account Card */}
          <div className="rounded-2xl glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <img src={currentUser.avatar} alt={currentUser.username} className="w-12 h-12 rounded-2xl bg-slate-800 object-cover" />
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center cursor-pointer transition-opacity text-[10px] text-white font-bold">
                  Edit
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            onUpdateSettings({ avatar: ev.target.result as string });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">@{currentUser.username}</h4>
                <p className="text-xs text-emerald-400 font-mono">Active Account</p>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* School-Safe Content Controls */}
          <div className="rounded-2xl glass-card p-4 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Content Moderation Filters
            </span>

            {/* Profanity Blur Setting (iOS-style switch) */}
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white">Dynamic Frosted Profanity Blur</h4>
                  {currentUser.blurProfanity ? (
                    <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Conceals offensive words behind frosted pills (<span className="text-rose-400">████</span>). Click any pill in chat to momentarily reveal.
                </p>
              </div>

              {/* iOS Switch */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ blurProfanity: !currentUser.blurProfanity })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  currentUser.blurProfanity ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    currentUser.blurProfanity ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* AI Text & Image Moderation Notice */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
              <FileCheck2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-300">AI Pre-Send Text & Image Moderation</span>
                <p className="text-[11px] text-emerald-200/70 mt-0.5 leading-relaxed">
                  All messages and media are pre-screened before transmission. Severe hate speech, harassment, and inappropriate imagery are automatically blocked with warnings.
                </p>
              </div>
            </div>
          </div>

          {/* WebRTC Remote Control & Kill-Switch Info */}
          <div className="rounded-2xl glass-card p-4 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Host Emergency Kill-Switch Protocol
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              When hosting a screen share with remote control active, press the{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[11px] border border-white/20">
                Escape
              </kbd>{' '}
              key <strong className="text-white">3 times within 1.5 seconds</strong>. This hardware-level listener severs WebRTC data channels and instantly terminates remote control.
            </p>
          </div>

          {/* PWA Section */}
          <div className="rounded-2xl glass-card p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              Progressive Web App (PWA)
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              Install Aegis as a standalone application on Chrome, iOS Safari, macOS, Windows, and Android. Works offline with service worker caching.
            </p>
            <div className="pt-1">
              <PWAInstallButton variant="full" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/25"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
