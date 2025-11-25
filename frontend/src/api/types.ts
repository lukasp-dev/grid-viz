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
  cost?: number; // Marginal cost ($/MW)
}

export interface BranchFlow {
  fbus: number;
  tbus: number;
  flow: number;
  capacity: number;
  utilization: number;
  status: number; // 1 = on, 0 = off
}

export interface SlackValues {
  angle: Record<string, { positive: number; negative: number }>;
  flow: Record<string, { positive: number; negative: number }>;
}

export interface ConstraintDuals {
  angle: Record<string, { min: number | null; max: number | null }>;
  flow: Record<string, { min: number | null; max: number | null }>;
}

export interface OptimizationResult {
  status: 'optimal' | 'infeasible' | 'error';
  objective?: number;
  total_generation?: number;
  total_load?: number;
  total_shunt?: number;
  total_consumption?: number;
  power_balance_error?: number;
  generators?: Record<string, GeneratorOutput>;
  branches?: Record<string, BranchFlow>;
  bus_angles?: Record<string, number>;
  bus_loads?: Record<string, number>;
  slack_values?: SlackValues;
  constraint_duals?: ConstraintDuals;
  forced_generator?: number;
  disabled_lines?: number[];
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
  use_slack?: boolean;
  slack_penalty_angle?: number;
  slack_penalty_flow?: number;
  slack_angle_fraction?: number;
  slack_flow_fraction?: number;
  force_second_cheapest?: boolean;
  switch_off_lines?: number[];
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

