import { useEffect } from 'react';
import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TreeNode from './TreeNode';
import { useTreeStore } from '../../store/treeStore';
import { transformTreeData } from '../../utils/treeTransform';
import api from '../../utils/api';

const NODE_TYPES = { treeNode: TreeNode };

export default function DocumentTree({ sessionId }) {
  const treeData     = useTreeStore((s) => s.treeData);
  const rfNodesStore = useTreeStore((s) => s.rfNodes);
  const rfEdgesStore = useTreeStore((s) => s.rfEdges);
  const setTreeData  = useTreeStore((s) => s.setTreeData);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch tree once per session (skip if already in store)
  useEffect(() => {
    if (!sessionId || treeData) return;
    api
      .get(`/tree?session_id=${sessionId}`)
      .then((res) => {
        const { nodes: rfN, edges: rfE } = transformTreeData(res.data);
        setTreeData(res.data, rfN, rfE);
      })
      .catch((err) => console.error('Failed to load tree:', err));
  }, [sessionId, treeData, setTreeData]);

  // Sync store → local React Flow state whenever store updates
  useEffect(() => {
    setNodes(rfNodesStore);
    setEdges(rfEdgesStore);
  }, [rfNodesStore, rfEdgesStore, setNodes, setEdges]);

  if (!treeData) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400 text-sm font-body">
        Loading tree…
      </div>
    );
  }

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}
