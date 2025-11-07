/**
 * API Test Component
 * Component to test all API endpoints and data transformation
 */

import { useState } from 'react';
import {
  useHealth,
  useTopology,
  useConstraints,
  useOptimization,
  useConnection,
  convertToFlowNodes,
  convertToFlowEdges,
  updateEdgesWithResults,
  updateNodesWithResults,
  calculateStatistics,
} from '../api';
import type { OptimizeRequest } from '../api';

export function ApiTest() {
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  
  // Adjustable parameters
  const [angleBoundDegrees, setAngleBoundDegrees] = useState<number>(30);
  const [loadMultiplier, setLoadMultiplier] = useState<number>(1.0);
  const [generatorCapacityMultiplier, setGeneratorCapacityMultiplier] = useState<number>(1.0);
  const [capacityLimitMultiplier, setCapacityLimitMultiplier] = useState<number>(1.0);

  // Fetch queries
  const { data: connection, isLoading: connectionLoading } = useConnection();
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: topology, isLoading: topologyLoading } = useTopology();
  const { data: constraints, isLoading: constraintsLoading } = useConstraints();
  
  // Optimization mutation
  const optimization = useOptimization();

  // Handle optimization
  const runOptimization = () => {
    const request: OptimizeRequest = {
      constraints: selectedConstraints as any,
      verbose: false,
      // Always send parameters so backend can see changes
      angle_bound_degrees: selectedConstraints.includes('angle_bound') ? angleBoundDegrees : undefined,
      load_multiplier: loadMultiplier,
      generator_capacity_multiplier: generatorCapacityMultiplier,
      capacity_limit_multiplier: selectedConstraints.includes('capacity') ? capacityLimitMultiplier : undefined,
    };
    console.log('🚀 Running optimization with request:', request);
    optimization.mutate(request);
  };

  // Toggle constraint selection
  const toggleConstraint = (constraintId: string) => {
    setSelectedConstraints((prev) =>
      prev.includes(constraintId)
        ? prev.filter((c) => c !== constraintId)
        : [...prev, constraintId]
    );
  };

  // Convert topology to React Flow format
  const flowNodes = topology ? convertToFlowNodes(topology) : [];
  const flowEdges = topology ? convertToFlowEdges(topology) : [];

  // Update with optimization results
  const updatedEdges =
    optimization.data && topology
      ? updateEdgesWithResults(flowEdges, optimization.data)
      : flowEdges;
  const updatedNodes =
    optimization.data && topology
      ? updateNodesWithResults(flowNodes, optimization.data)
      : flowNodes;

  // Calculate statistics
  const stats = optimization.data
    ? calculateStatistics(optimization.data)
    : null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">API Test Dashboard</h1>
        <p className="text-gray-600">Test and inspect all API endpoints and data</p>
      </div>

      {/* Connection Status */}
      <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Connection Status</h2>
        {connectionLoading ? (
          <p className="text-gray-500">Testing connection...</p>
        ) : (
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md ${
            connection ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-700'
          }`}>
            {connection ? (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Backend connected</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>Backend not connected. Is the server running?</span>
              </>
            )}
          </div>
        )}
      </section>

      {/* Health Check */}
      <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Health Check</h2>
        {healthLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : health ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-base font-medium text-gray-900">{health.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Buses</p>
              <p className="text-base font-medium text-gray-900">{health.num_buses}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Branches</p>
              <p className="text-base font-medium text-gray-900">{health.num_branches}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Generators</p>
              <p className="text-base font-medium text-gray-900">{health.num_generators}</p>
            </div>
          </div>
        ) : (
          <p className="text-red-600">Failed to fetch health data</p>
        )}
      </section>

      {/* Topology */}
      <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Network Topology</h2>
        {topologyLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : topology ? (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-600">Total Nodes</p>
                <p className="text-xl font-semibold text-gray-900">{topology.nodes.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Edges</p>
                <p className="text-xl font-semibold text-gray-900">{topology.edges.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Load</p>
                <p className="text-xl font-semibold text-gray-900">{topology.total_load.toFixed(2)} MW</p>
              </div>
            </div>
            
            {/* Node Details */}
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-gray-900 mb-3 hover:text-gray-700">
                View All {topology.nodes.length} Nodes
              </summary>
              <div className="bg-gray-50 p-4 rounded-lg mt-3 max-h-96 overflow-auto border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topology.nodes.map((node) => (
                    <div key={node.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                      <p className="font-medium text-gray-900">Bus {node.id} ({node.type})</p>
                      <p className="text-xs text-gray-600 mt-1">Load: {node.load.toFixed(2)} MW</p>
                      <p className="text-xs text-gray-600">Voltage: {node.voltage.toFixed(3)} p.u.</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            {/* Edge Connections */}
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-gray-900 mb-3 hover:text-gray-700">
                View All {topology.edges.length} Connections
              </summary>
              <div className="bg-gray-50 p-4 rounded-lg mt-3 max-h-96 overflow-auto border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {topology.edges.map((edge) => (
                    <div key={edge.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                      <p className="font-medium text-gray-900">Line {edge.id}: Bus {edge.source} ↔ Bus {edge.target}</p>
                      <p className="text-xs text-gray-600 mt-1">Capacity: {edge.capacity.toFixed(0)} MVA</p>
                      <p className="text-xs text-gray-600">Reactance: {edge.reactance.toFixed(4)} p.u.</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>
        ) : (
          <p className="text-red-600">Failed to fetch topology</p>
        )}
      </section>

      {/* Constraints */}
      <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Available Constraints</h2>
        {constraintsLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : constraints ? (
          <div className="space-y-3">
            {constraints.constraints.map((constraint) => (
              <label key={constraint.id} className="flex items-start p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedConstraints.includes(constraint.id)}
                  onChange={() => toggleConstraint(constraint.id)}
                  className="mt-1 mr-3 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{constraint.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{constraint.description}</p>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-red-600">Failed to fetch constraints</p>
        )}
      </section>

      {/* Adjustable Parameters */}
      <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Adjustable Parameters</h2>
        
        {/* Angle Bound */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Angle Bound: ±{angleBoundDegrees.toFixed(1)}° per line
            {!selectedConstraints.includes('angle_bound') && (
              <span className="text-sm text-gray-500 ml-2">(Enable "Angle Bounds" constraint to use)</span>
            )}
          </label>
          <input
            type="range"
            min="5"
            max="90"
            step="1"
            value={angleBoundDegrees}
            onChange={(e) => setAngleBoundDegrees(parseFloat(e.target.value))}
            disabled={!selectedConstraints.includes('angle_bound')}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5°</span>
            <span>90°</span>
          </div>
        </div>

        {/* Load Multiplier */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Load Multiplier: {loadMultiplier.toFixed(2)}x
          </label>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.01"
            value={loadMultiplier}
            onChange={(e) => setLoadMultiplier(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1x</span>
            <span>1.0x</span>
            <span>2.0x</span>
          </div>
          {topology && (
            <p className="text-sm text-gray-600 mt-1">
              Total Load: {(topology.total_load * loadMultiplier).toFixed(2)} MW
            </p>
          )}
        </div>

        {/* Generator Capacity Multiplier */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Generator Capacity Multiplier: {generatorCapacityMultiplier.toFixed(2)}x
          </label>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={generatorCapacityMultiplier}
            onChange={(e) => setGeneratorCapacityMultiplier(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1x</span>
            <span>1.0x</span>
            <span>2.0x</span>
          </div>
        </div>

        {/* Capacity Limit Multiplier */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Branch Capacity Limit: {(capacityLimitMultiplier * 100).toFixed(0)}% of rated capacity
            {!selectedConstraints.includes('capacity') && (
              <span className="text-sm text-gray-500 ml-2">(Enable "Capacity Constraints" to use)</span>
            )}
          </label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={capacityLimitMultiplier}
            onChange={(e) => setCapacityLimitMultiplier(parseFloat(e.target.value))}
            disabled={!selectedConstraints.includes('capacity')}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Controls how much power each line can carry (e.g., 80% = conservative, 120% = relaxed)
          </p>
        </div>
      </section>

      {/* Optimization */}
      <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Run Optimization</h2>
        <button
          onClick={runOptimization}
          disabled={optimization.isPending}
          className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {optimization.isPending ? 'Running...' : 'Run Optimization'}
        </button>

        {optimization.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{optimization.error.message}</p>
          </div>
        )}

        {optimization.data && (
          <div className="mt-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Results</h3>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-base font-semibold text-gray-900">{stats.status}</p>
                </div>
                {stats.totalCost && (
                  <div>
                    <p className="text-sm text-gray-600">Total Cost</p>
                    <p className="text-base font-semibold text-gray-900">${stats.totalCost.toFixed(2)}</p>
                  </div>
                )}
                {stats.totalGeneration && (
                  <div>
                    <p className="text-sm text-gray-600">Generation</p>
                    <p className="text-base font-semibold text-gray-900">{stats.totalGeneration.toFixed(2)} MW</p>
                  </div>
                )}
                {stats.totalLoad && (
                  <div>
                    <p className="text-sm text-gray-600">Load</p>
                    <p className="text-base font-semibold text-gray-900">{stats.totalLoad.toFixed(2)} MW</p>
                  </div>
                )}
                {stats.linesOn !== undefined && (
                  <div>
                    <p className="text-sm text-gray-600">Lines ON</p>
                    <p className="text-base font-semibold text-gray-900">{stats.linesOn}</p>
                  </div>
                )}
                {stats.linesOff !== undefined && (
                  <div>
                    <p className="text-sm text-gray-600">Lines OFF</p>
                    <p className="text-base font-semibold text-gray-900">{stats.linesOff}</p>
                  </div>
                )}
              </div>
            )}

            {/* Generator Outputs */}
            {optimization.data.generators && (
              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-gray-900 mb-3 hover:text-gray-700">
                  Generator Outputs ({Object.keys(optimization.data.generators).length})
                </summary>
                <div className="bg-gray-50 p-4 rounded-lg mt-3 max-h-96 overflow-auto border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(optimization.data.generators).map(([id, gen]) => (
                      <div key={id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                        <p className="font-medium text-gray-900">Generator {id} @ Bus {gen.bus}</p>
                        <p className="text-xs text-gray-600 mt-1">Output: {gen.Pg.toFixed(2)} MW</p>
                        <p className="text-xs text-gray-600">Capacity: {gen.Pmin.toFixed(2)} - {gen.Pmax.toFixed(2)} MW</p>
                        <p className="text-xs text-gray-600">
                          Utilization: {((gen.Pg / gen.Pmax) * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Branch Flows */}
            {optimization.data.branches && (
              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-gray-900 mb-3 hover:text-gray-700">
                  Branch Flows ({Object.keys(optimization.data.branches).length})
                </summary>
                <div className="bg-gray-50 p-4 rounded-lg mt-3 max-h-96 overflow-auto border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(optimization.data.branches).map(([id, branch]) => (
                      <div 
                        key={id} 
                        className={`p-3 rounded border text-sm ${
                          branch.status < 0.5 
                            ? 'bg-gray-100 border-gray-300' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <p className="font-medium text-gray-900">
                          Line {id}: Bus {branch.fbus} → Bus {branch.tbus}
                          {branch.status < 0.5 && <span className="ml-2 text-xs text-gray-500">(OFF)</span>}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Flow: {branch.flow.toFixed(2)} MW (Capacity: {branch.capacity.toFixed(0)} MVA)
                        </p>
                        <p className="text-xs text-gray-600">
                          Utilization: {branch.utilization.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Bus Angles */}
            {optimization.data.bus_angles && (
              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-gray-900 mb-3 hover:text-gray-700">
                  Bus Voltage Angles ({Object.keys(optimization.data.bus_angles).length})
                </summary>
                <div className="bg-gray-50 p-4 rounded-lg mt-3 max-h-96 overflow-auto border border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(optimization.data.bus_angles).map(([busId, angle]) => (
                      <div key={busId} className="bg-white p-3 rounded border border-gray-200 text-sm text-center">
                        <p className="font-medium text-gray-900">Bus {busId}</p>
                        <p className="text-xs text-gray-600 mt-1">{(angle as number).toFixed(2)}°</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

