'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Terminal, Play, CheckCircle, XCircle, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  output?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  selected?: boolean;
}

export const ExecutionNode = memo(function ExecutionNode({ data, selected }: { data: ExecutionNodeData; selected?: boolean }) {
  const status = data.status || 'idle';

  const statusIcons = {
    idle: <Terminal className="w-3 h-3 text-slate-500" />,
    running: <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}><Loader className="w-3 h-3 text-amber-500" /></motion.div>,
    success: <CheckCircle className="w-3 h-3 text-emerald-500" />,
    error: <XCircle className="w-3 h-3 text-red-500" />,
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'px-4 py-3 rounded-lg bg-[#1a1a24] border-2 min-w-[180px] transition-all duration-200',
        selected
          ? 'border-red-500 shadow-lg shadow-red-500/30'
          : 'border-[#2a2a3a] hover:border-red-400'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-red-500" />

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <Play className="w-5 h-5 text-red-400" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-slate-100 text-sm truncate">{data.label}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{data.description}</div>
        </div>
      </div>

      {/* Code output preview */}
      <div className="mt-2 pt-2 border-t border-[#2a2a3a] bg-[#0a0a0f] rounded p-2 font-mono text-xs text-slate-400 max-h-12 overflow-hidden">
        {data.output || '// No output yet'}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {statusIcons[status]}
        <span className="text-xs text-slate-500 uppercase">{status}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-red-500" />
    </motion.div>
  );
});