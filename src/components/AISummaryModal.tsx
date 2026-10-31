import React, { useState } from 'react';
import { Sparkles, CheckCircle2, HelpCircle, ListTodo, Copy, Check, X, ShieldCheck } from 'lucide-react';
import { AISummaryData } from '../types';

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: AISummaryData | null;
  channelName: string;
  onMarkRead: () => void;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  channelName,
  onMarkRead,
}) => {
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  if (!isOpen || !summary) return null;

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleCopy = () => {
    const text = `📋 Aegis AI Study Brief for #${channelName}
${summary.overview}

🔹 Key Decisions:
${summary.keyDecisions.map((d) => `• ${d}`).join('\n')}

❓ Questions Raised:
${summary.questionsRaised.map((q) => `• ${q}`).join('\n')}

✅ Action Items:
${summary.actionItems.map((a) => `• [ ] ${a}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismissAndMark = () => {
    onMarkRead();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel p-6 shadow-2xl border border-white/10 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500/30 to-violet-500/20 flex items-center justify-center border border-indigo-500/40 glow-periwinkle">
              <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">AI Catch-Up Study Brief</h2>
                <span className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Synthesized summary of unread activity in <span className="text-indigo-300 font-semibold">#{channelName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="overflow-y-auto py-4 space-y-5 pr-1">
          {/* Overview */}
          <div className="rounded-2xl bg-indigo-950/30 border border-indigo-500/20 p-4">
            <p className="text-sm leading-relaxed text-indigo-100 font-medium">
              "{summary.overview}"
            </p>
          </div>

          {/* Key Decisions */}
          {summary.keyDecisions && summary.keyDecisions.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Key Decisions & Consensus</span>
              </div>
              <div className="space-y-1.5">
                {summary.keyDecisions.map((decision, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl bg-slate-900/40 p-2.5 text-xs text-slate-200 border border-white/5"
                  >
                    <span className="text-emerald-400 font-bold">•</span>
                    <span className="leading-relaxed">{decision}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions Raised */}
          {summary.questionsRaised && summary.questionsRaised.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <HelpCircle className="w-4 h-4" />
                <span>Questions Raised in Discussion</span>
              </div>
              <div className="space-y-1.5">
                {summary.questionsRaised.map((question, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl bg-slate-900/40 p-2.5 text-xs text-slate-200 border border-white/5"
                  >
                    <span className="text-amber-400 font-bold">•</span>
                    <span className="leading-relaxed">{question}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {summary.actionItems && summary.actionItems.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <ListTodo className="w-4 h-4" />
                <span>Action Items & Homework Tasks</span>
              </div>
              <div className="space-y-1.5">
                {summary.actionItems.map((action, idx) => {
                  const isChecked = !!checkedItems[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleCheck(idx)}
                      className={`flex items-start gap-3 rounded-xl p-2.5 text-xs border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200/80 line-through'
                          : 'bg-slate-900/40 border-white/5 text-slate-200 hover:border-indigo-500/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-600"
                      />
                      <span className="leading-relaxed">{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Brief' : 'Copy Brief'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Keep Unread
            </button>
            <button
              onClick={handleDismissAndMark}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-500 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Mark Channel Read</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
