'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Ghost, Dna, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GhostNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  fitness?: number;
  selected?: boolean;
}

export const GhostNode = memo(function GhostNode({ data, selected }: { data: GhostNodeData; selected?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'px-4 py-3 rounded-lg bg-[#1a1a24] border-2 border-dashed min-w-[180px] transition-all duration-200',
        selected
          ? 'border-cyan-400 shadow-lg shadow-cyan-500/30'
          : 'border-cyan-500/50 hover:border-cyan-400',
        'ghost-node'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-cyan-500" />

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <Ghost className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-slate-100 text-sm truncate">{data.label}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{data.description}</div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-cyan-500/30 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Gauge className="w-3 h-3 text-cyan-500" />
          <span className="text-xs text-cyan-400">{((data.fitness || 0) * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Dna className="w-3 h-3 text-cyan-500/70" />
          <span className="text-xs text-slate-500">gen: 42</span>
        </div>
      </div>

      {/* Ghost pulse effect */}
      <motion.div
        className="absolute inset-0 rounded-lg border border-cyan-400/30"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-cyan-500" />
    </motion.div>
  );
});