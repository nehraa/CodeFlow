'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FileCode, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlueprintNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  selected?: boolean;
}

type BlueprintNodeType = Node<BlueprintNodeData, 'blueprint'>;

export const BlueprintNode = memo(function BlueprintNode({ data, selected }: { data: BlueprintNodeData; selected?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'px-4 py-3 rounded-lg bg-[#1a1a24] border-2 min-w-[180px] transition-all duration-200',
        selected
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/30'
          : 'border-[#2a2a3a] hover:border-indigo-400'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500" />

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <FileCode className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-slate-100 text-sm truncate">{data.label}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{data.description}</div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-[#2a2a3a] flex items-center gap-2">
        <GitBranch className="w-3 h-3 text-slate-500" />
        <span className="text-xs text-slate-500">Blueprint v1.0</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </motion.div>
  );
});