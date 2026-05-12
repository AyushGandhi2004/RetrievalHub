import { APP_CONFIG } from '../config/app.config';

const NODE_WIDTH  = APP_CONFIG.treeNodeWidth;
const NODE_HEIGHT = APP_CONFIG.treeNodeHeight;
const H_GAP = 40;
const V_GAP = 80;

/**
 * Converts the flat API tree JSON (nodes array + edges array) into the
 * format expected by React Flow: { nodes: [...], edges: [...] }.
 *
 * Positions are computed with a simple top-down BFS layout.
 */
export function transformTreeData(apiData) {
  if (!apiData?.nodes?.length) return { nodes: [], edges: [] };

  const nodeMap = Object.fromEntries(apiData.nodes.map((n) => [n.id, n]));
  const childrenMap = {};
  const parentMap   = {};

  apiData.edges.forEach(({ source, target }) => {
    if (!childrenMap[source]) childrenMap[source] = [];
    childrenMap[source].push(target);
    parentMap[target] = source;
  });

  const root = apiData.nodes.find((n) => !parentMap[n.id]);
  if (!root) return { nodes: [], edges: [] };

  const positions = {};
  let nextX = {};

  function assignPositions(id, depth) {
    const children = childrenMap[id] || [];
    children.forEach((cid) => assignPositions(cid, depth + 1));

    if (!nextX[depth]) nextX[depth] = 0;

    let x;
    if (children.length === 0) {
      x = nextX[depth] * (NODE_WIDTH + H_GAP);
      nextX[depth]++;
    } else {
      const childXs = children.map((cid) => positions[cid].x);
      x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    }

    positions[id] = { x, y: depth * (NODE_HEIGHT + V_GAP) };
  }

  assignPositions(root.id, 0);

  const rfNodes = apiData.nodes.map((n) => ({
    id:       n.id,
    type:     'treeNode',
    position: positions[n.id] || { x: 0, y: 0 },
    data:     { ...n },
  }));

  const rfEdges = apiData.edges.map(({ source, target }) => ({
    id:     `e-${source}-${target}`,
    source,
    target,
    type:   'smoothstep',
    style:  { stroke: '#C5C1BA', strokeWidth: 1.5 },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}
