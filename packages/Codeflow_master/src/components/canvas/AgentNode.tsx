'use client';

import { memo } from 'react';
import { Handle, Position, Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Bot, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  status?: 'ready' | 'running' | 'idle';
  selected?: boolean;
}

export const AgentNode = memo(function AgentNode({ data, selected }: { data: AgentNodeData; selected?: boolean }) {
  const statusColors = {
    ready: 'bg-emerald-500',
    running: 'bg-amber-500 animate-pulse',
    idle: 'bg-slate-500',
  };

  const status = data.status || 'idle';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'px-4 py-3 rounded-lg bg-[#1a1a24] border-2 min-w-[180px] transition-all duration-200',
        selected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/30'
          : 'border-[#2a2a3a] hover:border-emerald-400'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500" />

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 relative">
          <Bot className="w-5 h-5 text-emerald-400" />
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white"
            animate={status === 'running' ? { scale: [1, 1.2, 1] } : {}}
          >
            <div className={cn('w-full h-full rounded-full', statusColors[status])} />
          </motion.div>
        </div>
        <div className="min-w-0">
          <div className="font-medium text-slate-100 text-sm truncate">{data.label}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{data.description}</div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-[#2a2a3a] flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-slate-400">3</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="text-xs text-slate-400">{status}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500" />
    </motion.div>
  );
});