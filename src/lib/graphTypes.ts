export interface NodeData {
  id: string;
  degree: number;
  in_degree: number;
  out_degree: number;
  pagerank: number;
  community: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface EdgeData {
  source: string;
  target: string;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  avgDegree: number;
  maxDegree: number;
  communities: number;
  density: number;
}

export interface SimulationResult {
  removedNode: NodeData;
  beforeStats: GraphStats;
  afterStats: GraphStats;
  componentsBefore: number;
  componentsAfter: number;
  impactScore: number;
}

export interface ClusteringResult {
  nodeId: string;
  coefficient: number;
  neighbors: number;
  connectedPairs: number;
}

export interface BridgeEdge {
  source: string;
  target: string;
  importance: number; // How critical is this bridge
}

export interface BetweennessResult {
  nodeId: string;
  betweenness: number;
  normalizedBetweenness: number;
}

export interface DegreeDistribution {
  degree: number;
  count: number;
  percentage: number;
}

export interface SimilarityResult {
  nodeA: string;
  nodeB: string;
  jaccardSimilarity: number;
  commonNeighbors: number;
  adamicAdar: number;
}

export interface KCoreResult {
  nodeId: string;
  coreness: number;
  shell: number;
}

export interface FlowSimulation {
  step: number;
  infectedNodes: Set<string>;
  infectedCount: number;
  newInfections: number;
}

export interface NetworkAnalysis {
  clustering: {
    average: number;
    global: number;
    distribution: ClusteringResult[];
  };
  bridges: BridgeEdge[];
  betweenness: BetweennessResult[];
  degreeDistribution: DegreeDistribution[];
  averagePathLength: number;
  diameter: number;
  kCore: {
    maxK: number;
    distribution: KCoreResult[];
  };
}

export const COMMUNITY_COLORS = [
  'hsl(170, 80%, 50%)',   // cyan
  'hsl(280, 60%, 55%)',   // purple
  'hsl(45, 90%, 55%)',    // amber
  'hsl(340, 70%, 55%)',   // pink
  'hsl(200, 70%, 55%)',   // blue
  'hsl(120, 60%, 45%)',   // green
  'hsl(30, 80%, 55%)',    // orange
  'hsl(0, 70%, 55%)',     // red
  'hsl(60, 70%, 50%)',    // yellow
  'hsl(240, 50%, 60%)',   // indigo
];

// ===== RESEARCH QUESTIONS INTERFACES =====

export interface RQ1TopologyResult {
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  density: number;
  diameter: number;
  connectedComponents: number;
  degreeDistribution: Array<{degree: number; count: number}>;
}

export interface RQ2CentralityResult {
  topByDegree: Array<{id: string; value: number}>;
  topByBetweenness: Array<{id: string; value: number}>;
  topByCloseness: Array<{id: string; value: number}>;
  topByPageRank: Array<{id: string; value: number}>;
}

export interface RQ5SmallWorldResult {
  avgClusteringCoeff: number;
  avgPathLength: number;
  isSmallWorld: boolean;
  randomClustering: number;
  randomAvgPath: number;
}

export interface RQ6WeightedFlowResult {
  giniCoefficient: number;
  concentration: number;
  avgFlowPerNode: number;
  maxFlow: number;
  flowDistribution: string;
}

export interface RQ4TemporalResult {
  peakHours: number[];
  volumeByHour: Array<{hour: number; volume: number}>;
  recommendation: string;
}
