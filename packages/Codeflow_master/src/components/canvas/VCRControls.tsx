'use client';

import { Play, Pause, Square, Circle, SkipForward, SkipBack } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';

interface VCRControlsProps {
  state: PlaybackState;
  onStateChange: (state: PlaybackState) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onFastForward: () => void;
  onRewind: () => void;
  className?: string;
}

export function VCRControls({
  state,
  onStateChange,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onFastForward,
  onRewind,
  className,
}: VCRControlsProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* REW - Rewind */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onRewind}
        className="vcr-button group"
        title="Rewind"
      >
        <SkipBack className="w-5 h-5 text-slate-400 group-hover:text-slate-200" />
      </motion.button>

      {/* PLAY */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onPlay}
        className={cn(
          'vcr-button',
          state === 'playing' && 'playing'
        )}
        title={state === 'playing' ? 'Playing' : 'Play'}
      >
        <Play className={cn('w-5 h-5', state === 'playing' ? 'text-white' : 'text-emerald-500')} />
      </motion.button>

      {/* PAUSE */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onPause}
        className={cn(
          'vcr-button',
          state === 'paused' && 'paused'
        )}
        title={state === 'paused' ? 'Paused' : 'Pause'}
      >
        <Pause className={cn('w-5 h-5', state === 'paused' ? 'text-white' : 'text-amber-500')} />
      </motion.button>

      {/* STOP */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onStop}
        className={cn(
          'vcr-button',
          state === 'stopped' && 'bg-[#1a1a24] border-slate-600'
        )}
        title="Stop"
      >
        <Square className="w-5 h-5 text-slate-400" />
      </motion.button>

      {/* RECORD */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onRecord}
        className={cn(
          'vcr-button',
          state === 'recording' && 'recording'
        )}
        title="Record"
      >
        <Circle className={cn('w-5 h-5', state === 'recording' ? 'text-white' : 'text-red-500 fill-red-500/30')} />
      </motion.button>

      {/* FF - Fast Forward */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onFastForward}
        className="vcr-button group"
        title="Fast Forward"
      >
        <SkipForward className="w-5 h-5 text-slate-400 group-hover:text-slate-200" />
      </motion.button>

      {/* Divider */}
      <div className="w-px h-8 bg-[#2a2a3a] mx-2" />

      {/* State Display */}
      <div className="px-3 py-1.5 rounded bg-[#0a0a0f] border border-[#2a2a3a]">
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
          {state}
        </span>
      </div>
    </div>
  );
}