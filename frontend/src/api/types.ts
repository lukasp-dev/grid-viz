/**
 * API Type Definitions
 * Types matching the backend API responses
 */

// Network topology types
export interface BusNode {
  id: number;
  type: 'slack' | 'generator' | 'load';
  load: number;
  voltage: number;
}

export interface BranchEdge {
  id: number;
  source: number;
  target: number;
  reactance: number;
  capacity: number;
}

export interface NetworkTopology {
  nodes: BusNode[];
  edges: BranchEdge[];
  num_buses: number;
  num_branches: number;
  num_generators: number;
  total_load: number;
}

// Optimization types
export interface GeneratorOutput {
  bus: number;
  Pg: number;
  Pmax: number;
  Pmin: number;
}

export interface BranchFlow {
  fbus: number;
  tbus: number;
  flow: number;
  capacity: number;
  utilization: number;
  status: number; // 1 = on, 0 = off
}

export interface OptimizationResult {
  status: 'optimal' | 'infeasible' | 'error';
  objective?: number;
  total_generation?: number;
  total_load?: number;
  generators?: Record<string, GeneratorOutput>;
  branches?: Record<string, BranchFlow>;
  bus_angles?: Record<string, number>;
  lines_on?: number;
  lines_off?: number;
  message?: string;
}

export interface OptimizeRequest {
  constraints: Array<'line_switching' | 'angle_bound' | 'capacity'>;
  verbose?: boolean;
  // Adjustable parameters
  angle_bound_degrees?: number; // Angle bound in degrees (default: 30)
  load_multiplier?: number; // Multiply all loads by this factor (default: 1.0)
  generator_capacity_multiplier?: number; // Multiply generator max capacity (default: 1.0)
  capacity_limit_multiplier?: number; // Multiply branch capacity limits (default: 1.0, e.g., 0.8 = 80% cut)
}

// Constraint info
export interface ConstraintInfo {
  id: string;
  name: string;
  description: string;
}

export interface ConstraintsResponse {
  constraints: ConstraintInfo[];
  note: string;
}

// Health check
export interface HealthResponse {
  status: string;
  data_loaded: boolean;
  num_buses: number;
  num_branches: number;
  num_generators: number;
}

// React Flow types (for conversion)
export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    busType: 'slack' | 'generator' | 'load';
    load: number;
    voltage: number;
    generation?: number;
    angle?: number;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  data?: {
    flow?: number;
    capacity: number;
    utilization?: number;
    status?: number;
    reactance: number;
    edgeId?: number; // Original edge ID from backend for matching with optimization results
  };
}

