import { useState, useCallback, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider } from 'reactflow'
import {
  useTopology,
  useOptimization,
  convertToFlowNodes,
  convertToFlowEdges,
  updateNodesWithResults,
  updateEdgesWithResults,
} from '../api'
import type { OptimizeRequest } from '../api'

// Define outside component to avoid re-creating on each render
const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false,
}

// Define empty node/edge types to prevent React Flow warning
const nodeTypes = {}
const edgeTypes = {}


// Tooltip Content Component
function TooltipContent({ node, edges, optimization }: any) {
  // Extract node ID as string first to avoid type issues
  const nodeId: string = String(node?.id || '')
  
  const getNodeConnections = (nodeId: string, edges: any[]) => {
    // Filter only ON edges (status >= 0.5 means ON)
    const incoming = edges.filter((e) => 
      e.target === nodeId && (e.data?.status === undefined || e.data.status >= 0.5)
    )
    const outgoing = edges.filter((e) => 
      e.source === nodeId && (e.data?.status === undefined || e.data.status >= 0.5)
    )
    return { incoming, outgoing }
  }

  const getGeneratorInfo = (nodeId: string) => {
    if (!optimization?.generators) return null
    return Object.values(optimization.generators).find((gen: any) => gen.bus === Number(nodeId))
  }

  const { incoming, outgoing } = getNodeConnections(nodeId, edges)
  const genInfo: any = getGeneratorInfo(nodeId)
  
  // Type-safe data extraction
  const nodeData: any = node.data || {}
  const voltage: number | null = typeof nodeData.voltage === 'number' ? nodeData.voltage : null
  const load: number | null = typeof nodeData.load === 'number' ? nodeData.load : null
  const angle: number | null = typeof nodeData.angle === 'number' ? nodeData.angle : null
  const busType: string = typeof nodeData.busType === 'string' ? nodeData.busType : 'unknown'
  
  console.log('🔍 TooltipContent', {
    nodeId: nodeId,
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    allEdgesCount: edges.length,
    incoming: incoming.map((e: any) => ({
      id: e.id,
      source: e.source,
      status: e.data?.status,
      flow: e.data?.flow
    }))
  })
  
  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs w-80 max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="mb-3 pb-3 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">
          Bus {nodeId}
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({busType})
          </span>
        </h3>
      </div>

      {/* Basic Info */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Voltage:</span>
          <span className="font-bold">
            {voltage !== null ? (voltage.toFixed(3) + ' p.u.') : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Load (Pd):</span>
          <span className="font-bold">
            {load !== null ? (load.toFixed(2) + ' MW') : 'N/A'}
          </span>
        </div>
        {angle !== null ? (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Angle (θ):</span>
            <span className="font-bold">{angle.toFixed(2) + '°'}</span>
          </div>
        ) : null}
      </div>

      {/* Generator Info */}
      {genInfo && (
        <div className="mb-3 pt-2 border-t">
          <p className="text-xs font-semibold mb-2 text-green-700">🔋 Generator</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Pg:</span>
              {/* cspell:disable-next-line */}
              <span className="font-bold text-green-700">{genInfo.Pg?.toFixed(2)} MW</span>
            </div>
            <div className="flex justify-between">
              <span>Pmax:</span>
              {/* cspell:disable-next-line */}
              <span className="font-bold">{genInfo.Pmax?.toFixed(2)} MW</span>
            </div>
            <div className="flex justify-between">
              <span>Pmin:</span>
              {/* cspell:disable-next-line */}
              <span className="font-bold">{genInfo.Pmin?.toFixed(2)} MW</span>
            </div>
            <div className="flex justify-between">
              <span>Util:</span>
              {/* cspell:disable-next-line */}
              <span className="font-bold">{((genInfo.Pg / genInfo.Pmax) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Connections */}
      <div className="mb-2 pt-2 border-t">
        <div className="space-y-2">
          {/* Incoming */}
          <div>
            <p className="text-xs font-semibold mb-1 text-green-700">
              ⬇️ In: {incoming.length}
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {incoming.slice(0, 5).map((edge: any) => (
                <div key={edge.id} className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium">Bus {edge.source}</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      edge.data?.status === undefined || edge.data.status >= 0.5
                        ? 'bg-green-200 text-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {edge.data?.status === undefined || edge.data.status >= 0.5 ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  {edge.data?.flow !== undefined && (
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Flow:</span>
                        <span className="font-semibold">{edge.data.flow.toFixed(2)} MW</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Capacity:</span>
                        <span>{edge.data.capacity?.toFixed(0) || 'N/A'} MVA</span>
                      </div>
                      {edge.data.utilization !== undefined && (
                        <div className="flex justify-between">
                          <span>Util:</span>
                          <span className={edge.data.utilization > 90 ? 'text-red-600 font-semibold' : ''}>
                            {edge.data.utilization.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {incoming.length > 5 && (
                <p className="text-gray-400 text-center">+{incoming.length - 5} more</p>
              )}
            </div>
          </div>

          {/* Outgoing */}
          <div>
            <p className="text-xs font-semibold mb-1 text-blue-700">
              ⬆️ Out: {outgoing.length}
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {outgoing.slice(0, 5).map((edge: any) => (
                <div key={edge.id} className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium">Bus {edge.target}</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      edge.data?.status === undefined || edge.data.status >= 0.5
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {edge.data?.status === undefined || edge.data.status >= 0.5 ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  {edge.data?.flow !== undefined && (
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Flow:</span>
                        <span className="font-semibold">{edge.data.flow.toFixed(2)} MW</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Capacity:</span>
                        <span>{edge.data.capacity?.toFixed(0) || 'N/A'} MVA</span>
                      </div>
                      {edge.data.utilization !== undefined && (
                        <div className="flex justify-between">
                          <span>Util:</span>
                          <span className={edge.data.utilization > 90 ? 'text-red-600 font-semibold' : ''}>
                            {edge.data.utilization.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {outgoing.length > 5 && (
                <p className="text-gray-400 text-center">+{outgoing.length - 5} more</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComparisonView() {
  // Left side parameters
  const [leftConstraints, setLeftConstraints] = useState<string[]>([])
  const [leftAngleBound, setLeftAngleBound] = useState(30)
  const [leftLoadMultiplier, setLeftLoadMultiplier] = useState(1.0)
  const [leftGenCapacity, setLeftGenCapacity] = useState(1.0)
  const [leftCapacityLimit, setLeftCapacityLimit] = useState(1.0)
  
  // Right side parameters
  const [rightConstraints, setRightConstraints] = useState<string[]>(['line_switching'])
  const [rightAngleBound, setRightAngleBound] = useState(30)
  const [rightLoadMultiplier, setRightLoadMultiplier] = useState(1.0)
  const [rightGenCapacity, setRightGenCapacity] = useState(1.0)
  const [rightCapacityLimit, setRightCapacityLimit] = useState(1.0)

  // Tooltip state (click-based)
  const [clickedNode, setClickedNode] = useState<any>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [tooltipSide, setTooltipSide] = useState<'left' | 'right' | null>(null)

  // Fetch topology (shared base structure)
  const { data: topology, isLoading: topologyLoading } = useTopology()

  // Left side optimization (default/baseline)
  const leftOptimization = useOptimization()

  // Right side optimization (with adjustments)
  const rightOptimization = useOptimization()

  // Convert topology to flow format (memoized)
  const baseNodes = useMemo(
    () => (topology ? convertToFlowNodes(topology) : []),
    [topology]
  )
  const baseEdges = useMemo(
    () => (topology ? convertToFlowEdges(topology) : []),
    [topology]
  )

  // Left side nodes/edges (baseline) - memoized
  const leftNodes = useMemo(
    () =>
      leftOptimization.data
        ? updateNodesWithResults(baseNodes, leftOptimization.data)
        : baseNodes,
    [baseNodes, leftOptimization.data]
  )

  const leftEdges = useMemo(
    () =>
      leftOptimization.data
        ? updateEdgesWithResults(baseEdges, leftOptimization.data)
        : baseEdges,
    [baseEdges, leftOptimization.data]
  )

  // Right side nodes/edges (with parameters) - memoized
  const rightNodes = useMemo(
    () =>
      rightOptimization.data
        ? updateNodesWithResults(baseNodes, rightOptimization.data)
        : baseNodes,
    [baseNodes, rightOptimization.data]
  )

  const rightEdges = useMemo(
    () =>
      rightOptimization.data
        ? updateEdgesWithResults(baseEdges, rightOptimization.data)
        : baseEdges,
    [baseEdges, rightOptimization.data]
  )

  // Run optimizations
  const runLeftOptimization = () => {
    const request: OptimizeRequest = {
      constraints: leftConstraints as any,
      verbose: false,
      angle_bound_degrees: leftConstraints.includes('angle_bound') ? leftAngleBound : undefined,
      load_multiplier: leftLoadMultiplier,
      generator_capacity_multiplier: leftGenCapacity,
      capacity_limit_multiplier: leftConstraints.includes('capacity')
        ? leftCapacityLimit
        : undefined,
    }
    leftOptimization.mutate(request)
  }

  const runRightOptimization = () => {
    const request: OptimizeRequest = {
      constraints: rightConstraints as any,
      verbose: false,
      angle_bound_degrees: rightConstraints.includes('angle_bound') ? rightAngleBound : undefined,
      load_multiplier: rightLoadMultiplier,
      generator_capacity_multiplier: rightGenCapacity,
      capacity_limit_multiplier: rightConstraints.includes('capacity')
        ? rightCapacityLimit
        : undefined,
    }
    rightOptimization.mutate(request)
  }

  const toggleLeftConstraint = useCallback((constraint: string) => {
    console.log('🟢 toggleLeftConstraint called', constraint)
    setLeftConstraints((prev) => {
      const newConstraints = prev.includes(constraint)
        ? prev.filter((c) => c !== constraint)
        : [...prev, constraint]
      console.log('🟢 New left constraints:', newConstraints)
      return newConstraints
    })
  }, [])

  const toggleRightConstraint = useCallback((constraint: string) => {
    setRightConstraints((prev) =>
      prev.includes(constraint) ? prev.filter((c) => c !== constraint) : [...prev, constraint]
    )
  }, [])


  // Node click handlers
  const onLeftNodeClick = (event: any, node: any) => {
    console.log('🔵 onLeftNodeClick called', { nodeId: node.id, currentClicked: clickedNode?.id, tooltipSide })
    // Stop event propagation to prevent pane click
    if (event && event.stopPropagation) {
      event.stopPropagation()
    }
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    
    // Toggle: if same node clicked, close tooltip; otherwise show new node
    setClickedNode((currentNode: any) => {
      if (currentNode?.id === node.id && tooltipSide === 'left') {
        console.log('🔵 Closing tooltip (same node clicked)')
        setTooltipPosition(null)
        setTooltipSide(null)
        return null
      }

      console.log('🔵 Opening tooltip for node', node.id)
      setTooltipSide('left')

      // Calculate position immediately
      requestAnimationFrame(() => {
        const nodeElement = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement
        const panel = document.querySelector('.flex-1.flex.flex-col.border-r-2 .flex-1.relative') as HTMLElement
        console.log('🔵 Position calculation', { nodeElement: !!nodeElement, panel: !!panel })
        if (nodeElement && panel) {
          const rect = nodeElement.getBoundingClientRect()
          const panelRect = panel.getBoundingClientRect()
          const position = {
            x: rect.left - panelRect.left + rect.width / 2,
            y: rect.top - panelRect.top - 150,
          }
          console.log('🔵 Setting tooltip position', position)
          setTooltipPosition(position)
        }
      })
      
      return node
    })
  }

  const onRightNodeClick = (event: any, node: any) => {
    // Stop event propagation to prevent pane click
    event.stopPropagation()
    
    // Toggle: if same node clicked, close tooltip; otherwise show new node
    if (clickedNode?.id === node.id && tooltipSide === 'right') {
      setClickedNode(null)
      setTooltipPosition(null)
      setTooltipSide(null)
      return
    }

    setClickedNode(node)
    setTooltipSide('right')
    
    // Calculate position
    requestAnimationFrame(() => {
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement
      const panel = document.querySelector('.flex-1.flex.flex-col:not(.border-r-2) .flex-1.relative') as HTMLElement
      if (nodeElement && panel) {
        const rect = nodeElement.getBoundingClientRect()
        const panelRect = panel.getBoundingClientRect()
        setTooltipPosition({
          x: rect.left - panelRect.left + rect.width / 2,
          y: rect.top - panelRect.top - 150,
        })
      }
    })
  }


  const onRightPaneClick = (event: any) => {
    // Only close if clicking directly on pane, not on nodes or edges
    const target = event.target as HTMLElement
    // Don't close if clicking on a node or edge element
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) {
      return
    }
    // Close tooltip when clicking on empty pane
    if (tooltipSide === 'right') {
      setClickedNode(null)
      setTooltipPosition(null)
      setTooltipSide(null)
    }
  }

  // Get connected edges for selected node
  const getNodeConnections = (nodeId: string, edges: any[]) => {
    const incoming = edges.filter((e) => e.target === nodeId)
    const outgoing = edges.filter((e) => e.source === nodeId)
    return { incoming, outgoing }
  }

  // Get generator info for selected node
  const getGeneratorInfo = (nodeId: string, side: 'left' | 'right') => {
    const result = side === 'left' ? leftOptimization.data : rightOptimization.data
    if (!result?.generators) return null
    
    return Object.values(result.generators).find((gen: any) => gen.bus === Number(nodeId))
  }

  if (topologyLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-xl">Loading network topology...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex bg-gray-50">
      {/* Left Side: Panel + Flow */}
      <div className="flex-1 flex flex-col border-r border-gray-200 relative">
        {/* Left Control Panel */}
        <div className="h-64 bg-white border-b border-gray-200 p-5 overflow-y-auto relative z-10">
          <h3 className="text-base font-semibold mb-4 text-gray-900">Left Network</h3>
          
          {/* Constraints */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Constraints</p>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  id="left-line-switching"
                  checked={leftConstraints.includes('line_switching')}
                  onChange={() => {
                    toggleLeftConstraint('line_switching')
                  }}
                  className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
                />
                <label htmlFor="left-line-switching" className="cursor-pointer">
                  Line Switching
                </label>
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  id="left-angle-bound"
                  checked={leftConstraints.includes('angle_bound')}
                  onChange={() => {
                    toggleLeftConstraint('angle_bound')
                  }}
                  className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
                />
                <label htmlFor="left-angle-bound" className="cursor-pointer">
                  Angle Bounds
                </label>
              </div>
              <div className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  id="left-capacity"
                  checked={leftConstraints.includes('capacity')}
                  onChange={() => {
                    toggleLeftConstraint('capacity')
                  }}
                  className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
                />
                <label htmlFor="left-capacity" className="cursor-pointer">
                  Capacity Constraints
                </label>
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-3 mb-4">
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Angle Bound</p>
                <p className="text-xs text-gray-600">±{leftAngleBound}°</p>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={leftAngleBound}
                onChange={(e) => setLeftAngleBound(Number(e.target.value))}
                disabled={!leftConstraints.includes('angle_bound')}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Load Multiplier</p>
                <p className="text-xs text-gray-600">{leftLoadMultiplier.toFixed(1)}x</p>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={leftLoadMultiplier}
                onChange={(e) => setLeftLoadMultiplier(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Gen Capacity</p>
                <p className="text-xs text-gray-600">{leftGenCapacity.toFixed(1)}x</p>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={leftGenCapacity}
                onChange={(e) => setLeftGenCapacity(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Capacity Limit</p>
                <p className="text-xs text-gray-600">{(leftCapacityLimit * 100).toFixed(0)}%</p>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={leftCapacityLimit}
                onChange={(e) => setLeftCapacityLimit(Number(e.target.value))}
                disabled={!leftConstraints.includes('capacity')}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          <button
            onClick={runLeftOptimization}
            disabled={leftOptimization.isPending}
            className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {leftOptimization.isPending ? 'Running...' : 'Run Optimization'}
          </button>

          {leftOptimization.data && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-gray-600">Cost</p>
                  <p className="font-semibold text-gray-900">${leftOptimization.data.objective?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Generation</p>
                  <p className="font-semibold text-gray-900">{leftOptimization.data.total_generation?.toFixed(0)} MW</p>
                </div>
                <div>
                  <p className="text-gray-600">Lines ON</p>
                  <p className="font-semibold text-gray-900">{leftOptimization.data.lines_on} / {leftOptimization.data.lines_on! + leftOptimization.data.lines_off!}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Left Flow */}
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <ReactFlow
              id="left-flow"
              nodes={leftNodes}
              edges={leftEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={(event, node) => {
                console.log('🔵 ReactFlow onNodeClick triggered (left)', node.id)
                onLeftNodeClick(event, node)
              }}
              onPaneClick={(event) => {
                console.log('🔵 ReactFlow onPaneClick triggered (left)')
                // Only close if clicking on empty pane, not immediately
                const target = event.target as HTMLElement
                if (!target.closest('.react-flow__node') && !target.closest('.react-flow__edge')) {
                  setTimeout(() => {
                    setTooltipSide((currentSide) => {
                      if (currentSide === 'left') {
                        console.log('🔵 Closing tooltip (pane clicked)')
                        setClickedNode(null)
                        setTooltipPosition(null)
                        return null
                      }
                      return currentSide
                    })
                  }, 50)
                }
              }}
              fitView
              nodesDraggable={true}
              nodesConnectable={false}
              minZoom={0.1}
              maxZoom={4}
              defaultEdgeOptions={defaultEdgeOptions}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </ReactFlowProvider>
          {/* Left Tooltip */}
          {false && clickedNode && tooltipPosition && tooltipSide === 'left' && (
            <div
              className="absolute z-50"
              style={{
                left: `${tooltipPosition!.x}px`,
                top: `${tooltipPosition!.y}px`,
                transform: 'translateX(-50%)',
              }}
            >
              <TooltipContent node={clickedNode} side={tooltipSide} edges={leftEdges} optimization={leftOptimization.data} />
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Panel + Flow */}
      <div className="flex-1 flex flex-col">
        {/* Right Control Panel */}
        <div className="h-64 bg-white border-b border-gray-200 p-5 overflow-y-auto relative z-10">
          <h3 className="text-base font-semibold mb-4 text-gray-900">Right Network</h3>
          
          {/* Constraints */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Constraints</p>
            <div className="space-y-2">
              <label className="flex items-center text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={rightConstraints.includes('line_switching')}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleRightConstraint('line_switching')
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
                />
                Line Switching
              </label>
              <label className="flex items-center text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={rightConstraints.includes('angle_bound')}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleRightConstraint('angle_bound')
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
                />
                Angle Bounds
              </label>
              <label className="flex items-center text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={rightConstraints.includes('capacity')}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleRightConstraint('capacity')
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
                />
                Capacity Constraints
              </label>
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-3 mb-4">
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Angle Bound</p>
                <p className="text-xs text-gray-600">±{rightAngleBound}°</p>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={rightAngleBound}
                onChange={(e) => setRightAngleBound(Number(e.target.value))}
                disabled={!rightConstraints.includes('angle_bound')}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Load Multiplier</p>
                <p className="text-xs text-gray-600">{rightLoadMultiplier.toFixed(1)}x</p>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rightLoadMultiplier}
                onChange={(e) => setRightLoadMultiplier(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Gen Capacity</p>
                <p className="text-xs text-gray-600">{rightGenCapacity.toFixed(1)}x</p>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rightGenCapacity}
                onChange={(e) => setRightGenCapacity(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Capacity Limit</p>
                <p className="text-xs text-gray-600">{(rightCapacityLimit * 100).toFixed(0)}%</p>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={rightCapacityLimit}
                onChange={(e) => setRightCapacityLimit(Number(e.target.value))}
                disabled={!rightConstraints.includes('capacity')}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          <button
            onClick={runRightOptimization}
            disabled={rightOptimization.isPending}
            className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {rightOptimization.isPending ? 'Running...' : 'Run Optimization'}
          </button>

          {rightOptimization.data && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-gray-600">Cost</p>
                  <p className="font-semibold text-gray-900">${rightOptimization.data.objective?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Generation</p>
                  <p className="font-semibold text-gray-900">{rightOptimization.data.total_generation?.toFixed(0)} MW</p>
                </div>
                <div>
                  <p className="text-gray-600">Lines ON</p>
                  <p className="font-semibold text-gray-900">{rightOptimization.data.lines_on} / {rightOptimization.data.lines_on! + rightOptimization.data.lines_off!}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Flow */}
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <ReactFlow
              id="right-flow"
              nodes={rightNodes}
              edges={rightEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onRightNodeClick}
              onPaneClick={onRightPaneClick}
              fitView
              nodesDraggable={true}
              nodesConnectable={false}
              minZoom={0.1}
              maxZoom={4}
              defaultEdgeOptions={defaultEdgeOptions}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </ReactFlowProvider>
          {/* Right Tooltip */}
          {false && clickedNode && tooltipPosition && tooltipSide === 'right' && (
            <div
              className="absolute z-50"
              style={{
                left: `${tooltipPosition!.x}px`,
                top: `${tooltipPosition!.y}px`,
                transform: 'translateX(-50%)',
              }}
            >
              <TooltipContent node={clickedNode} side={tooltipSide} edges={rightEdges} optimization={rightOptimization.data} />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default ComparisonView

