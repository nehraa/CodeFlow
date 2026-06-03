'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, X, GripVertical, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubAgent {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
}

interface AgentOrchestratorProps {
  className?: string;
}

export function AgentOrchestrator({ className }: AgentOrchestratorProps) {
  const [agents, setAgents] = useState<SubAgent[]>([
    { id: '1', name: 'Coder Agent', status: 'running', progress: 65, message: 'Writing components...' },
    { id: '2', name: 'Reviewer Agent', status: 'idle', progress: 0, message: 'Waiting...' },
    { id: '3', name: 'Tester Agent', status: 'idle', progress: 0, message: 'Waiting...' },
  ]);
  const [expanded, setExpanded] = useState(true);

  const updateAgent = useCallback((id: string, updates: Partial<SubAgent>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  const removeAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAgent = useCallback(() => {
    const newAgent: SubAgent = {
      id: Date.now().toString(),
      name: `Agent ${agents.length + 1}`,
      status: 'idle',
      progress: 0,
      message: 'Initializing...',
    };
    setAgents((prev) => [...prev, newAgent]);
  }, [agents.length]);

  return (
    <div className={cn('bg-[#1a1a24] rounded-lg border border-[#2a2a3a]', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#13131a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-100">Agent Orchestrator</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
            {agents.filter((a) => a.status === 'running').length} active
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-[#2a2a3a]"
          >
            <div className="p-3 space-y-2">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onUpdate={updateAgent}
                  onRemove={removeAgent}
                />
              ))}

              {/* Add Agent Button */}
              <button
                onClick={addAgent}
                className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-indigo-400 border border-dashed border-[#2a2a3a] hover:border-indigo-500 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Spawn New Agent
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentCard({
  agent,
  onUpdate,
  onRemove,
}: {
  agent: SubAgent;
  onUpdate: (id: string, updates: Partial<SubAgent>) => void;
  onRemove: (id: string) => void;
}) {
  const statusColors = {
    idle: 'bg-slate-500',
    running: 'bg-amber-500 animate-pulse',
    completed: 'bg-emerald-500',
    error: 'bg-red-500',
  };

  return (
    <motion.div
      layout
      className="p-3 rounded-lg bg-[#13131a] border border-[#2a2a3a] group"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 cursor-grab text-slate-600 group-hover:text-slate-400">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', statusColors[agent.status])} />
            <span className="text-sm text-slate-100 truncate">{agent.name}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">{agent.message}</div>

          {/* Progress Bar */}
          {agent.status === 'running' && (
            <div className="mt-2">
              <div className="h-1 bg-[#1a1a24] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${agent.progress}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">{agent.progress}%</div>
            </div>
          )}
        </div>

        <button
          onClick={() => onRemove(agent.id)}
          className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}