# API Module Documentation

TypeScript API client for the OPF Backend

## Quick Start

```typescript
import { useTopology, useOptimization, convertToFlowNodes, convertToFlowEdges } from './api';

function MyComponent() {
  // Fetch topology
  const { data: topology } = useTopology();
  
  // Run optimization
  const optimization = useOptimization();
  
  // Convert to React Flow format
  const nodes = topology ? convertToFlowNodes(topology) : [];
  const edges = topology ? convertToFlowEdges(topology) : [];
  
  return (
    // Your component JSX
  );
}
```

## Module Structure

```
api/
├── types.ts       # TypeScript type definitions
├── client.ts      # API fetch functions
├── hooks.ts       # React Query hooks
├── utils.ts       # Data transformation utilities
├── index.ts       # Central export point
└── README.md      # This file
```

## Core Types

### Network Topology

```typescript
interface BusNode {
  id: number;
  type: 'slack' | 'generator' | 'load';
  load: number;
  voltage: number;
}

interface BranchEdge {
  id: number;
  source: number;
  target: number;
  reactance: number;
  capacity: number;
}

interface NetworkTopology {
  nodes: BusNode[];
  edges: BranchEdge[];
  num_buses: number;
  num_branches: number;
  num_generators: number;
  total_load: number;
}
```

### Optimization Results

```typescript
interface OptimizationResult {
  status: 'optimal' | 'infeasible' | 'error';
  objective?: number;                           // Total cost ($)
  total_generation?: number;                    // Total generation (MW)
  total_load?: number;                          // Total load (MW)
  generators?: Record<string, GeneratorOutput>; // Generator outputs
  branches?: Record<string, BranchFlow>;        // Branch flows
  bus_angles?: Record<string, number>;          // Bus angles (degrees)
  lines_on?: number;                            // Number of lines ON
  lines_off?: number;                           // Number of lines OFF
}
```

## React Query Hooks

### useTopology()
Fetches network topology data.

```typescript
const { data, isLoading, error } = useTopology();

// data: NetworkTopology | undefined
// - Contains 57 bus nodes
// - Contains 80 branch edges
// - Ready for React Flow conversion
```

### useOptimization()
Runs OPF optimization with selected constraints.

```typescript
const optimization = useOptimization();

// Run optimization
optimization.mutate({
  constraints: ['line_switching', 'angle_bound'],
  verbose: false
});

// Access results
const result = optimization.data;  // OptimizationResult
const isRunning = optimization.isPending;
const error = optimization.error;
```

### useHealth()
Checks backend health status.

```typescript
const { data } = useHealth();

// data.status: 'healthy'
// data.num_buses: 57
// data.num_branches: 80
// data.num_generators: 7
```

### useConstraints()
Gets available constraint options.

```typescript
const { data } = useConstraints();

// Available constraints:
// - 'line_switching': Binary line switching
// - 'angle_bound': ±30° angle limits
// - 'capacity': Branch capacity limits
```

## Utility Functions

### convertToFlowNodes()
Converts backend nodes to React Flow nodes.

```typescript
const flowNodes = convertToFlowNodes(topology);

// Each node has:
// - id: string
// - type: 'input' | 'default' | 'output'
// - position: { x, y }
// - data: { label, busType, load, voltage }
```

### convertToFlowEdges()
Converts backend edges to React Flow edges.

```typescript
const flowEdges = convertToFlowEdges(topology);

// Each edge has:
// - id: string
// - source: string
// - target: string
// - data: { capacity, reactance }
```

### updateEdgesWithResults()
Updates edges with optimization results.

```typescript
const updatedEdges = updateEdgesWithResults(flowEdges, optimizationResult);

// Adds to each edge:
// - flow: number
// - utilization: number
// - status: 1 (ON) or 0 (OFF)
// - style: { stroke, strokeWidth, strokeDasharray }
// - animated: boolean
```

**Edge Colors:**
- 🟢 Green: < 95% utilization
- 🟠 Orange: 95-100% utilization (not including 100%)
- 🔴 Red: >= 100% utilization
- 🟣 Purple: Line is OFF (dashed)

### updateNodesWithResults()
Updates nodes with optimization results.

```typescript
const updatedNodes = updateNodesWithResults(flowNodes, optimizationResult);

// Adds to each node:
// - generation: number (MW) - for generator buses
// - angle: number (degrees) - bus voltage angle
```

### calculateStatistics()
Calculates summary statistics from results.

```typescript
const stats = calculateStatistics(optimizationResult);

// Returns:
// - status: 'optimal' | 'infeasible' | 'error'
// - totalCost: number
// - totalGeneration: number
// - totalLoad: number
// - linesOn: number
// - linesOff: number
// - efficiency: string (percentage)
```

## Example: Complete React Flow Integration

```typescript
import { useState } from 'react';
import ReactFlow from 'reactflow';
import {
  useTopology,
  useOptimization,
  convertToFlowNodes,
  convertToFlowEdges,
  updateEdgesWithResults,
  updateNodesWithResults,
} from './api';

function PowerFlowVisualization() {
  const [constraints, setConstraints] = useState<string[]>([]);
  
  // Fetch topology
  const { data: topology, isLoading } = useTopology();
  
  // Optimization mutation
  const optimization = useOptimization();
  
  // Convert to React Flow format
  const initialNodes = topology ? convertToFlowNodes(topology) : [];
  const initialEdges = topology ? convertToFlowEdges(topology) : [];
  
  // Update with optimization results
  const nodes = optimization.data
    ? updateNodesWithResults(initialNodes, optimization.data)
    : initialNodes;
  
  const edges = optimization.data
    ? updateEdgesWithResults(initialEdges, optimization.data)
    : initialEdges;
  
  // Handle optimization
  const handleOptimize = () => {
    optimization.mutate({ constraints });
  };
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div style={{ height: '100vh' }}>
      <div style={{ padding: '1rem' }}>
        <button onClick={handleOptimize}>
          Run Optimization
        </button>
        
        {optimization.data && (
          <div>
            Cost: ${optimization.data.objective?.toFixed(2)}
            Lines ON: {optimization.data.lines_on}
          </div>
        )}
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      />
    </div>
  );
}
```

## Environment Configuration

Create `.env` file:

```env
# Development
VITE_API_URL=http://localhost:8000

# Production with Ngrok
# VITE_API_URL=https://your-ngrok-url.ngrok.io
```

## API Data Verification

All required data for React Flow visualization is available:

✅ **Network Topology**
- 57 bus nodes with types (slack/generator/load)
- 80 branch edges with capacity and reactance

✅ **Optimization Results**
- Power flows (MW)
- Line switching status (ON/OFF)
- Utilization metrics (%)
- Generation outputs (MW)
- Bus voltage angles (degrees)

✅ **Visualization Features**
- Interactive network graph
- Color-coded nodes by type
- Edge colors by utilization
- Animated flows
- Real-time optimization updates

## Testing

See `components/ApiTest.tsx` for a complete testing dashboard.

Run with: Toggle the "Show API Test" button in the app.

## Author

Jewook Park  
November 2025

