'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Terminal as TerminalIcon, ChevronUp, ChevronDown, Zap, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/lib/codeflow/canvas';

interface TerminalPanelProps {
  className?: string;
  onClose: () => void;
}

interface LogEntry {
  id: number;
  type: 'info' | 'warn' | 'error' | 'success' | 'prompt';
  message: string;
}

export function TerminalPanel({ className, onClose }: TerminalPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [mode, setMode] = useState<'terminal' | 'prompt'>('prompt');
  const [isProcessing, setIsProcessing] = useState(false);
  const { setNodes } = useCanvasStore();
  const logIdRef = useRef(1);

  useEffect(() => {
    setLogs([
      { id: logIdRef.current++, type: 'success', message: 'Codeflow IDE initialized' },
      { id: logIdRef.current++, type: 'info', message: 'Loading @abhinav2203/codeflow-core...' },
      { id: logIdRef.current++, type: 'success', message: 'All packages loaded successfully' },
    ]);
  }, []);

  const processPrompt = useCallback(async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    setLogs(prev => [...prev, {
      id: logIdRef.current++,
      type: 'prompt',
      message: `🎯 Prompt: ${text}`
    }]);

    const steps = [
      '📋 Processing PRD...',
      '🔧 Generating Blueprint...',
      '🤖 Spawning Coder Agent...',
      '🤖 Spawning Reviewer Agent...',
      '🤖 Spawning Tester Agent...',
      '🔍 Running CodeRAG search...',
      '⚡ Executing code generation...',
      '📊 Analyzing code quality...',
      '👥 Syncing Digital Twin...',
      '🧬 Evolution optimization...',
      '✅ Pipeline complete!'
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, 400));
      setLogs(prev => [...prev, {
        id: logIdRef.current++,
        type: 'info',
        message: step
      }]);
    }

    setNodes([
      { id: '1', type: 'blueprint', position: { x: 250, y: 50 }, data: { label: 'Blueprint Generator', description: 'Generate code blueprints' } },
      { id: '2', type: 'agent', position: { x: 100, y: 200 }, data: { label: 'Coder Agent', description: 'Write code' } },
      { id: '3', type: 'agent', position: { x: 400, y: 200 }, data: { label: 'Reviewer Agent', description: 'Review code' } },
      { id: '4', type: 'execution', position: { x: 250, y: 350 }, data: { label: 'Execution Engine', description: 'Run code' } },
    ]);

    setIsProcessing(false);
  }, [setNodes, isProcessing]);

  const submitCommand = () => {
    if (!input.trim()) return;

    if (mode === 'prompt') {
      processPrompt(input);
    } else {
      setLogs(prev => [
        ...prev,
        { id: logIdRef.current++, type: 'info', message: `$ ${input}` },
        { id: logIdRef.current++, type: 'success', message: `Command executed: ${input}` },
      ]);
    }
    setInput('');
  };

  if (minimized) {
    return (
      <div className={cn('h-10 bg-[#13131a] border-t border-[#2a2a3a] flex items-center px-3', className)}>
        <TerminalIcon className="w-4 h-4 text-indigo-400 mr-2" />
        <span className="text-sm text-slate-300 flex-1">Terminal</span>
        <button onClick={() => setMinimized(false)} className="p-1 text-slate-500 hover:text-slate-300">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-red-400 ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('bg-[#13131a] border-t border-[#2a2a3a] flex flex-col', className)}>
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[#2a2a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-slate-300">Terminal</span>
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setMode('prompt')}
              className={cn(
                'px-2 py-1 rounded text-xs transition-colors',
                mode === 'prompt' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Prompt
            </button>
            <button
              onClick={() => setMode('terminal')}
              className={cn(
                'px-2 py-1 rounded text-xs transition-colors',
                mode === 'terminal' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              Terminal
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs space-y-1 max-h-32">
        {logs.map((log) => (
          <div
            key={log.id}
            className={cn(
              'text-slate-300',
              log.type === 'error' && 'text-red-400',
              log.type === 'warn' && 'text-amber-400',
              log.type === 'success' && 'text-emerald-400',
              log.type === 'prompt' && 'text-indigo-400'
            )}
          >
            {log.message}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="h-12 px-3 flex items-center gap-2 border-t border-[#2a2a3a]">
        {mode === 'prompt' ? (
          <>
            <Zap className="w-4 h-4 text-indigo-400" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCommand()}
              disabled={isProcessing}
              className="flex-1 bg-transparent text-slate-200 text-sm outline-none font-mono placeholder-slate-500 disabled:opacity-50"
              placeholder={isProcessing ? "Processing..." : "Describe what you want to build..."}
            />
            <button
              onClick={submitCommand}
              disabled={isProcessing}
              className="p-2 bg-indigo-500 rounded hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </>
        ) : (
          <>
            <span className="text-emerald-400">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCommand()}
              className="flex-1 bg-transparent text-slate-200 text-sm outline-none font-mono placeholder-slate-500"
              placeholder="Type a command..."
            />
          </>
        )}
      </div>
    </div>
  );
}