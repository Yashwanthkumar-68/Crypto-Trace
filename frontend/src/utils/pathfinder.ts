import { ThreatGraphNode, ThreatGraphLink } from '../components/ThreatGraph';

export interface PathResult {
  pathNodeIds: Set<string>;
  pathLinkIds: Set<string>;
  orderedNodes: string[];
  hops: number;
  totalAmount: number;
}

/**
 * Dijkstra / Breadth-First pathfinding algorithm to discover the optimal
 * transaction route connecting a Source address and a Sink address.
 *
 * Runs purely in memory without mutating graph coordinates or React state.
 */
export function findShortestPath(
  nodes: ThreatGraphNode[],
  links: ThreatGraphLink[],
  sourceInput: string,
  targetInput: string
): PathResult | null {
  if (!sourceInput || !targetInput) return null;

  const cleanSource = sourceInput.trim().toLowerCase();
  const cleanTarget = targetInput.trim().toLowerCase();

  // Find corresponding node IDs matching either ID or address
  const sourceNode = nodes.find(
    (n) => n.id.toLowerCase() === cleanSource || n.address.toLowerCase() === cleanSource
  );
  const targetNode = nodes.find(
    (n) => n.id.toLowerCase() === cleanTarget || n.address.toLowerCase() === cleanTarget
  );

  if (!sourceNode || !targetNode) return null;
  if (sourceNode.id === targetNode.id) {
    return {
      pathNodeIds: new Set([sourceNode.id]),
      pathLinkIds: new Set(),
      orderedNodes: [sourceNode.id],
      hops: 0,
      totalAmount: 0
    };
  }

  // Build Adjacency List: map from nodeId -> array of { neighborId, linkId, amount }
  // We prefer forward fund flows (source -> target), with fallback to undirected if no forward path exists
  const forwardAdj = new Map<string, Array<{ neighbor: string; link: ThreatGraphLink }>>();
  const undirectedAdj = new Map<string, Array<{ neighbor: string; link: ThreatGraphLink }>>();

  links.forEach((link) => {
    const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;

    if (!forwardAdj.has(sId)) forwardAdj.set(sId, []);
    forwardAdj.get(sId)!.push({ neighbor: tId, link });

    if (!undirectedAdj.has(sId)) undirectedAdj.set(sId, []);
    undirectedAdj.get(sId)!.push({ neighbor: tId, link });

    if (!undirectedAdj.has(tId)) undirectedAdj.set(tId, []);
    undirectedAdj.get(tId)!.push({ neighbor: sId, link });
  });

  // BFS / Dijkstra function
  const runSearch = (adj: Map<string, Array<{ neighbor: string; link: ThreatGraphLink }>>) => {
    const queue: string[] = [sourceNode.id];
    const visited = new Set<string>([sourceNode.id]);
    const previous = new Map<string, { prevNode: string; link: ThreatGraphLink }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetNode.id) break;

      const neighbors = adj.get(current) || [];
      for (const { neighbor, link } of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          previous.set(neighbor, { prevNode: current, link });
          queue.push(neighbor);
        }
      }
    }

    if (!previous.has(targetNode.id)) return null;

    // Reconstruct path backwards from target to source
    const pathNodeIds = new Set<string>();
    const pathLinkIds = new Set<string>();
    const orderedNodes: string[] = [];
    let totalAmount = 0;

    let curr = targetNode.id;
    while (curr !== sourceNode.id) {
      pathNodeIds.add(curr);
      orderedNodes.unshift(curr);
      const step = previous.get(curr);
      if (!step) break;
      pathLinkIds.add(step.link.id);
      totalAmount += step.link.amount || 0;
      curr = step.prevNode;
    }
    pathNodeIds.add(sourceNode.id);
    orderedNodes.unshift(sourceNode.id);

    return {
      pathNodeIds,
      pathLinkIds,
      orderedNodes,
      hops: pathLinkIds.size,
      totalAmount
    };
  };

  // Try forward directed fund path first; if none, check undirected connection
  return runSearch(forwardAdj) || runSearch(undirectedAdj);
}
