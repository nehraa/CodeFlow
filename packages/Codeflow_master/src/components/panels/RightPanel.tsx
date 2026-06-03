'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  BarChart3,
  Building2,
  Dna,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RightPanelProps {
  className?: string;
}

interface PanelSection {
  id: string;
  label: string;
  icon: React.ElementType;
  content: React.ReactNode;
  collapsed: boolean;
}

export function RightPanel({ className }: RightPanelProps) {
  const [sections, setSections] = useState<PanelSection[]>([
    {
      id: 'execution',
      label: 'Execution',
      icon: Play,
      collapsed: false,
      content: <ExecutionPanel />,
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: BarChart3,
      collapsed: false,
      content: <AnalysisPanel />,
    },
    {
      id: 'twin',
      label: 'Digital Twin',
      icon: Building2,
      collapsed: false,
      content: <TwinPanel />,
    },
    {
      id: 'evolution',
      label: 'Evolution',
      icon: Dna,
      collapsed: false,
      content: <EvolutionPanel />,
    },
  ]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
    );
  };

  return (
    <div className={cn('h-full bg-[#13131a] border-l border-[#2a2a3a] flex flex-col', className)}>
      <div className="p-3 border-b border-[#2a2a3a]">
        <h2 className="text-sm font-semibold text-slate-100">Tools</h2>
      </div>
      <div className="flex-1 overflow-auto">
        {sections.map((section) => (
          <div key={section.id}>
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#1a1a24] transition-colors"
            >
              <div className="flex items-center gap-2">
                <section.icon className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-slate-300">{section.label}</span>
              </div>
              {section.collapsed ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {!section.collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-[#2a2a3a]"
              >
                {section.content}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutionPanel() {
  const [logs, setLogs] = useState([
    { time: '10:23:45', message: 'Executing blueprint...', type: 'info' },
    { time: '10:23:46', message: 'Agent spawned', type: 'success' },
    { time: '10:23:47', message: 'Code generated', type: 'success' },
  ]);

  return (
    <div className="p-3 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <button className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1">
          <Play className="w-3 h-3" /> Run
        </button>
        <button className="px-2 py-1 rounded bg-[#1a1a24] text-slate-400 text-xs flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>
      <div className="space-y-1 font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 text-slate-400">
            <span className="text-slate-500">[{log.time}]</span>
            <span className={cn(
              log.type === 'error' && 'text-red-400',
              log.type === 'success' && 'text-emerald-400',
              log.type === 'info' && 'text-slate-300',
            )}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisPanel() {
  return (
    <div className="p-3 text-sm">
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Complexity</span>
            <span className="text-indigo-400">72%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: '72%' }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Coverage</span>
            <span className="text-emerald-400">85%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: '85%' }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Performance</span>
            <span className="text-amber-400">64%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-500"
              initial={{ width: 0 }}
              animate={{ width: '64%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TwinPanel() {
  const [syncing, setSyncing] = useState(false);

  return (
    <div className="p-3 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">Sync Status</span>
        <span className={cn(
          'px-2 py-0.5 rounded text-xs',
          syncing ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
        )}>
          {syncing ? 'Syncing' : 'Synced'}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setSyncing(true)}
          className="flex-1 px-2 py-1.5 rounded bg-[#1a1a24] border border-[#2a2a3a] text-xs text-slate-300 hover:border-indigo-500 transition-colors"
        >
          Sync Now
        </button>
        <button className="flex-1 px-2 py-1.5 rounded bg-[#1a1a24] border border-[#2a2a3a] text-xs text-slate-300 hover:border-indigo-500 transition-colors">
          Snapshot
        </button>
      </div>
    </div>
  );
}

function EvolutionPanel() {
  const [generation, setGeneration] = useState(42);
  const [fitness, setFitness] = useState(0.85);

  return (
    <div className="p-3 text-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Generation</span>
          <span className="text-lg font-mono text-cyan-400">{generation}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Best Fitness</span>
          <span className="text-lg font-mono text-emerald-400">{(fitness * 100).toFixed(0)}%</span>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 px-2 py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center gap-1 hover:bg-cyan-500/30 transition-colors">
            <Zap className="w-3 h-3" /> Evolve
          </button>
          <button className="flex-1 px-2 py-1.5 rounded bg-[#1a1a24] border border-[#2a2a3a] text-xs text-slate-300 hover:border-indigo-500 transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}