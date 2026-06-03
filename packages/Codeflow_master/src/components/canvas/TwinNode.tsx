'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Building2, RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TwinNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  syncStatus?: 'synced' | 'syncing' | 'error';
  selected?: boolean;
}

export const TwinNode = memo(function TwinNode({ data, selected }: { data: TwinNodeData; selected?: boolean }) {
  const syncColors = {
    synced: 'text-emerald-500',
    syncing: 'text-amber-500',
    error: 'text-red-500',
  };

  const syncStatus = data.syncStatus || 'synced';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'px-4 py-3 rounded-lg bg-[#1a1a24] border-2 min-w-[180px] transition-all duration-200',
        selected
          ? 'border-amber-500 shadow-lg shadow-amber-500/30'
          : 'border-[#2a2a3a] hover:border-amber-400'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500" />

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 relative">
          <Building2 className="w-5 h-5 text-amber-400" />
          {syncStatus === 'syncing' && (
            <motion.div
              className="absolute -top-0.5 -right-0.5"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-3 h-3 text-amber-500" />
            </motion.div>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-slate-100 text-sm truncate">{data.label}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{data.description}</div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-[#2a2a3a] flex items-center gap-2">
        <div className={cn('flex items-center gap-1', syncColors[syncStatus])}>
          <Activity className="w-3 h-3" />
          <span className="text-xs uppercase">{syncStatus}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500" />
    </motion.div>
  );
});