import { ThreatGraphNode, ThreatGraphLink } from '../components/ThreatGraph';

export interface PatternAlert {
  id: string;
  type: 'Peeling Chain' | 'Smurfing' | 'Dusting Attack';
  severity: 'high' | 'medium' | 'low';
  description: string;
  involvedNodes: string[];
}

export function detectLaunderingPatterns(
  nodes: ThreatGraphNode[],
  links: ThreatGraphLink[]
): PatternAlert[] {
  const alerts: PatternAlert[] = [];
  
  // 1. Detect Smurfing (Fan-in > 5 inputs to 1 target in short timeframe)
  // Simple heuristic: count incoming links per target
  const incomingCount: Record<string, string[]> = {};
  links.forEach(link => {
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    if (!incomingCount[targetId]) incomingCount[targetId] = [];
    incomingCount[targetId].push(sourceId);
  });

  Object.entries(incomingCount).forEach(([target, sources]) => {
    if (sources.length >= 5) {
      alerts.push({
        id: `smurf-${target}`,
        type: 'Smurfing',
        severity: 'high',
        description: `Fan-in detected: ${sources.length} inputs converging on ${target.substring(0, 8)}...`,
        involvedNodes: [target, ...sources]
      });
    }
  });

  // 2. Detect Peeling Chains
  // Heuristic: A node sends a small amount to one node, and the rest to a new change address, repeating.
  // We'll look for chains of length >= 3
  // (Simplified for prototype)
  const outgoingMap: Record<string, ThreatGraphLink[]> = {};
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    if (!outgoingMap[sourceId]) outgoingMap[sourceId] = [];
    outgoingMap[sourceId].push(link);
  });

  Object.entries(outgoingMap).forEach(([source, outLinks]) => {
    // A classic peel step: 2 outputs (one small, one large change)
    if (outLinks.length === 2) {
      const target1 = typeof outLinks[0].target === 'object' ? outLinks[0].target.id : outLinks[0].target;
      const target2 = typeof outLinks[1].target === 'object' ? outLinks[1].target.id : outLinks[1].target;
      
      // If the target continues to split, it's a peel chain
      if (outgoingMap[target1]?.length === 2 || outgoingMap[target2]?.length === 2) {
        alerts.push({
          id: `peel-${source}`,
          type: 'Peeling Chain',
          severity: 'high',
          description: `Peeling chain detected starting at ${source.substring(0, 8)}... (Funds are being systematically split)`,
          involvedNodes: [source, target1, target2]
        });
      }
    }
  });

  // 3. Detect Dusting Attacks (Micro-transfers broadcast to multiple addresses)
  const dustingMap: Record<string, string[]> = {};
  links.forEach(link => {
    if (link.amount > 0 && link.amount < 0.005) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (!dustingMap[sourceId]) dustingMap[sourceId] = [];
      if (!dustingMap[sourceId].includes(targetId)) dustingMap[sourceId].push(targetId);
    }
  });

  Object.entries(dustingMap).forEach(([source, dustTargets]) => {
    if (dustTargets.length >= 3) {
      alerts.push({
        id: `dust-${source}`,
        type: 'Dusting Attack',
        severity: 'medium',
        description: `Dusting attack detected: ${source.substring(0, 8)}... broadcast micro-transfers to ${dustTargets.length} addresses for de-anonymization.`,
        involvedNodes: [source, ...dustTargets]
      });
    }
  });

  // Deduplicate and return
  return alerts.filter((alert, index, self) => 
    index === self.findIndex((t) => t.id === alert.id)
  );
}
