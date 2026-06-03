'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  Database,
  GitBranch,
  FileText,
  ChevronDown,
  ChevronRight,
  File,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeftSidebarProps {
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export function LeftSidebar({ className }: LeftSidebarProps) {
  const [expanded, setExpanded] = useState<string>('files');
  const [activeTab, setActiveTab] = useState('files');

  const tabs: NavItem[] = [
    {
      id: 'files',
      label: 'Files',
      icon: FolderOpen,
      content: <FileTree />,
    },
    {
      id: 'store',
      label: 'Store',
      icon: Database,
      content: <StorePanel />,
    },
    {
      id: 'version',
      label: 'Version',
      icon: GitBranch,
      content: <VersionPanel />,
    },
    {
      id: 'prd',
      label: 'PRD',
      icon: FileText,
      content: <PRDPanel />,
    },
  ];

  return (
    <div className={cn('h-full bg-[#13131a] border-r border-[#2a2a3a] flex flex-col', className)}>
      {/* Tab Headers */}
      <div className="flex border-b border-[#2a2a3a]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setExpanded(tab.id);
            }}
            className={cn(
              'flex-1 py-3 flex items-center justify-center transition-colors relative',
              activeTab === tab.id
                ? 'text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tabs.find((t) => t.id === expanded)?.content}
      </div>
    </div>
  );
}

function FileTree() {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/components']));

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const files = [
    {
      id: 'src',
      label: 'src',
      type: 'folder' as const,
      children: [
        {
          id: 'src/components',
          label: 'components',
          type: 'folder' as const,
          children: [
            { id: 'src/components/canvas', label: 'canvas', type: 'folder' as const, children: [] },
            { id: 'src/components/panels', label: 'panels', type: 'folder' as const, children: [] },
            { id: 'src/components/ui', label: 'ui', type: 'folder' as const, children: [] },
            { id: 'src/components/Header.tsx', label: 'Header.tsx', type: 'file' as const },
          ],
        },
        { id: 'src/lib', label: 'lib', type: 'folder' as const, children: [] },
        { id: 'src/app', label: 'app', type: 'folder' as const, children: [] },
      ],
    },
    {
      id: 'package.json',
      label: 'package.json',
      type: 'file' as const,
    },
    {
      id: 'tsconfig.json',
      label: 'tsconfig.json',
      type: 'file' as const,
    },
  ];

  return (
    <div className="p-2 text-sm">
      {files.map((file) => (
        <FileTreeItem
          key={file.id}
          item={file}
          expandedFolders={expandedFolders}
          onToggle={toggleFolder}
          level={0}
        />
      ))}
    </div>
  );
}

function FileTreeItem({
  item,
  expandedFolders,
  onToggle,
  level,
}: {
  item: { id: string; label: string; type: 'file' | 'folder'; children?: any[] };
  expandedFolders: Set<string>;
  onToggle: (id: string) => void;
  level: number;
}) {
  const isExpanded = expandedFolders.has(item.id);

  return (
    <div>
      <button
        onClick={() => item.type === 'folder' && onToggle(item.id)}
        className={cn(
          'w-full flex items-center gap-2 py-1 px-2 rounded hover:bg-[#1a1a24] text-slate-300 text-left',
          item.type === 'folder' ? 'cursor-pointer' : 'cursor-default'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {item.type === 'folder' ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-500" />
            )}
            <Folder className="w-4 h-4 text-amber-500" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <File className="w-4 h-4 text-slate-500" />
          </>
        )}
        <span className="truncate">{item.label}</span>
      </button>
      {item.type === 'folder' && isExpanded && item.children && (
        <div>
          {item.children.map((child: any) => (
            <FileTreeItem
              key={child.id}
              item={child}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StorePanel() {
  return (
    <div className="p-3 text-sm">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Session Store</div>
      <div className="space-y-2">
        <div className="flex justify-between text-slate-300">
          <span>Checkpoints</span>
          <span className="text-indigo-400">12</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Pending</span>
          <span className="text-amber-400">3</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Approved</span>
          <span className="text-emerald-400">8</span>
        </div>
      </div>
    </div>
  );
}

function VersionPanel() {
  return (
    <div className="p-3 text-sm">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recent Changes</div>
      <div className="space-y-2">
        <div className="p-2 rounded bg-[#1a1a24] border border-[#2a2a3a]">
          <div className="text-slate-300 text-xs">feat: VCR controls</div>
          <div className="text-slate-500 text-xs">2 hours ago</div>
        </div>
        <div className="p-2 rounded bg-[#1a1a24] border border-[#2a2a3a]">
          <div className="text-slate-300 text-xs">fix: canvas render</div>
          <div className="text-slate-500 text-xs">5 hours ago</div>
        </div>
      </div>
    </div>
  );
}

function PRDPanel() {
  return (
    <div className="p-3 text-sm">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">PRD Documents</div>
      <div className="space-y-2">
        <div className="p-2 rounded bg-[#1a1a24] border border-[#2a2a3a]">
          <div className="text-slate-300 text-xs">Codeflow v2.0 PRD</div>
          <div className="text-slate-500 text-xs">Processing</div>
        </div>
      </div>
    </div>
  );
}