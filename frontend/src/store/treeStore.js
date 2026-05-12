import { create } from 'zustand';

export const useTreeStore = create((set) => ({
  treeData:         null,   // raw API response
  rfNodes:          [],     // React Flow nodes
  rfEdges:          [],     // React Flow edges
  highlightedNodes: [],     // node IDs highlighted from traversal path
  selectedNode:     null,   // node clicked in React Flow

  setTreeData: (data, rfNodes, rfEdges) =>
    set({ treeData: data, rfNodes, rfEdges, highlightedNodes: [] }),

  setHighlightedNodes: (ids) => set({ highlightedNodes: ids }),

  setSelectedNode: (node) => set({ selectedNode: node }),

  clearTree: () =>
    set({ treeData: null, rfNodes: [], rfEdges: [], highlightedNodes: [], selectedNode: null }),
}));
