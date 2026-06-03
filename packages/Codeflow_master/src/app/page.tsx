'use client';

import { useState } from 'react';
import { CodeflowCanvas } from '@/components/canvas/CodeflowCanvas';
import { VCRControls } from '@/components/canvas/VCRControls';
import { LeftSidebar } from '@/components/panels/LeftSidebar';
import { RightPanel } from '@/components/panels/RightPanel';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { Header } from '@/components/ui/Header';
import { cn } from '@/lib/utils';

export default function Home() {
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [playbackState, setPlaybackState] = useState<'stopped' | 'playing' | 'paused' | 'recording'>('stopped');

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0f] text-slate-200 overflow-hidden">
      {/* Header */}
      <Header onTerminalToggle={() => setTerminalOpen(!terminalOpen)} terminalOpen={terminalOpen} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar className="w-64 flex-shrink-0" />

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col relative">
          {/* VCR Controls Bar */}
          <div className="h-14 flex items-center justify-center border-b border-[#2a2a3a] bg-[#13131a]">
            <VCRControls
              state={playbackState}
              onStateChange={setPlaybackState}
              onPlay={() => setPlaybackState('playing')}
              onPause={() => setPlaybackState('paused')}
              onStop={() => setPlaybackState('stopped')}
              onRecord={() => setPlaybackState('recording')}
              onFastForward={() => console.log('FF')}
              onRewind={() => console.log('REW')}
            />
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative">
            <CodeflowCanvas playbackState={playbackState} />
            {/* Heatmap overlay */}
            <div className="heatmap-overlay" />
          </div>

          {/* Terminal Panel */}
          {terminalOpen && (
            <TerminalPanel
              className="h-48 border-t border-[#2a2a3a]"
              onClose={() => setTerminalOpen(false)}
            />
          )}
        </div>

        {/* Right Panel */}
        <RightPanel className="w-72 flex-shrink-0" />
      </div>
    </div>
  );
}