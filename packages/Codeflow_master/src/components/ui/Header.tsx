'use client';

import { Bug, Play, Pause, Square, Save, Settings, Terminal, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onTerminalToggle: () => void;
  terminalOpen: boolean;
}

export function Header({ onTerminalToggle, terminalOpen }: HeaderProps) {
  return (
    <header className="h-12 flex items-center justify-between px-4 bg-[#13131a] border-b border-[#2a2a3a]">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
          <span className="text-white font-bold text-sm">CF</span>
        </div>
        <span className="font-semibold text-slate-100">Codeflow IDE</span>
      </div>

      {/* Center - Agent Status */}
      <div className="flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-full bg-[#1a1a24] border border-[#2a2a3a] flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-slate-300">Agent Ready</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onTerminalToggle}
          className={cn(
            'p-2 rounded-lg transition-colors',
            terminalOpen
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a24]'
          )}
          title="Toggle Terminal"
        >
          <Terminal className="w-4 h-4" />
        </button>
        <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#1a1a24] rounded-lg transition-colors" title="Save">
          <Save className="w-4 h-4" />
        </button>
        <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#1a1a24] rounded-lg transition-colors" title="Settings">
          <Settings className="w-4 h-4" />
        </button>
        <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#1a1a24] rounded-lg transition-colors" title="Help">
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}