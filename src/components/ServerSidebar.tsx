import React from 'react';
import { Plus, Shield, Settings } from 'lucide-react';
import { ServerData } from '../types';

interface ServerSidebarProps {
  servers: ServerData[];
  activeServerId: string | null;
  onSelectServer: (id: string | null) => void;
  onOpenCreateServer: () => void;
  onOpenSettings: () => void;
  pendingFriendRequestsCount: number;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers,
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  onOpenSettings,
  pendingFriendRequestsCount,
}) => {
  const isDMActive = activeServerId === null || activeServerId === 'dm';

  // Deduplicate servers by id to guarantee unique keys
  const uniqueServers = React.useMemo(() => {
    const seen = new Set<string>();
    return servers.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [servers]);

  return (
    <div className="w-[72px] bg-[#080B12] border-r border-white/5 flex flex-col items-center py-3 select-none flex-shrink-0 z-30 justify-between h-full">
      {/* Top Server Icons */}
      <div className="flex flex-col items-center space-y-3 w-full">
        {/* Aegis Shield Brand Icon (Direct Messages & Friends Hub) */}
        <div className="relative group flex items-center justify-center w-full">
          <span
            className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
              isDMActive ? 'h-8' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
            }`}
          />
          <button
            onClick={() => onSelectServer(null)}
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-lg ${
              isDMActive
                ? 'bg-gradient-to-tr from-indigo-500 to-violet-600 text-white rounded-xl shadow-indigo-600/30 glow-periwinkle'
                : 'bg-[#192132]/60 hover:bg-[#192132] text-slate-300 hover:rounded-xl border border-white/5'
            }`}
            title="Direct Messages & Friends Hub"
          >
            <Shield className="w-6 h-6 group-hover:scale-110 transition-transform" />
            {pendingFriendRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 border-2 border-[#080B12] text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
                {pendingFriendRequestsCount}
              </span>
            )}
          </button>
        </div>

        <div className="w-8 h-[2px] bg-white/10 rounded-full" />

        {/* Server List */}
        <div className="flex flex-col items-center space-y-2.5 w-full">
          {uniqueServers.map((server) => {
            const isActive = server.id === activeServerId;
            return (
              <div key={server.id} className="relative group flex items-center justify-center w-full">
                <span
                  className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
                    isActive ? 'h-8' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                  }`}
                />

                <button
                  onClick={() => onSelectServer(server.id)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-200 shadow-md ${
                    isActive
                      ? 'rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-indigo-500/25 glow-periwinkle'
                      : 'bg-[#192132]/60 hover:bg-[#192132] text-slate-200 hover:rounded-xl border border-white/5'
                  }`}
                  title={server.name}
                >
                  <span>{server.icon}</span>
                </button>
              </div>
            );
          })}

          {/* Add Server Button */}
          <button
            onClick={onOpenCreateServer}
            className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-emerald-600/20 text-emerald-400 border border-white/5 hover:border-emerald-500/40 flex items-center justify-center hover:rounded-xl transition-all duration-200"
            title="Create or Join Study Server"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Settings Button */}
      <div className="flex flex-col items-center space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 flex items-center justify-center transition-all duration-200"
          title="Settings & Safety Filters"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
