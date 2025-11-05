import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
  const nodeId: string = String(node?.id || '')

  const getNodeConnections = (nodeId: string, edges: any[]) => {
    const incoming = edges.filter((e) => e.target === nodeId)
    const outgoing = edges.filter((e) => e.source === nodeId)
    return { incoming, outgoing }
  }

  const getGeneratorInfo = (nodeId: string) => {
    if (!optimization?.generators) return null
    return Object.values(optimization.generators).find((gen: any) => gen.bus === Number(nodeId))
  }

  const { incoming, outgoing } = getNodeConnections(nodeId, edges)
  const genInfo: any = getGeneratorInfo(nodeId)

  const nodeData: any = node.data || {}
  const voltage: number | null = typeof nodeData.voltage === 'number' ? nodeData.voltage : null
  const load: number | null = typeof nodeData.load === 'number' ? nodeData.load : null
  const angle: number | null = typeof nodeData.angle === 'number' ? nodeData.angle : null
  const busType: string = typeof nodeData.busType === 'string' ? nodeData.busType : 'unknown'

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs w-80 max-h-96 overflow-y-auto">
      <div className="mb-3 pb-3 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Bus {nodeId}<span className="ml-2 text-xs font-normal text-gray-500">({busType})</span></h3>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Voltage:</span>
          <span className="font-bold">{voltage !== null ? (voltage.toFixed(3) + ' p.u.') : 'N/A'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Load (Pd):</span>
          <span className="font-bold">{load !== null ? (load.toFixed(2) + ' MW') : 'N/A'}</span>
        </div>
        {angle !== null && (
          <div className="flex justify-between text-sm"><span className="text-gray-600">Angle (θ):</span><span className="font-bold">{angle.toFixed(2) + '°'}</span></div>
        )}
      </div>

      {genInfo && (
        <div className="mb-3 pt-2 border-t">
          <p className="text-xs font-semibold mb-2 text-green-700">🔋 Generator</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span>Pg:</span><span className="font-bold text-green-700">{genInfo.Pg?.toFixed(2)} MW</span></div>
            <div className="flex justify-between"><span>Pmax:</span><span className="font-bold">{genInfo.Pmax?.toFixed(2)} MW</span></div>
            <div className="flex justify-between"><span>Pmin:</span><span className="font-bold">{genInfo.Pmin?.toFixed(2)} MW</span></div>
            <div className="flex justify-between"><span>Util:</span><span className="font-bold">{((genInfo.Pg / genInfo.Pmax) * 100).toFixed(1)}%</span></div>
          </div>
        </div>
      )}

      <div className="mb-2 pt-2 border-t">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold mb-1 text-green-700">⬇️ In: {incoming.length}</p>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {incoming.slice(0, 5).map((edge: any) => (
                <div key={edge.id} className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium">Bus {edge.source}</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${edge.data?.status === undefined || edge.data.status >= 0.5 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{edge.data?.status === undefined || edge.data.status >= 0.5 ? 'ON' : 'OFF'}</span>
                  </div>
                  {edge.data?.flow !== undefined && (
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <div className="flex justify-between"><span>Flow:</span><span className="font-semibold">{edge.data.flow.toFixed(2)} MW</span></div>
                      <div className="flex justify-between"><span>Capacity:</span><span>{edge.data.capacity?.toFixed(0) || 'N/A'} MVA</span></div>
                      {edge.data.utilization !== undefined && <div className="flex justify-between"><span>Util:</span><span className={edge.data.utilization > 90 ? 'text-red-600 font-semibold' : ''}>{edge.data.utilization.toFixed(1)}%</span></div>}
                    </div>
                  )}
                </div>
              ))}
              {incoming.length > 5 && <p className="text-gray-400 text-center">+{incoming.length - 5} more</p>}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold mb-1 text-blue-700">⬆️ Out: {outgoing.length}</p>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {outgoing.slice(0, 5).map((edge: any) => (
                <div key={edge.id} className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium">Bus {edge.target}</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${edge.data?.status === undefined || edge.data.status >= 0.5 ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>{edge.data?.status === undefined || edge.data.status >= 0.5 ? 'ON' : 'OFF'}</span>
                  </div>
                  {edge.data?.flow !== undefined && (
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <div className="flex justify-between"><span>Flow:</span><span className="font-semibold">{edge.data.flow.toFixed(2)} MW</span></div>
                      <div className="flex justify-between"><span>Capacity:</span><span>{edge.data.capacity?.toFixed(0) || 'N/A'} MVA</span></div>
                      {edge.data.utilization !== undefined && <div className="flex justify-between"><span>Util:</span><span className={edge.data.utilization > 90 ? 'text-red-600 font-semibold' : ''}>{edge.data.utilization.toFixed(1)}%</span></div>}
                    </div>
                  )}
                </div>
              ))}
              {outgoing.length > 5 && <p className="text-gray-400 text-center">+{outgoing.length - 5} more</p>}
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

  // Tooltip state (click-based) - allow independent left and right persistent overlays
  const [clickedLeftNode, setClickedLeftNode] = useState<any>(null)
  const [clickedLeftTooltipPos, setClickedLeftTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [clickedRightNode, setClickedRightNode] = useState<any>(null)
  const [clickedRightTooltipPos, setClickedRightTooltipPos] = useState<{ x: number; y: number } | null>(null)
  // Hover tooltip state (shows overlay on mouse hover)
  const [hoveredNode, setHoveredNode] = useState<any>(null)
  const [hoverTooltipPos, setHoverTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverTooltipSide, setHoverTooltipSide] = useState<'left' | 'right' | null>(null)

  // Refs and pane rects so we can clamp tooltips inside their pane and avoid crossing into adjacent network
  const leftPaneRef = useRef<HTMLDivElement | null>(null)
  const rightPaneRef = useRef<HTMLDivElement | null>(null)
  const [leftPaneRect, setLeftPaneRect] = useState<DOMRect | null>(null)
  const [rightPaneRect, setRightPaneRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const updateRects = () => {
      if (leftPaneRef.current) setLeftPaneRect(leftPaneRef.current.getBoundingClientRect())
      if (rightPaneRef.current) setRightPaneRect(rightPaneRef.current.getBoundingClientRect())
    }
    updateRects()
    window.addEventListener('resize', updateRects)
    // also update on scroll in case layout shifts
    window.addEventListener('scroll', updateRects, true)
    return () => {
      window.removeEventListener('resize', updateRects)
      window.removeEventListener('scroll', updateRects, true)
    }
  }, [])

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
    console.log('🔵 onLeftNodeClick called', { nodeId: node.id, currentClicked: clickedLeftNode?.id })
    // Stop event propagation to prevent pane click
    if (event && event.stopPropagation) {
      event.stopPropagation()
    }
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    // Toggle: if same node clicked, close tooltip; otherwise show new node
    // Toggle left clicked node
    if (clickedLeftNode?.id === node.id) {
      setClickedLeftNode(null)
      setClickedLeftTooltipPos(null)
      return
    }

    console.log('🔵 Opening left click tooltip for node', node.id)
    setClickedLeftNode(node)
    const mx = (event && event.clientX) || 0
    const my = (event && event.clientY) || 0
    setClickedLeftTooltipPos({ x: mx, y: my })
  }

  const onRightNodeClick = (event: any, node: any) => {
    // Stop event propagation to prevent pane click
    event.stopPropagation()
    // Toggle right clicked node independently
    if (clickedRightNode?.id === node.id) {
      setClickedRightNode(null)
      setClickedRightTooltipPos(null)
      return
    }

    setClickedRightNode(node)
    const mx = (event && event.clientX) || 0
    const my = (event && event.clientY) || 0
    setClickedRightTooltipPos({ x: mx, y: my })
  }


  const onRightPaneClick = (event: any) => {
    // Only close if clicking directly on pane, not on nodes or edges
    const target = event.target as HTMLElement
    // Don't close if clicking on a node or edge element
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) {
      return
    }
    // Close tooltip when clicking on empty pane
    if (clickedRightNode) {
      setClickedRightNode(null)
      setClickedRightTooltipPos(null)
    }
  }

  // (click helpers removed — TooltipContent provides connections/generator info for hover)

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
  <div ref={leftPaneRef} className="flex-1 flex flex-col border-r border-gray-200 relative">
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
              onNodeMouseEnter={(event: any, node: any) => {
                setHoverTooltipSide('left')
                setHoveredNode(node)
                setHoverTooltipPos({ x: event.clientX, y: event.clientY })
              }}
              onNodeMouseMove={(event: any) => {
                // update position while hovering
                setHoverTooltipPos({ x: event.clientX, y: event.clientY })
              }}
              onNodeMouseLeave={() => {
                setHoveredNode(null)
                setHoverTooltipPos(null)
                setHoverTooltipSide(null)
              }}
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
                    if (clickedLeftNode) {
                      console.log('🔵 Closing left tooltip (pane clicked)')
                      setClickedLeftNode(null)
                      setClickedLeftTooltipPos(null)
                    }
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
          {/* Left Hover Tooltip (adaptive placement) */}
          {hoveredNode && hoverTooltipPos && hoverTooltipSide === 'left' && !clickedLeftNode && (() => {
            const offset = 12
            const margin = 8
            const viewportH = (typeof window !== 'undefined') ? window.innerHeight : 800
            const estimatedH = Math.min(Math.floor(viewportH * 0.6), Math.max(160, Math.floor(viewportH * 0.25)))
            const desiredBelowTop = hoverTooltipPos.y + offset
            const wouldOverflowBelow = desiredBelowTop + estimatedH > (viewportH - margin)
            const placeBelow = !wouldOverflowBelow
            const top = placeBelow ? `${desiredBelowTop}px` : `${Math.max(margin, hoverTooltipPos.y - offset - estimatedH)}px`
            // Clamp horizontally so tooltip doesn't overflow the left pane
            const viewportWidth = (typeof window !== 'undefined') ? window.innerWidth : 1024
            const pane = leftPaneRect ?? { left: 8, width: Math.floor(viewportWidth / 2) - 16, right: Math.floor(viewportWidth / 2) - 8 } as any
            const maxTooltipW = Math.min(480, Math.max(240, pane.width - 16))
            const half = maxTooltipW / 2
            let left = hoverTooltipPos.x - half
            const minLeft = pane.left + 8
            const maxLeft = (pane.left + pane.width) - maxTooltipW - 8
            if (left < minLeft) left = minLeft
            if (left > maxLeft) left = maxLeft
            return (
              <div className="fixed z-50 pointer-events-none" style={{ left: `${left}px`, top, maxWidth: `${maxTooltipW}px`, maxHeight: '60vh', overflow: 'auto' }}>
                <TooltipContent node={hoveredNode} edges={leftEdges} optimization={leftOptimization.data} />
              </div>
            )
          })()}
        </div>
      </div>

  {/* Right Side: Panel + Flow */}
  <div ref={rightPaneRef} className="flex-1 flex flex-col">
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
              onNodeMouseEnter={(event: any, node: any) => {
                setHoverTooltipSide('right')
                setHoveredNode(node)
                setHoverTooltipPos({ x: event.clientX, y: event.clientY })
              }}
              onNodeMouseMove={(event: any) => {
                setHoverTooltipPos({ x: event.clientX, y: event.clientY })
              }}
              onNodeMouseLeave={() => {
                setHoveredNode(null)
                setHoverTooltipPos(null)
                setHoverTooltipSide(null)
              }}
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
            {/* Right Hover Tooltip (adaptive placement) */}
            {hoveredNode && hoverTooltipPos && hoverTooltipSide === 'right' && !clickedRightNode && (() => {
              const offset = 12
              const margin = 8
              const viewportH = (typeof window !== 'undefined') ? window.innerHeight : 800
              const estimatedH = Math.min(Math.floor(viewportH * 0.6), Math.max(160, Math.floor(viewportH * 0.25)))
              const desiredBelowTop = hoverTooltipPos.y + offset
              const wouldOverflowBelow = desiredBelowTop + estimatedH > (viewportH - margin)
              const placeBelow = !wouldOverflowBelow
              const top = placeBelow ? `${desiredBelowTop}px` : `${Math.max(margin, hoverTooltipPos.y - offset - estimatedH)}px`
              const viewportWidth = (typeof window !== 'undefined') ? window.innerWidth : 1024
              const pane = rightPaneRect ?? { left: Math.floor(viewportWidth / 2) + 8, width: Math.floor(viewportWidth / 2) - 16, right: viewportWidth - 8 } as any
              const maxTooltipW = Math.min(480, Math.max(240, pane.width - 16))
              const half = maxTooltipW / 2
              let left = hoverTooltipPos.x - half
              const minLeft = pane.left + 8
              const maxLeft = (pane.left + pane.width) - maxTooltipW - 8
              if (left < minLeft) left = minLeft
              if (left > maxLeft) left = maxLeft
              return (
                <div className="fixed z-50 pointer-events-none" style={{ left: `${left}px`, top, maxWidth: `${maxTooltipW}px`, maxHeight: '60vh', overflow: 'auto' }}>
                  <TooltipContent node={hoveredNode} edges={rightEdges} optimization={rightOptimization.data} />
                </div>
              )
            })()}
            
            
        </div>
      </div>

      {/* Global persistent click tooltip (top-level so it's never clipped) */}
      {/* Left persistent tooltip (top-level) */}
      {clickedLeftNode && clickedLeftTooltipPos && (() => {
        const offset = 12
        const margin = 8
        const pos = clickedLeftTooltipPos
        const viewportH = (typeof window !== 'undefined') ? window.innerHeight : 800
        const estimatedH = Math.min(Math.floor(viewportH * 0.8), Math.max(240, Math.floor(viewportH * 0.3)))
        const desiredBelowTop = pos.y + offset
        const wouldOverflowBelow = desiredBelowTop + estimatedH > (viewportH - margin)
        const placeBelow = !wouldOverflowBelow
        const top = placeBelow ? `${desiredBelowTop}px` : `${Math.max(margin, pos.y - offset - estimatedH)}px`
        const viewportWidth = (typeof window !== 'undefined') ? window.innerWidth : 1024
        const pane = leftPaneRect ?? { left: 8, width: Math.floor(viewportWidth / 2) - 16 } as any
        const maxTooltipW = Math.min(640, Math.max(320, pane.width - 16))
        let left = pos.x - maxTooltipW / 2
        const minLeft = pane.left + 8
        const maxLeft = (pane.left + pane.width) - maxTooltipW - 8
        if (left < minLeft) left = minLeft
        if (left > maxLeft) left = maxLeft
        return (
          <div
            className="fixed z-90 pointer-events-auto"
            style={{ left: `${left}px`, top, maxWidth: `${maxTooltipW}px` }}
          >
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-3 max-h-[80vh] overflow-auto relative">
              <button
                onClick={() => { setClickedLeftNode(null); setClickedLeftTooltipPos(null) }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 bg-transparent rounded p-1"
                aria-label="Close"
              >
                ✕
              </button>
              <div className="pointer-events-auto">
                <TooltipContent node={clickedLeftNode} edges={leftEdges} optimization={leftOptimization.data} />
              </div>
            </div>
          </div>
        )
      })()}

      {/* Right persistent tooltip (top-level) */}
      {clickedRightNode && clickedRightTooltipPos && (() => {
        const offset = 12
        const margin = 8
        const pos = clickedRightTooltipPos
        const viewportH = (typeof window !== 'undefined') ? window.innerHeight : 800
        const estimatedH = Math.min(Math.floor(viewportH * 0.8), Math.max(240, Math.floor(viewportH * 0.3)))
        const desiredBelowTop = pos.y + offset
        const wouldOverflowBelow = desiredBelowTop + estimatedH > (viewportH - margin)
        const placeBelow = !wouldOverflowBelow
        const top = placeBelow ? `${desiredBelowTop}px` : `${Math.max(margin, pos.y - offset - estimatedH)}px`
        const viewportWidth = (typeof window !== 'undefined') ? window.innerWidth : 1024
        const pane = rightPaneRect ?? { left: Math.floor(viewportWidth / 2) + 8, width: Math.floor(viewportWidth / 2) - 16 } as any
        const maxTooltipW = Math.min(640, Math.max(320, pane.width - 16))
        let left = pos.x - maxTooltipW / 2
        const minLeft = pane.left + 8
        const maxLeft = (pane.left + pane.width) - maxTooltipW - 8
        if (left < minLeft) left = minLeft
        if (left > maxLeft) left = maxLeft
        return (
          <div
            className="fixed z-90 pointer-events-auto"
            style={{ left: `${left}px`, top, maxWidth: `${maxTooltipW}px` }}
          >
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-3 max-h-[80vh] overflow-auto relative">
              <button
                onClick={() => { setClickedRightNode(null); setClickedRightTooltipPos(null) }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 bg-transparent rounded p-1"
                aria-label="Close"
              >
                ✕
              </button>
              <div className="pointer-events-auto">
                <TooltipContent node={clickedRightNode} edges={rightEdges} optimization={rightOptimization.data} />
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

export default ComparisonView

