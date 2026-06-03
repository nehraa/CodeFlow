/**
 * codeflow-evolution wrapper
 * Genetic algorithm for architecture evolution with AI-powered ghost nodes
 */
import type {
  GhostNode,
  Genotype,
  EvolutionConfig,
  EvolutionResult,
  EvolutionHistoryEntry,
  EvolutionEngine,
  DiversityMetrics,
} from '@/types/codeflow-evolution';

// Re-export types
export type { GhostNode, Genotype, EvolutionConfig, EvolutionResult, EvolutionHistoryEntry, DiversityMetrics };

class EvolutionEngineImpl implements EvolutionEngine {
  private population: GhostNode[] = [];
  private config: EvolutionConfig = {
    populationSize: 20,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    generations: 100,
  };
  private generation: number = 0;
  private history: EvolutionHistoryEntry[] = [];
  private running: boolean = false;
  private fitnessFunction: ((node: GhostNode) => number) | undefined;
  private updateListeners: ((event: any) => void)[] = [];

  async initialize(config?: Partial<EvolutionConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    if (this.config.fitnessFunction) {
      this.fitnessFunction = this.config.fitnessFunction;
    }
    this.population = this.initializePopulation();
    console.log('[codeflow-evolution] Evolution engine initialized with config:', this.config);
  }

  private initializePopulation(): GhostNode[] {
    const population: GhostNode[] = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      population.push(this.createRandomNode());
    }
    return population;
  }

  private createRandomNode(parentIds: string[] = []): GhostNode {
    return {
      id: `ghost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      genotype: this.generateRandomGenotype(),
      fitness: 0,
      generation: this.generation,
      parentIds,
      createdAt: Date.now(),
    };
  }

  private generateRandomGenotype(): Genotype {
    return {
      structure: {
        nodes: Math.floor(Math.random() * 10) + 3,
        layers: Math.floor(Math.random() * 4) + 1,
        connections: Math.floor(Math.random() * 15) + 5,
      },
      parameters: {
        learningRate: Math.random() * 0.3 + 0.01,
        threshold: Math.random() * 0.5 + 0.5,
        mutationStrength: 0.1,
      },
      encoding: btoa(JSON.stringify({ timestamp: Date.now() })),
    };
  }

  private defaultFitnessFunction(node: GhostNode): number {
    // Heuristic-based fitness
    const structureScore = node.genotype.structure.nodes / 10;
    const parameterScore = node.genotype.parameters.learningRate;
    const diversityBonus = Math.random() * 0.1; // Simulate diversity
    return Math.min(1, (structureScore + parameterScore) / 2 + diversityBonus);
  }

  async evolve(): Promise<EvolutionResult> {
    this.running = true;
    const startTime = Date.now();
    const bestFitnessHistory: number[] = [];

    for (let gen = 0; gen < this.config.generations && this.running; gen++) {
      this.generation = gen;

      // Evaluate fitness for all nodes
      await this.evaluatePopulation();

      // Record history
      const bestFitness = Math.max(...this.population.map((n) => n.fitness));
      const avgFitness = this.population.reduce((sum, n) => sum + n.fitness, 0) / this.population.length;
      const worstFitness = Math.min(...this.population.map((n) => n.fitness));

      bestFitnessHistory.push(bestFitness);
      this.history.push({
        generation: gen,
        bestFitness,
        averageFitness: avgFitness,
        worstFitness,
        bestNodeId: this.population.find((n) => n.fitness === bestFitness)?.id || '',
        diversity: this.calculateDiversity(),
      });

      // Selection
      await this.selection();

      // Crossover
      await this.crossover();

      // Mutation
      await this.mutation();

      // Emit progress
      this.emitUpdate({
        type: 'generation_complete',
        generation: gen,
        bestFitness,
      });
    }

    this.running = false;

    const bestNode = this.population.reduce((best, node) =>
      node.fitness > best.fitness ? node : best
    );

    return {
      bestNode,
      finalPopulation: this.population,
      history: this.history,
      duration: Date.now() - startTime,
      success: bestFitnessHistory.length > 0,
    };
  }

  private async evaluatePopulation(): Promise<void> {
    for (const node of this.population) {
      node.fitness = this.fitnessFunction
        ? this.fitnessFunction(node)
        : this.defaultFitnessFunction(node);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  private async selection(): Promise<void> {
    // Elitism: keep top performers
    const eliteCount = Math.floor(this.config.populationSize * 0.1);
    const selectedCount = Math.floor(this.config.populationSize / 2);
    this.population = this.population.slice(0, Math.max(selectedCount, eliteCount));
  }

  private async crossover(): Promise<void> {
    const newPopulation = [...this.population];

    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.selectParent();
      const parent2 = this.selectParent();

      if (Math.random() < this.config.crossoverRate) {
        const child = this.crossoverNodes(parent1, parent2);
        newPopulation.push(child);
      } else {
        newPopulation.push(this.createRandomNode([parent1.id, parent2.id]));
      }
    }

    this.population = newPopulation;
  }

  private selectParent(): GhostNode {
    // Tournament selection
    const tournamentSize = 3;
    const tournament: GhostNode[] = [];
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[idx]);
    }
    return tournament.reduce((best, node) =>
      node.fitness > best.fitness ? node : best
    );
  }

  private crossoverNodes(parent1: GhostNode, parent2: GhostNode): GhostNode {
    return {
      id: `ghost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      genotype: {
        structure: Math.random() > 0.5 ? parent1.genotype.structure : parent2.genotype.structure,
        parameters: Math.random() > 0.5 ? parent1.genotype.parameters : parent2.genotype.parameters,
        encoding: '', // Will be regenerated
      },
      fitness: 0,
      generation: this.generation + 1,
      parentIds: [parent1.id, parent2.id],
      createdAt: Date.now(),
    };
  }

  private async mutation(): Promise<void> {
    for (const node of this.population) {
      if (Math.random() < this.config.mutationRate) {
        node.genotype = this.mutateGenotype(node.genotype);
      }
    }
  }

  private mutateGenotype(genotype: Genotype): Genotype {
    return {
      structure: { ...genotype.structure },
      parameters: {
        ...genotype.parameters,
        learningRate: Math.max(0.01, Math.min(1, genotype.parameters.learningRate * (1 + (Math.random() - 0.5) * 0.2))),
        threshold: Math.max(0.1, Math.min(1, genotype.parameters.threshold * (1 + (Math.random() - 0.5) * 0.1))),
      },
      encoding: btoa(JSON.stringify({ timestamp: Date.now() })),
    };
  }

  private calculateDiversity(): number {
    if (this.population.length < 2) return 0;
    const fitnessValues = this.population.map((n) => n.fitness);
    const avg = fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length;
    const variance = fitnessValues.reduce((sum, f) => sum + Math.pow(f - avg, 2), 0) / fitnessValues.length;
    return Math.sqrt(variance);
  }

  stop(): void {
    this.running = false;
  }

  getPopulation(): GhostNode[] {
    return [...this.population];
  }

  getGeneration(): number {
    return this.generation;
  }

  getBestNode(): GhostNode | undefined {
    return this.population[0];
  }

  getHistory(): EvolutionHistoryEntry[] {
    return [...this.history];
  }

  getConfig(): EvolutionConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.running;
  }

  addToPopulation(node: GhostNode): void {
    this.population.push(node);
  }

  removeFromPopulation(nodeId: string): void {
    this.population = this.population.filter((n) => n.id !== nodeId);
  }

  onUpdate(callback: (event: any) => void): () => void {
    this.updateListeners.push(callback);
    return () => {
      this.updateListeners = this.updateListeners.filter((cb) => cb !== callback);
    };
  }

  private emitUpdate(event: any): void {
    for (const listener of this.updateListeners) {
      listener(event);
    }
  }
}

// Singleton
let evolution: EvolutionEngine | null = null;

export function getEvolutionEngine(): EvolutionEngine {
  if (!evolution) {
    evolution = new EvolutionEngineImpl();
  }
  return evolution;
}

// React hook for evolution
export function useEvolution() {
  const engine = getEvolutionEngine();

  return {
    population: engine.getPopulation(),
    generation: engine.getGeneration(),
    bestNode: engine.getBestNode(),
    history: engine.getHistory(),
    isRunning: engine.isRunning(),
    evolve: () => engine.evolve(),
    stop: () => engine.stop(),
  };
}