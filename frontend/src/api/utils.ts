/**
 * API Utility Functions
 * Functions to transform API data for React Flow
 */

import dagre from 'dagre';
import type {
  NetworkTopology,
  OptimizationResult,
  FlowNode,
  FlowEdge,
} from './types';

/**
 * Convert backend topology to React Flow nodes with automatic layout
 */
export function convertToFlowNodes(topology: NetworkTopology): FlowNode[] {
  // Create dagre graph for automatic layout
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Configure graph layout - IEEE standard style
  dagreGraph.setGraph({
    rankdir: 'TB',  // Top to bottom like standard power diagrams
    align: 'UL',    // Upper left alignment
    nodesep: 120,   // Horizontal spacing
    ranksep: 120,   // Vertical spacing
    marginx: 100,
    marginy: 100,
    ranker: 'network-simplex', // Best for power network topology
    acyclicer: 'greedy',
    edgesep: 20,    // Space between edges
  });

  // Add nodes to dagre with much larger sizes
  topology.nodes.forEach((node) => {
    dagreGraph.setNode(String(node.id), { 
      width: 180,  // Much larger width
      height: 120, // Much taller
    });
  });

  // Add edges to dagre
  topology.edges.forEach((edge) => {
    dagreGraph.setEdge(String(edge.source), String(edge.target));
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Convert to React Flow nodes with calculated positions
  return topology.nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(String(node.id));

    // Create label with type indicator
    const typeSymbol = 
      node.type === 'slack' ? '⚡' : 
      node.type === 'generator' ? '🔋' : 
      '📍';

    return {
      id: String(node.id),
      type: 'default', // Use default type for all nodes to ensure all connections work
      position: {
        x: nodeWithPosition.x - 90, // Center the node (width/2)
        y: nodeWithPosition.y - 60, // Center the node (height/2)
      },
      data: {
        label: `${typeSymbol}\n${node.id}`,
        busType: node.type,
        load: node.load,
        voltage: node.voltage,
      },
      // Add style to differentiate node types by color
      style: {
        background:
          node.type === 'slack'
            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' // Blue gradient
            : node.type === 'generator'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' // Green gradient
              : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', // Gray gradient
        color: 'white',
        border: '4px solid #1e293b',
        borderRadius: '16px',
        padding: '15px',
        fontSize: '32px',    // MUCH larger font for numbers
        fontWeight: '900',   // Extra bold
        width: '180px',
        height: '120px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
        lineHeight: '1.3',
        textAlign: 'center',
      },
    };
  });
}

/**
 * Convert backend topology to React Flow edges
 */
export function convertToFlowEdges(topology: NetworkTopology): FlowEdge[] {
  return topology.edges.map((edge, index) => ({
    id: `edge-${edge.id || index}`, // Use backend edge ID or index for uniqueness
    source: String(edge.source),
    target: String(edge.target),
    type: 'smoothstep', // Smoother, more organized edges
    animated: false,
    markerEnd: {
      type: 'arrowclosed',
      width: 25,
      height: 25,
      color: '#94a3b8',
    },
    style: {
      stroke: '#64748b', // Darker gray for better visibility
      strokeWidth: 5,    // Much thicker lines
    },
    data: {
      capacity: edge.capacity,
      reactance: edge.reactance,
      edgeId: edge.id, // Store original edge ID for matching with optimization results
    },
  }));
}

/**
 * Update flow edges with optimization results
 */
export function updateEdgesWithResults(
  edges: FlowEdge[],
  result: OptimizationResult
): FlowEdge[] {
  if (!result.branches) return edges;

  return edges.map((edge) => {
    // Find matching branch in results using edge ID (handles parallel lines correctly)
    const edgeId = edge.data?.edgeId;
    const branch = edgeId !== undefined 
      ? result.branches![String(edgeId)]
      : Object.values(result.branches!).find(
          (b) =>
            (b.fbus === Number(edge.source) && b.tbus === Number(edge.target)) ||
            (b.fbus === Number(edge.target) && b.tbus === Number(edge.source))
        );

    if (!branch) return edge;

    // Determine edge color and style based on status and utilization
    let strokeColor = '#b1b1b7'; // default gray
    let strokeWidth = 5;
    let strokeDasharray: string | undefined = undefined;
    
    if (branch.status < 0.5) {
      // Line is OFF - use purple/gray dashed line to distinguish from overutilization
      strokeColor = '#9333ea'; // Purple for OFF lines
      strokeWidth = 4;
      strokeDasharray = '12,8'; // Longer dashes for OFF
    } else if (branch.utilization >= 100) {
      // Overutilization - red solid line (≥100%)
      strokeColor = '#ef4444'; // Red for ≥100% utilization
      strokeWidth = 6; // Thicker for warning
    } else if (branch.utilization >= 95) {
      // High utilization - orange (95% to <100%)
      strokeColor = '#f59e0b'; // Orange for 95% to <100%
      strokeWidth = 5;
    } else {
      // Normal utilization (<95%)
      strokeColor = '#10b981'; // Green for normal (<95%)
      strokeWidth = 5;
    }

    return {
      ...edge,
      type: 'smoothstep', // Maintain smooth edges
      animated: branch.status > 0.5 && Math.abs(branch.flow) > 0.1,
      markerEnd: {
        type: 'arrowclosed',
        width: 30,
        height: 30,
        color: strokeColor,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray,
        opacity: branch.status < 0.5 ? 0.7 : 1.0, // Slightly transparent for OFF lines
      },
      data: {
        capacity: edge.data?.capacity || 0,
        reactance: edge.data?.reactance || 0,
        edgeId: edge.data?.edgeId,
        flow: branch.flow,
        utilization: branch.utilization,
        status: branch.status,
      },
    };
  });
}

/**
 * Update flow nodes with optimization results
 */
export function updateNodesWithResults(
  nodes: FlowNode[],
  result: OptimizationResult
): FlowNode[] {
  if (!result.generators && !result.bus_angles && !result.bus_loads) return nodes;

  return nodes.map((node) => {
    const nodeId = Number(node.id);
    
    // Find generator output if this is a generator bus
    const generator = result.generators
      ? Object.values(result.generators).find((g) => g.bus === nodeId)
      : undefined;

    // Get bus angle
    const angle = result.bus_angles ? result.bus_angles[node.id] : undefined;

    // Get bus load (actual load used in optimization, including multiplier)
    const load = result.bus_loads ? result.bus_loads[node.id] : undefined;

    return {
      ...node,
      data: {
        ...node.data,
        generation: generator?.Pg,
        angle: angle,
        load: load !== undefined ? load : node.data.load,  // Update load if available
      },
    };
  });
}

/**
 * Calculate network statistics from optimization results
 */
export function calculateStatistics(result: OptimizationResult) {
  if (result.status !== 'optimal') {
    return {
      status: result.status,
      message: result.message || 'Optimization failed',
    };
  }

  return {
    status: result.status,
    totalCost: result.objective,
    totalGeneration: result.total_generation,
    totalLoad: result.total_load,
    linesOn: result.lines_on,
    linesOff: result.lines_off,
    efficiency:
      result.total_generation && result.total_load
        ? ((result.total_load / result.total_generation) * 100).toFixed(2)
        : 'N/A',
  };
}

