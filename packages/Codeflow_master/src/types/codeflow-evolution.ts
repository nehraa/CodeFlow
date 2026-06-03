/**
 * Type definitions for @abhinav2203/codeflow-evolution
 * Genetic algorithm for architecture evolution with AI-powered ghost nodes
 */

export interface GhostNode {
  id: string;
  genotype: Genotype;
  phenotype?: any;
  fitness: number;
  generation: number;
  parentIds: string[];
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface Genotype {
  structure: {
    nodes: number;
    layers: number;
    connections: number;
    [key: string]: any;
  };
  parameters: {
    learningRate: number;
    threshold: number;
    mutationStrength?: number;
    [key: string]: any;
  };
  encoding: string;
}

export interface EvolutionConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  generations: number;
  selectionPressure?: number;
  elitism?: number;
  fitnessFunction?: (node: GhostNode) => number;
}

export interface EvolutionResult {
  bestNode: GhostNode;
  finalPopulation: GhostNode[];
  history: EvolutionHistoryEntry[];
  duration: number;
  success: boolean;
}

export interface EvolutionHistoryEntry {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  bestNodeId: string;
  diversity: number;
}

export interface EvolutionEngine {
  initialize(config?: Partial<EvolutionConfig>): Promise<void>;
  evolve(): Promise<EvolutionResult>;
  stop(): void;
  getPopulation(): GhostNode[];
  getGeneration(): number;
  getBestNode(): GhostNode | undefined;
  getHistory(): EvolutionHistoryEntry[];
  getConfig(): EvolutionConfig;
  addToPopulation(node: GhostNode): void;
  removeFromPopulation(nodeId: string): void;
  isRunning(): boolean;
}

export interface SelectionMethod {
  type: 'tournament' | 'roulette' | 'rank' | 'truncation';
  tournamentSize?: number;
  tournamentProbability?: number;
}

export interface CrossoverMethod {
  type: 'single-point' | 'two-point' | 'uniform' | 'arithmetic';
  probability: number;
}

export interface MutationMethod {
  type: 'gaussian' | 'random' | 'creep' | 'step';
  rate: number;
  strength?: number;
}

export interface EvolutionEvent {
  type: 'generation_complete' | 'evolution_complete' | 'population_updated' | 'best_node_improved';
  generation?: number;
  bestFitness?: number;
  nodeId?: string;
  timestamp: number;
}

export interface DiversityMetrics {
  geneticDiversity: number;
  fitnessDiversity: number;
  structuralDiversity: number;
}

export interface BreedingResult {
  offspring: GhostNode[];
  parents: GhostNode[];
  method: 'crossover' | 'mutation' | 'cloning';
}