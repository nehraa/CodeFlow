'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
  NodeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintNode } from './BlueprintNode';
import { AgentNode } from './AgentNode';
import { GhostNode } from './GhostNode';
import { TwinNode } from './TwinNode';
import { ExecutionNode } from './ExecutionNode';
import { cn } from '@/lib/utils';

type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';

// Custom node types
const nodeTypes: NodeTypes = {
  blueprint: BlueprintNode,
  agent: AgentNode,
  ghost: GhostNode,
  twin: TwinNode,
  execution: ExecutionNode,
};

// Initial demo nodes
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'blueprint',
    position: { x: 250, y: 100 },
    data: {
      label: 'Blueprint Generator',
      description: 'Generate code blueprints',
      selected: false,
    },
  },
  {
    id: '2',
    type: 'agent',
    position: { x: 100, y: 280 },
    data: {
      label: 'Agent Orchestrator',
      description: 'Orchestrate subagents',
      status: 'ready',
      selected: false,
    },
  },
  {
    id: '3',
    type: 'ghost',
    position: { x: 400, y: 280 },
    data: {
      label: 'Ghost Node',
      description: 'Evolution candidate',
      fitness: 0.85,
      selected: false,
    },
  },
  {
    id: '4',
    type: 'twin',
    position: { x: 250, y: 450 },
    data: {
      label: 'Digital Twin',
      description: 'Simulation state',
      syncStatus: 'synced',
      selected: false,
    },
  },
  {
    id: '5',
    type: 'execution',
    position: { x: 550, y: 280 },
    data: {
      label: 'Execution Engine',
      description: 'Run generated code',
      output: 'console.log("Hello")',
      selected: false,
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e2-5', source: '2', target: '5', animated: true },
];

interface CodeflowCanvasProps {
  playbackState: PlaybackState;
  className?: string;
}

export function CodeflowCanvas({ playbackState, className }: CodeflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === node.id },
      }))
    );
  }, [setNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: false },
      }))
    );
  }, [setNodes]);

  return (
    <div className={cn('w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#0a0a0f]"
      >
        <Controls className="bg-[#13131a] border border-[#2a2a3a] rounded-lg" />
        <MiniMap
          className="bg-[#13131a] border border-[#2a2a3a] rounded-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case 'blueprint':
                return '#6366f1';
              case 'agent':
                return '#10b981';
              case 'ghost':
                return '#22d3ee';
              case 'twin':
                return '#f59e0b';
              case 'execution':
                return '#ef4444';
              default:
                return '#6366f1';
            }
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#2a2a3a"
        />

        {/* Info Panel */}
        <Panel position="top-left" className="bg-[#13131a]/90 border border-[#2a2a3a] rounded-lg p-3">
          <div className="text-sm text-slate-300">
            <span className="text-slate-500">Mode:</span>{' '}
            <span className={cn(
              playbackState === 'playing' && 'text-emerald-400',
              playbackState === 'paused' && 'text-amber-400',
              playbackState === 'recording' && 'text-red-400',
            )}>
              {playbackState.toUpperCase()}
            </span>
          </div>
        </Panel>
      </ReactFlow>

      {/* Selection glow overlay for selected node */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}