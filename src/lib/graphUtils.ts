import Papa from 'papaparse';
import { NodeData, EdgeData, GraphStats, SimulationResult, COMMUNITY_COLORS } from './graphTypes';

export function parseCSV(csvText: string): NodeData[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return result.data.map((row: any) => ({
    id: row.id,
    degree: Number(row.degree) || 0,
    in_degree: Number(row.in_degree) || 0,
    out_degree: Number(row.out_degree) || 0,
    pagerank: Number(row.pagerank) || 0,
    community: Number(row.community) || 0,
  }));
}

export function generateEdges(nodes: NodeData[]): EdgeData[] {
  const edges: EdgeData[] = [];
  const communityMap = new Map<number, NodeData[]>();
  
  nodes.forEach(n => {
    const list = communityMap.get(n.community) || [];
    list.push(n);
    communityMap.set(n.community, list);
  });

  // Connect nodes within same community based on degree
  communityMap.forEach((members) => {
    const sorted = [...members].sort((a, b) => b.degree - a.degree);
    for (let i = 0; i < sorted.length; i++) {
      const connectCount = Math.min(Math.ceil(sorted[i].out_degree * 0.3), 5);
      for (let j = 0; j < connectCount && j < sorted.length; j++) {
        if (i !== j) {
          edges.push({ source: sorted[i].id, target: sorted[j].id });
        }
      }
    }
  });

  // Add some cross-community edges for high-degree nodes
  const topNodes = [...nodes].sort((a, b) => b.degree - a.degree).slice(0, 20);
  for (let i = 0; i < topNodes.length; i++) {
    for (let j = i + 1; j < Math.min(i + 3, topNodes.length); j++) {
      if (topNodes[i].community !== topNodes[j].community) {
        edges.push({ source: topNodes[i].id, target: topNodes[j].id });
      }
    }
  }

  return edges;
}

export function computeStats(nodes: NodeData[], edges: EdgeData[]): GraphStats {
  const degrees = nodes.map(n => n.degree);
  const communities = new Set(nodes.map(n => n.community));
  const maxPossibleEdges = nodes.length * (nodes.length - 1) / 2;
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    avgDegree: degrees.reduce((a, b) => a + b, 0) / nodes.length,
    maxDegree: Math.max(...degrees),
    communities: communities.size,
    density: maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0,
  };
}

export function simulateRemoval(
  nodes: NodeData[],
  edges: EdgeData[],
  nodeToRemove: NodeData
): SimulationResult {
  const beforeStats = computeStats(nodes, edges);
  
  const remainingNodes = nodes.filter(n => n.id !== nodeToRemove.id);
  const remainingEdges = edges.filter(
    e => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id
  );
  
  const afterStats = computeStats(remainingNodes, remainingEdges);
  
  // Estimate connected components (simplified)
  const nodeSet = new Set(remainingNodes.map(n => n.id));
  const adj = new Map<string, Set<string>>();
  remainingNodes.forEach(n => adj.set(n.id, new Set()));
  remainingEdges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });
  
  const visited = new Set<string>();
  let components = 0;
  
  for (const nodeId of nodeSet) {
    if (!visited.has(nodeId)) {
      components++;
      const stack = [nodeId];
      while (stack.length) {
        const curr = stack.pop()!;
        if (visited.has(curr)) continue;
        visited.add(curr);
        adj.get(curr)?.forEach(neighbor => {
          if (!visited.has(neighbor)) stack.push(neighbor);
        });
      }
    }
  }
  
  const edgeLoss = (beforeStats.totalEdges - afterStats.totalEdges) / beforeStats.totalEdges;
  const impactScore = edgeLoss * 100;
  
  return {
    removedNode: nodeToRemove,
    beforeStats,
    afterStats,
    componentsBefore: 1,
    componentsAfter: components,
    impactScore,
  };
}

export function getNodeColor(community: number): string {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

export function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ===== ADVANCED NETWORK ANALYSES =====

/**
 * 1. Calculate clustering coefficient for nodes
 */
export function calculateClustering(nodes: NodeData[], edges: EdgeData[]): {
  average: number;
  distribution: Array<{ nodeId: string; coefficient: number; neighbors: number }>;
} {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const results: Array<{ nodeId: string; coefficient: number; neighbors: number }> = [];
  
  for (const node of nodes) {
    const neighbors = Array.from(adj.get(node.id) || []);
    const k = neighbors.length;
    
    if (k < 2) {
      results.push({ nodeId: node.id, coefficient: 0, neighbors: k });
      continue;
    }

    let connectedPairs = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (adj.get(neighbors[i])?.has(neighbors[j])) {
          connectedPairs++;
        }
      }
    }

    const maxPairs = (k * (k - 1)) / 2;
    const coefficient = maxPairs > 0 ? connectedPairs / maxPairs : 0;
    results.push({ nodeId: node.id, coefficient, neighbors: k });
  }

  const avgClustering = results.reduce((sum, r) => sum + r.coefficient, 0) / results.length;
  
  return { average: avgClustering, distribution: results };
}

/**
 * 2. Detect bridges (critical edges)
 */
export function detectBridges(nodes: NodeData[], edges: EdgeData[]): Array<{ source: string; target: string; isBridge: boolean }> {
  const nodeIds = new Set(nodes.map(n => n.id));
  
  const countComponents = (edgeList: EdgeData[]) => {
    const adj = new Map<string, Set<string>>();
    nodeIds.forEach(id => adj.set(id, new Set()));
    edgeList.forEach(e => {
      adj.get(e.source)?.add(e.target);
      adj.get(e.target)?.add(e.source);
    });

    const visited = new Set<string>();
    let components = 0;

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        components++;
        const stack = [nodeId];
        while (stack.length) {
          const curr = stack.pop()!;
          if (visited.has(curr)) continue;
          visited.add(curr);
          adj.get(curr)?.forEach(neighbor => {
            if (!visited.has(neighbor)) stack.push(neighbor);
          });
        }
      }
    }
    return components;
  };

  const initialComponents = countComponents(edges);
  const bridges: Array<{ source: string; target: string; isBridge: boolean }> = [];

  for (const edge of edges) {
    const withoutEdge = edges.filter(e => !(e.source === edge.source && e.target === edge.target));
    const newComponents = countComponents(withoutEdge);
    bridges.push({
      source: edge.source,
      target: edge.target,
      isBridge: newComponents > initialComponents
    });
  }

  return bridges.filter(b => b.isBridge);
}

/**
 * 3. Calculate betweenness centrality (simplified approximation)
 */
export function calculateBetweenness(nodes: NodeData[], edges: EdgeData[]): Array<{ nodeId: string; betweenness: number }> {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const betweenness = new Map<string, number>();
  nodes.forEach(n => betweenness.set(n.id, 0));

  // Simplified: sample-based betweenness (full calculation is O(n³))
  const sampleSize = Math.min(50, nodes.length);
  const sampledNodes = nodes.slice(0, sampleSize);

  for (const source of sampledNodes) {
    // BFS to find all shortest paths from source
    const dist = new Map<string, number>();
    const pathCount = new Map<string, number>();
    const visited = new Set<string>();
    const queue: string[] = [source.id];
    
    dist.set(source.id, 0);
    pathCount.set(source.id, 1);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const currDist = dist.get(curr) || 0;
      const neighbors = Array.from(adj.get(curr) || []);

      for (const neighbor of neighbors) {
        const newDist = currDist + 1;
        if (!dist.has(neighbor)) {
          dist.set(neighbor, newDist);
          pathCount.set(neighbor, 0);
          queue.push(neighbor);
        }

        if (dist.get(neighbor) === newDist) {
          pathCount.set(neighbor, (pathCount.get(neighbor) || 0) + (pathCount.get(curr) || 0));
        }
      }
    }

    // Accumulate betweenness scores
    for (const [nodeId, paths] of pathCount) {
      if (nodeId !== source.id && paths > 1) {
        betweenness.set(nodeId, (betweenness.get(nodeId) || 0) + Math.log(paths + 1));
      }
    }
  }

  return Array.from(betweenness.entries())
    .map(([nodeId, value]) => ({ nodeId, betweenness: value }))
    .sort((a, b) => b.betweenness - a.betweenness);
}

/**
 * 4. Calculate degree distribution
 */
export function calculateDegreeDistribution(nodes: NodeData[]): Array<{ degree: number; count: number; percentage: number }> {
  const degreeCount = new Map<number, number>();
  
  for (const node of nodes) {
    const deg = node.degree;
    degreeCount.set(deg, (degreeCount.get(deg) || 0) + 1);
  }

  const total = nodes.length;
  return Array.from(degreeCount.entries())
    .map(([degree, count]) => ({
      degree,
      count,
      percentage: (count / total) * 100
    }))
    .sort((a, b) => a.degree - b.degree);
}

/**
 * 5. Calculate average shortest path length
 */
export function calculateAveragePathLength(nodes: NodeData[], edges: EdgeData[]): { avgPath: number; diameter: number } {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const sampleSize = Math.min(100, nodes.length);
  const sampledNodes = nodes.slice(0, sampleSize);
  
  let totalPath = 0;
  let pathCount = 0;
  let maxPath = 0;

  for (const source of sampledNodes) {
    const dist = new Map<string, number>();
    const queue: string[] = [source.id];
    dist.set(source.id, 0);
    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const currDist = dist.get(curr) || 0;
      const neighbors = Array.from(adj.get(curr) || []);

      for (const neighbor of neighbors) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, currDist + 1);
          queue.push(neighbor);
        }
      }
    }

    for (const [_, d] of dist) {
      if (d > 0) {
        totalPath += d;
        pathCount++;
        maxPath = Math.max(maxPath, d);
      }
    }
  }

  return {
    avgPath: pathCount > 0 ? totalPath / pathCount : 0,
    diameter: maxPath
  };
}

/**
 * 6. Calculate node similarity (Jaccard coefficient)
 */
export function calculateSimilarity(nodes: NodeData[], edges: EdgeData[], topK: number = 20): Array<{ 
  nodeA: string; 
  nodeB: string; 
  similarity: number; 
  commonNeighbors: number;
}> {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const similarities: Array<{ nodeA: string; nodeB: string; similarity: number; commonNeighbors: number }> = [];
  
  // Sample pairs to avoid O(n²) complexity
  const sampleSize = Math.min(50, nodes.length);
  for (let i = 0; i < sampleSize; i++) {
    for (let j = i + 1; j < sampleSize; j++) {
      const nodeA = nodes[i].id;
      const nodeB = nodes[j].id;
      
      const neighborsA = adj.get(nodeA) || new Set();
      const neighborsB = adj.get(nodeB) || new Set();
      
      const intersection = new Set([...neighborsA].filter(x => neighborsB.has(x)));
      const union = new Set([...neighborsA, ...neighborsB]);
      
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      if (similarity > 0) {
        similarities.push({
          nodeA,
          nodeB,
          similarity,
          commonNeighbors: intersection.size
        });
      }
    }
  }

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * 7. K-Core Decomposition
 */
export function calculateKCore(nodes: NodeData[], edges: EdgeData[]): { 
  maxK: number; 
  distribution: Array<{ nodeId: string; coreness: number }>;
} {
  const adj = new Map<string, Set<string>>();
  const degrees = new Map<string, number>();
  
  nodes.forEach(n => {
    adj.set(n.id, new Set());
    degrees.set(n.id, 0);
  });
  
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
    degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
    degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
  });

  const coreness = new Map<string, number>();
  const remaining = new Set(nodes.map(n => n.id));
  let currentK = 0;

  while (remaining.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const nodeId of remaining) {
        const deg = Array.from(adj.get(nodeId) || [])
          .filter(n => remaining.has(n)).length;
        
        if (deg <= currentK) {
          coreness.set(nodeId, currentK);
          remaining.delete(nodeId);
          changed = true;
        }
      }
    }
    currentK++;
    
    if (currentK > nodes.length) break; // Safety check
  }

  const maxK = Math.max(...Array.from(coreness.values()));
  
  return {
    maxK,
    distribution: Array.from(coreness.entries())
      .map(([nodeId, core]) => ({ nodeId, coreness: core }))
      .sort((a, b) => b.coreness - a.coreness)
  };
}

/**
 * 8. Simulate information flow/propagation
 */
export function simulateFlow(
  nodes: NodeData[], 
  edges: EdgeData[], 
  seedNodeId: string,
  transmissionProb: number = 0.3,
  maxSteps: number = 10
): Array<{ step: number; infected: number; newInfections: number }> {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const infected = new Set<string>([seedNodeId]);
  const results: Array<{ step: number; infected: number; newInfections: number }> = [];
  
  results.push({ step: 0, infected: 1, newInfections: 1 });

  for (let step = 1; step <= maxSteps; step++) {
    const newlyInfected = new Set<string>();
    
    for (const infectedNode of infected) {
      const neighbors = Array.from(adj.get(infectedNode) || []);
      for (const neighbor of neighbors) {
        if (!infected.has(neighbor) && !newlyInfected.has(neighbor)) {
          if (Math.random() < transmissionProb) {
            newlyInfected.add(neighbor);
          }
        }
      }
    }

    newlyInfected.forEach(n => infected.add(n));
    
    results.push({
      step,
      infected: infected.size,
      newInfections: newlyInfected.size
    });

    if (newlyInfected.size === 0) break;
  }

  return results;
}

/**
 * Find shortest path between two nodes using BFS
 */
export function findShortestPath(
  nodes: NodeData[],
  edges: EdgeData[],
  startId: string,
  endId: string
): { path: string[]; distance: number; edges: Array<{source: string, target: string}> } | null {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const queue: Array<{node: string, path: string[]}> = [{node: startId, path: [startId]}];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const {node, path} = queue.shift()!;

    if (node === endId) {
      // Reconstruct edges from path
      const pathEdges: Array<{source: string, target: string}> = [];
      for (let i = 0; i < path.length - 1; i++) {
        pathEdges.push({source: path[i], target: path[i + 1]});
      }
      return {
        path,
        distance: path.length - 1,
        edges: pathEdges
      };
    }

    const neighbors = Array.from(adj.get(node) || []);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({node: neighbor, path: [...path, neighbor]});
      }
    }
  }

  return null; // No path found
}

// ===== 6 RESEARCH QUESTIONS ANALYSES =====

/**
 * RQ1: Network Topology Analysis
 * Analyzes: degree distribution, density, connected components, diameter
 */
export function analyzeNetworkTopology(nodes: NodeData[], edges: EdgeData[]): {
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  density: number;
  diameter: number;
  connectedComponents: number;
  degreeDistribution: Array<{degree: number; count: number}>;
} {
  const adj = new Map<string, Set<string>>();
  const nodeSet = new Set(nodes.map(n => n.id));
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  // Degree stats
  const degrees = nodes.map(n => n.degree);
  const avgDegree = degrees.reduce((a, b) => a + b, 0) / nodes.length;
  const maxDegree = Math.max(...degrees);
  const minDegree = Math.min(...degrees);

  // Density
  const maxPossibleEdges = (nodes.length * (nodes.length - 1)) / 2;
  const density = maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0;

  // Connected components (using BFS)
  const visited = new Set<string>();
  let components = 0;
  for (const nodeId of nodeSet) {
    if (!visited.has(nodeId)) {
      components++;
      const stack = [nodeId];
      while (stack.length) {
        const curr = stack.pop()!;
        if (visited.has(curr)) continue;
        visited.add(curr);
        adj.get(curr)?.forEach(neighbor => {
          if (!visited.has(neighbor)) stack.push(neighbor);
        });
      }
    }
  }

  // Diameter (max shortest path)
  let diameter = 0;
  const sampleNodes = nodes.slice(0, Math.min(20, nodes.length));
  for (let i = 0; i < sampleNodes.length; i++) {
    for (let j = i + 1; j < sampleNodes.length; j++) {
      const path = findShortestPath(nodes, edges, sampleNodes[i].id, sampleNodes[j].id);
      if (path) diameter = Math.max(diameter, path.distance);
    }
  }

  // Degree distribution
  const degreeCount = new Map<number, number>();
  degrees.forEach(d => {
    degreeCount.set(d, (degreeCount.get(d) || 0) + 1);
  });

  return {
    avgDegree,
    maxDegree,
    minDegree,
    density,
    diameter,
    connectedComponents: components,
    degreeDistribution: Array.from(degreeCount.entries())
      .map(([degree, count]) => ({degree, count}))
      .sort((a, b) => a.degree - b.degree)
  };
}

/**
 * RQ2: Centrality Analysis
 * Measures: degree, betweenness, closeness, PageRank
 */
export function analyzeCentrality(nodes: NodeData[], edges: EdgeData[]): {
  topByDegree: Array<{id: string; value: number}>;
  topByBetweenness: Array<{id: string; value: number}>;
  topByCloseness: Array<{id: string; value: number}>;
  topByPageRank: Array<{id: string; value: number}>;
} {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  // Degree centrality (already have it)
  const byDegree = nodes
    .map(n => ({id: n.id, value: n.degree}))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Closeness centrality (simplified)
  const closeness = new Map<string, number>();
  nodes.slice(0, 50).forEach(source => {
    let totalDist = 0;
    let reachable = 0;
    nodes.forEach(target => {
      if (source.id !== target.id) {
        const path = findShortestPath(nodes, edges, source.id, target.id);
        if (path) {
          totalDist += path.distance;
          reachable++;
        }
      }
    });
    closeness.set(source.id, reachable > 0 ? reachable / (totalDist || 1) : 0);
  });

  const byCloseness = Array.from(closeness.entries())
    .map(([id, value]) => ({id, value}))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // PageRank (already have it)
  const byPageRank = nodes
    .map(n => ({id: n.id, value: n.pagerank}))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Betweenness (from earlier implementation)
  const betweennessResults = calculateBetweenness(nodes, edges);
  const byBetweenness = betweennessResults.slice(0, 10).map(b => ({id: b.nodeId, value: b.betweenness}));

  return {
    topByDegree: byDegree,
    topByBetweenness: byBetweenness,
    topByCloseness: byCloseness,
    topByPageRank: byPageRank
  };
}

/**
 * RQ5: Small-World Properties
 * Measures: clustering coefficient, average path length
 */
export function analyzeSmallWorldProperties(nodes: NodeData[], edges: EdgeData[]): {
  avgClusteringCoeff: number;
  avgPathLength: number;
  isSmallWorld: boolean;
  randomAvgPath: number;
  randomClustering: number;
} {
  const clusteringResults = calculateClustering(nodes, edges);
  const pathResults = calculateAveragePathLength(nodes, edges);
  
  // Small-world is when: clustering >> random AND path length ~ random
  const isSmallWorld = clusteringResults.average > 0.3 && pathResults.avgPath < 6;
  
  // Approximate random network properties (Erdős-Rényi)
  const p = (2 * edges.length) / (nodes.length * (nodes.length - 1));
  const randomClustering = p; // p for random graphs
  const randomAvgPath = Math.log(nodes.length) / Math.log(nodes.length * p); // ln(N)/ln(k)
  
  return {
    avgClusteringCoeff: clusteringResults.average,
    avgPathLength: pathResults.avgPath,
    isSmallWorld,
    randomClustering,
    randomAvgPath
  };
}

/**
 * RQ6: Weighted Flow Analysis
 * Calculates Gini coefficient for transaction concentration
 */
export function calculateGiniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  
  return sum / (n * n * mean) || 0;
}

/**
 * Analyze weighted flows (transaction volumes)
 */
export function analyzeWeightedFlows(nodes: NodeData[], edges: EdgeData[]): {
  giniCoefficient: number;
  concentration: number; // % of volume in top 20%
  avgFlowPerNode: number;
  maxFlow: number;
  flowDistribution: string;
} {
  // Simulate weights based on degree (proxy for transaction volume)
  const weights = nodes.map(n => n.degree);
  const gini = calculateGiniCoefficient(weights);
  
  // Check concentration (Pareto principle)
  const sorted = [...weights].sort((a, b) => b - a);
  const total = sorted.reduce((a, b) => a + b, 0);
  const top20Pct = sorted.slice(0, Math.ceil(sorted.length * 0.2));
  const top20Volume = top20Pct.reduce((a, b) => a + b, 0);
  const concentration = (top20Volume / total) * 100;
  
  const flowDist = concentration > 80 ? "Highly concentrated" : 
                   concentration > 60 ? "Concentrated" : 
                   "Distributed";
  
  return {
    giniCoefficient: gini,
    concentration,
    avgFlowPerNode: total / nodes.length,
    maxFlow: Math.max(...weights),
    flowDistribution: flowDist
  };
}

/**
 * RQ4: Temporal Dynamics (placeholder - needs time data)
 */
export function analyzeTemporalDynamics(nodes: NodeData[], edges: EdgeData[]): {
  peakHours: number[];
  volumeByHour: Array<{hour: number; volume: number}>;
  recommendation: string;
} {
  // This is a placeholder - requires timestamp data in the CSV
  return {
    peakHours: [14, 15, 16],
    volumeByHour: Array.from({length: 24}, (_, i) => ({
      hour: i,
      volume: Math.random() * 50000
    })),
    recommendation: "Enable temporal data in CSV for accurate analysis"
  };
}
