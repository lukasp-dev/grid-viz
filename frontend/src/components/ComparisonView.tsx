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

const parseLineList = (value: string) =>
  value
    .split(',')
    .map((line) => parseInt(line.trim(), 10))
    .filter((line) => !Number.isNaN(line))

const formatLineList = (lines: number[]) => (lines.length ? lines.join(', ') : '')


// Edge Tooltip Content Component
function EdgeTooltipContent({ edge, optimization }: any) {
  if (!optimization?.bus_angles) {
    return (
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs w-80">
        <p className="text-sm text-gray-600">No angle data available</p>
      </div>
    )
  }

  const sourceBus = Number(edge.source)
  const targetBus = Number(edge.target)
  const sourceAngle = optimization.bus_angles[edge.source]
  const targetAngle = optimization.bus_angles[edge.target]

  if (sourceAngle === undefined || targetAngle === undefined) {
    return (
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs w-80">
        <p className="text-sm text-gray-600">Angle data not available for this connection</p>
      </div>
    )
  }

  // Calculate angle difference: source - target (not absolute value)
  const angleDiff = sourceAngle - targetAngle

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs w-80">
      <div className="mb-3 pb-3 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Line Connection</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Bus {sourceBus}:</span>
          <span className="font-bold">{sourceAngle.toFixed(2)}°</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Bus {targetBus}:</span>
          <span className="font-bold">{targetAngle.toFixed(2)}°</span>
        </div>
        <div className="pt-2 mt-2 border-t border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700 font-medium">Angle Difference:</span>
            <span className={`font-bold ${angleDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {angleDiff >= 0 ? '+' : ''}{angleDiff.toFixed(2)}°
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Bus {sourceBus} - Bus {targetBus}</p>
        </div>
      </div>
    </div>
  )
}

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
  const [leftUseSlack, setLeftUseSlack] = useState(false)
  const [leftSlackPenaltyAngle, setLeftSlackPenaltyAngle] = useState(10000)
  const [leftSlackPenaltyFlow, setLeftSlackPenaltyFlow] = useState(10000)
  const [leftSlackAngleFraction, setLeftSlackAngleFraction] = useState(0)
  const [leftSlackFlowFraction, setLeftSlackFlowFraction] = useState(0)
  const [leftForceSecondGen, setLeftForceSecondGen] = useState(false)
  const [leftDisabledLines, setLeftDisabledLines] = useState('')
  
  // Right side parameters
  const [rightConstraints, setRightConstraints] = useState<string[]>(['line_switching'])
  const [rightAngleBound, setRightAngleBound] = useState(30)
  const [rightLoadMultiplier, setRightLoadMultiplier] = useState(1.0)
  const [rightGenCapacity, setRightGenCapacity] = useState(1.0)
  const [rightCapacityLimit, setRightCapacityLimit] = useState(1.0)
  const [rightUseSlack, setRightUseSlack] = useState(true)
  const [rightSlackPenaltyAngle, setRightSlackPenaltyAngle] = useState(10000)
  const [rightSlackPenaltyFlow, setRightSlackPenaltyFlow] = useState(10000)
  const [rightSlackAngleFraction, setRightSlackAngleFraction] = useState(0)
  const [rightSlackFlowFraction, setRightSlackFlowFraction] = useState(0)
  const [rightForceSecondGen, setRightForceSecondGen] = useState(false)
  const [rightDisabledLines, setRightDisabledLines] = useState('')

  // Tooltip state (click-based) - allow independent left and right persistent overlays
  const [clickedLeftNode, setClickedLeftNode] = useState<any>(null)
  const [clickedLeftTooltipPos, setClickedLeftTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [clickedRightNode, setClickedRightNode] = useState<any>(null)
  const [clickedRightTooltipPos, setClickedRightTooltipPos] = useState<{ x: number; y: number } | null>(null)
  // Hover tooltip state (shows overlay on mouse hover)
  const [hoveredNode, setHoveredNode] = useState<any>(null)
  const [hoverTooltipPos, setHoverTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverTooltipSide, setHoverTooltipSide] = useState<'left' | 'right' | null>(null)
  // Edge hover tooltip state
  const [hoveredEdge, setHoveredEdge] = useState<any>(null)
  const [hoverEdgeTooltipPos, setHoverEdgeTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverEdgeTooltipSide, setHoverEdgeTooltipSide] = useState<'left' | 'right' | null>(null)
  // Generator comparison display toggle
  const [showGeneratorComparison, setShowGeneratorComparison] = useState(false)

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

  // Ensure constraints are fixed: left always has no line_switching, right always has line_switching
  useEffect(() => {
    if (leftConstraints.includes('line_switching')) {
      setLeftConstraints(prev => prev.filter(c => c !== 'line_switching'))
    }
  }, [leftConstraints])

  useEffect(() => {
    if (!rightConstraints.includes('line_switching')) {
      setRightConstraints(prev => [...prev, 'line_switching'])
    }
  }, [rightConstraints])

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
      use_slack: leftUseSlack,
      slack_penalty_angle: leftUseSlack ? leftSlackPenaltyAngle : undefined,
      slack_penalty_flow: leftUseSlack ? leftSlackPenaltyFlow : undefined,
      slack_angle_fraction: leftUseSlack ? leftSlackAngleFraction : undefined,
      slack_flow_fraction: leftUseSlack ? leftSlackFlowFraction : undefined,
      force_second_cheapest: leftForceSecondGen || undefined,
      switch_off_lines: parseLineList(leftDisabledLines),
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
      use_slack: rightUseSlack,
      slack_penalty_angle: rightUseSlack ? rightSlackPenaltyAngle : undefined,
      slack_penalty_flow: rightUseSlack ? rightSlackPenaltyFlow : undefined,
      slack_angle_fraction: rightUseSlack ? rightSlackAngleFraction : undefined,
      slack_flow_fraction: rightUseSlack ? rightSlackFlowFraction : undefined,
      force_second_cheapest: rightForceSecondGen || undefined,
      switch_off_lines: parseLineList(rightDisabledLines),
    }
    rightOptimization.mutate(request)
  }

  // Run both optimizations simultaneously
  const runBothOptimizations = () => {
    runLeftOptimization()
    runRightOptimization()
  }

  const toggleLeftConstraint = useCallback((constraint: string) => {
    // Prevent toggling line_switching for left side (always disabled)
    if (constraint === 'line_switching') {
      return
    }
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
    // Prevent toggling line_switching for right side (always enabled)
    if (constraint === 'line_switching') {
      return
    }
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

  // Calculate generator comparison between left (disabled) and right (enabled) optimizations
  const generatorComparison = useMemo(() => {
    if (!leftOptimization.data?.generators || !rightOptimization.data?.generators) {
      return null
    }

    const leftGens = leftOptimization.data.generators
    const rightGens = rightOptimization.data.generators

    // Create a map of bus -> generator for easier lookup
    const leftByBus = new Map<number, { id: string; gen: any }>()
    const rightByBus = new Map<number, { id: string; gen: any }>()

    Object.entries(leftGens).forEach(([id, gen]: [string, any]) => {
      leftByBus.set(gen.bus, { id, gen })
    })

    Object.entries(rightGens).forEach(([id, gen]: [string, any]) => {
      rightByBus.set(gen.bus, { id, gen })
    })

    // Compare generators at the same bus
    const comparisons: Array<{
      bus: number
      leftId: string
      rightId: string
      leftPg: number
      rightPg: number
      difference: number
      percentChange: number
    }> = []

    // Find all unique buses
    const allBuses = new Set([...leftByBus.keys(), ...rightByBus.keys()])

    allBuses.forEach((bus) => {
      const left = leftByBus.get(bus)
      const right = rightByBus.get(bus)

      if (left && right) {
        const leftPg = left.gen.Pg || 0
        const rightPg = right.gen.Pg || 0
        const difference = rightPg - leftPg
        const percentChange = leftPg > 0 ? (difference / leftPg) * 100 : (rightPg > 0 ? 100 : 0)

        comparisons.push({
          bus,
          leftId: left.id,
          rightId: right.id,
          leftPg,
          rightPg,
          difference,
          percentChange,
        })
      }
    })

    // Sort by absolute difference (largest changes first)
    comparisons.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))

    return comparisons
  }, [leftOptimization.data, rightOptimization.data])

  // Find cheapest generator(s) from the system (excluding synchronous condensers with Pmax = 0)
  const cheapestGenerators = useMemo(() => {
    if (!leftOptimization.data?.generators) {
      return null
    }

    const generators = leftOptimization.data.generators
    const generatorsWithCost: Array<{ id: string; bus: number; cost: number }> = []

    // Collect all generators with cost data and Pmax > 0 (exclude synchronous condensers)
    Object.entries(generators).forEach(([id, gen]: [string, any]) => {
      // Only include generators that can actually produce real power (Pmax > 0)
      if (gen.cost !== undefined && gen.cost !== null && gen.Pmax > 0) {
        generatorsWithCost.push({
          id,
          bus: gen.bus,
          cost: gen.cost,
        })
      }
    })

    if (generatorsWithCost.length === 0) {
      return null
    }

    // Find minimum cost
    const minCost = Math.min(...generatorsWithCost.map((g) => g.cost))

    // Find all generators with the minimum cost
    const cheapest = generatorsWithCost.filter((g) => g.cost === minCost)

    return {
      cost: minCost,
      generators: cheapest,
    }
  }, [leftOptimization.data])

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
      {/* Common Control Panel (Shared Parameters) */}
      <div className="w-80 bg-white border-r border-gray-200 p-5 overflow-y-auto">
        <h3 className="text-base font-semibold mb-4 text-gray-900">Parameters</h3>
        
        {/* Constraints */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Constraints</p>
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                id="common-angle-bound"
                checked={leftConstraints.includes('angle_bound') && rightConstraints.includes('angle_bound')}
                onChange={() => {
                  const isChecked = leftConstraints.includes('angle_bound')
                  if (isChecked) {
                    toggleLeftConstraint('angle_bound')
                    toggleRightConstraint('angle_bound')
                  } else {
                    toggleLeftConstraint('angle_bound')
                    toggleRightConstraint('angle_bound')
                  }
                }}
                className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
              />
              <label htmlFor="common-angle-bound" className="cursor-pointer">
                Angle Bounds
              </label>
            </div>
            <div className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                id="common-capacity"
                checked={leftConstraints.includes('capacity') && rightConstraints.includes('capacity')}
                onChange={() => {
                  const isChecked = leftConstraints.includes('capacity')
                  if (isChecked) {
                    toggleLeftConstraint('capacity')
                    toggleRightConstraint('capacity')
                  } else {
                    toggleLeftConstraint('capacity')
                    toggleRightConstraint('capacity')
                  }
                }}
                className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 cursor-pointer"
              />
              <label htmlFor="common-capacity" className="cursor-pointer">
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
              max="90"
              value={leftAngleBound}
              onChange={(e) => {
                const value = Number(e.target.value)
                setLeftAngleBound(value)
                setRightAngleBound(value)
              }}
              disabled={!leftConstraints.includes('angle_bound')}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <p className="text-xs font-medium text-gray-700">Load Multiplier</p>
              <p className="text-xs text-gray-600">{leftLoadMultiplier.toFixed(2)}x</p>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.01"
              value={leftLoadMultiplier}
              onChange={(e) => {
                const value = Number(e.target.value)
                setLeftLoadMultiplier(value)
                setRightLoadMultiplier(value)
              }}
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
              onChange={(e) => {
                const value = Number(e.target.value)
                setLeftGenCapacity(value)
                setRightGenCapacity(value)
              }}
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
              onChange={(e) => {
                const value = Number(e.target.value)
                setLeftCapacityLimit(value)
                setRightCapacityLimit(value)
              }}
              disabled={!leftConstraints.includes('capacity')}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>
        </div>

        {/* Run Optimization Button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={runBothOptimizations}
            disabled={leftOptimization.isPending || rightOptimization.isPending}
            className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {leftOptimization.isPending || rightOptimization.isPending
              ? 'Running Optimizations...'
              : 'Run Optimization'}
          </button>
        </div>

        {/* Cheapest Generator Display */}
        {cheapestGenerators && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Cheapest Generator</p>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  ${cheapestGenerators.cost.toFixed(2)}/MW
                </span>
                <span className="text-xs text-gray-600">at</span>
              </div>
              <div className="text-xs text-gray-700">
                {cheapestGenerators.generators.length === 1 ? (
                  <span>Bus {cheapestGenerators.generators[0].bus}</span>
                ) : (
                  <span>
                    Buses: {cheapestGenerators.generators.map((g) => g.bus).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Generator Comparison Toggle */}
        {leftOptimization.data && rightOptimization.data && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 cursor-pointer" htmlFor="gen-comparison-toggle">
                Generator Comparison
              </label>
              <button
                id="gen-comparison-toggle"
                onClick={() => setShowGeneratorComparison(!showGeneratorComparison)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showGeneratorComparison ? 'bg-gray-900' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showGeneratorComparison ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {showGeneratorComparison && generatorComparison && (
              <div className="mt-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                <div className="p-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-700 mb-2 sticky top-0 bg-white pb-2 border-b border-gray-200">
                    <div className="grid grid-cols-5 gap-2">
                      <span>Bus</span>
                      <span className="text-left">Disabled</span>
                      <span className="text-left">Enabled</span>
                      <span className="text-center">Δ</span>
                      <span className="text-center">%</span>
                    </div>
                  </div>
                  {generatorComparison.map((comp) => (
                    <div
                      key={comp.bus}
                      className={`text-xs py-1.5 px-2 rounded border ${
                        comp.difference > 0
                          ? 'bg-green-50 border-green-200'
                          : comp.difference < 0
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="grid grid-cols-5 gap-2 items-center">
                        <span className="font-medium text-gray-900">Bus {comp.bus}</span>
                        <span className="text-gray-700">{comp.leftPg.toFixed(2)} MW</span>
                        <span className="text-gray-700">{comp.rightPg.toFixed(2)} MW</span>
                        <span
                          className={`text-center font-semibold ${
                            comp.difference > 0
                              ? 'text-green-700'
                              : comp.difference < 0
                              ? 'text-red-700'
                              : 'text-gray-600'
                          }`}
                        >
                          {comp.difference > 0 ? '+' : ''}
                          {comp.difference.toFixed(2)} MW
                        </span>
                        <span
                          className={`text-center font-semibold ${
                            comp.percentChange > 0
                              ? 'text-green-700'
                              : comp.percentChange < 0
                              ? 'text-red-700'
                              : 'text-gray-600'
                          }`}
                        >
                          {comp.percentChange > 0 ? '+' : ''}
                          {comp.percentChange.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {generatorComparison.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">No generator data available for comparison</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">Line Status</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center">
              <div className="w-8 h-1 bg-green-500 rounded mr-2"></div>
              <span className="text-gray-700">&lt;95% utilization</span>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-1 bg-orange-500 rounded mr-2"></div>
              <span className="text-gray-700">95% to &lt;100%</span>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-1 bg-red-500 rounded mr-2"></div>
              <span className="text-gray-700">≥100% utilization</span>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-1 mr-2 relative">
                <div className="absolute inset-0 border-t-2 border-purple-500 border-dashed"></div>
              </div>
              <span className="text-gray-700">Line OFF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side: Panel + Flow */}
      <div ref={leftPaneRef} className="flex-1 flex flex-col border-r border-gray-200 relative">
        {/* Left Control Panel */}
        <div className="h-64 bg-white border-b border-gray-200 p-5 overflow-y-auto relative z-10">
          <h3 className="text-base font-semibold mb-4 text-gray-900">Line Switching Disabled</h3>
          
          {/* Line Switching Status (read-only) */}
          <div className="mb-4">
            <div className="flex items-center text-sm text-gray-700">
              <div className="mr-2 w-4 h-4 bg-gray-300 rounded flex items-center justify-center">
                <span className="text-xs text-gray-600">✕</span>
              </div>
              <label className="text-gray-600">
                Line Switching: <span className="font-medium text-gray-900">Disabled</span>
              </label>
            </div>
          </div>

          <div className="space-y-3 text-xs text-gray-700">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                checked={leftUseSlack}
                onChange={(e) => setLeftUseSlack(e.target.checked)}
              />
              <span>Use slack variables (angle & flow)</span>
            </label>
            {leftUseSlack && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Angle Penalty</p>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={leftSlackPenaltyAngle}
                    onChange={(e) => setLeftSlackPenaltyAngle(Number(e.target.value))}
                    className="w-full rounded border-gray-300 focus:ring-gray-900 focus:border-gray-900 text-xs"
                  />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Flow Penalty</p>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={leftSlackPenaltyFlow}
                    onChange={(e) => setLeftSlackPenaltyFlow(Number(e.target.value))}
                    className="w-full rounded border-gray-300 focus:ring-gray-900 focus:border-gray-900 text-xs"
                  />
                </div>
                <div className="col-span-2 text-[11px] text-gray-500">
                  Higher values keep constraints tight (default 10,000). Lower values (~1,000) allow more slack.
                </div>
                <div className="col-span-2 grid grid-cols-1 gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Max Angle Slack (% limit): {(leftSlackAngleFraction * 100).toFixed(3)}%
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={0.001}
                      step={0.0001}
                      value={leftSlackAngleFraction}
                      onChange={(e) => setLeftSlackAngleFraction(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>0%</span>
                      <span>0.05%</span>
                      <span>0.10%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Max Flow Slack (% limit): {(leftSlackFlowFraction * 100).toFixed(3)}%
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={0.001}
                      step={0.0001}
                      value={leftSlackFlowFraction}
                      onChange={(e) => setLeftSlackFlowFraction(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>0%</span>
                      <span>0.05%</span>
                      <span>0.10%</span>
                    </div>
                  </div>
                </div>
              </div>

            )}
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                checked={leftForceSecondGen}
                onChange={(e) => setLeftForceSecondGen(e.target.checked)}
              />
              <span>Force 2nd-cheapest generator to max</span>
            </label>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Switch Off Lines</p>
              <textarea
                rows={2}
                value={leftDisabledLines}
                onChange={(e) => setLeftDisabledLines(e.target.value)}
                placeholder="e.g., 10, 58, 79"
                className="w-full rounded border-gray-300 focus:ring-gray-900 focus:border-gray-900 text-xs"
              />
            </div>
          </div>

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
              onEdgeMouseEnter={(event: any, edge: any) => {
                // Only show tooltip for enabled lines (status >= 0.5)
                if (edge.data?.status !== undefined && edge.data.status >= 0.5) {
                  setHoverEdgeTooltipSide('left')
                  setHoveredEdge(edge)
                  setHoverEdgeTooltipPos({ x: event.clientX, y: event.clientY })
                }
              }}
              onEdgeMouseMove={(event: any) => {
                if (hoveredEdge) {
                  setHoverEdgeTooltipPos({ x: event.clientX, y: event.clientY })
                }
              }}
              onEdgeMouseLeave={() => {
                setHoveredEdge(null)
                setHoverEdgeTooltipPos(null)
                setHoverEdgeTooltipSide(null)
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
          {/* Left Edge Hover Tooltip */}
          {hoveredEdge && hoverEdgeTooltipPos && hoverEdgeTooltipSide === 'left' && (() => {
            const offset = 12
            const margin = 8
            const viewportH = (typeof window !== 'undefined') ? window.innerHeight : 800
            const estimatedH = 200
            const desiredBelowTop = hoverEdgeTooltipPos.y + offset
            const wouldOverflowBelow = desiredBelowTop + estimatedH > (viewportH - margin)
            const placeBelow = !wouldOverflowBelow
            const top = placeBelow ? `${desiredBelowTop}px` : `${Math.max(margin, hoverEdgeTooltipPos.y - offset - estimatedH)}px`
            const viewportWidth = (typeof window !== 'undefined') ? window.innerWidth : 1024
            const pane = leftPaneRect ?? { left: 8, width: Math.floor(viewportWidth / 2) - 16, right: Math.floor(viewportWidth / 2) - 8 } as any
            const maxTooltipW = Math.min(320, Math.max(240, pane.width - 16))
            const half = maxTooltipW / 2
            let left = hoverEdgeTooltipPos.x - half
            const minLeft = pane.left + 8
            const maxLeft = (pane.left + pane.width) - maxTooltipW - 8
            if (left < minLeft) left = minLeft
            if (left > maxLeft) left = maxLeft
              return (
                <div className="fixed z-50 pointer-events-none" style={{ left: `${left}px`, top, maxWidth: `${maxTooltipW}px` }}>
                  <EdgeTooltipContent edge={hoveredEdge} optimization={leftOptimization.data} />
                </div>
              )
          })()}
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
          <h3 className="text-base font-semibold mb-4 text-gray-900">Line Switching Enabled</h3>
          
          {/* Line Switching Status (read-only) */}
          <div className="mb-4">
            <div className="flex items-center text-sm text-gray-700">
              <div className="mr-2 w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                <span className="text-xs text-white">✓</span>
              </div>
              <label className="text-gray-600">
                Line Switching: <span className="font-medium text-gray-900">Enabled</span>
              </label>
            </div>
          </div>

          <div className="space-y-3 text-xs text-gray-700 mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                checked={rightUseSlack}
                onChange={(e) => setRightUseSlack(e.target.checked)}
              />
              <span>Use slack variables (angle & flow)</span>
            </label>
            {rightUseSlack && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Angle Penalty</p>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={rightSlackPenaltyAngle}
                    onChange={(e) => setRightSlackPenaltyAngle(Number(e.target.value))}
                    className="w-full rounded border-gray-300 focus:ring-gray-900 focus:border-gray-900 text-xs"
                  />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Flow Penalty</p>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={rightSlackPenaltyFlow}
                    onChange={(e) => setRightSlackPenaltyFlow(Number(e.target.value))}
                    className="w-full rounded border-gray-300 focus:ring-gray-900 focus:border-gray-900 text-xs"
                  />
                </div>
                <div className="col-span-2 text-[11px] text-gray-500">
                  Higher values keep constraints tight (default 10,000). Lower values (~1,000) allow more slack.
                </div>
                <div className="col-span-2 grid grid-cols-1 gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Max Angle Slack (% limit): {(rightSlackAngleFraction * 100).toFixed(3)}%
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={0.001}
                      step={0.0001}
                      value={rightSlackAngleFraction}
                      onChange={(e) => setRightSlackAngleFraction(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>0%</span>
                      <span>0.05%</span>
                      <span>0.10%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Max Flow Slack (% limit): {(rightSlackFlowFraction * 100).toFixed(3)}%
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={0.001}
                      step={0.0001}
                      value={rightSlackFlowFraction}
                      onChange={(e) => setRightSlackFlowFraction(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>0%</span>
                      <span>0.05%</span>
                      <span>0.10%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                checked={rightForceSecondGen}
                onChange={(e) => setRightForceSecondGen(e.target.checked)}
              />
              <span>Force 2nd-cheapest generator to max</span>
            </label>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Switch Off Lines</p>
              <textarea
                rows={2}
                value={rightDisabledLines}
                onChange={(e) => setRightDisabledLines(e.target.value)}
                placeholder="e.g., 11, 40, 41"
                className="w-full rounded border-gray-300 focus:ring-gray-900 focus:border-gray-900 text-xs"
              />
            </div>
          </div>

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
              onEdgeMouseEnter={(event: any, edge: any) => {
                // Only show tooltip for enabled lines (status >= 0.5)
                if (edge.data?.status !== undefined && edge.data.status >= 0.5) {
                  setHoverEdgeTooltipSide('right')
                  setHoveredEdge(edge)
                  setHoverEdgeTooltipPos({ x: event.clientX, y: event.clientY })
                }
              }}
              onEdgeMouseMove={(event: any) => {
                if (hoveredEdge) {
                  setHoverEdgeTooltipPos({ x: event.clientX, y: event.clientY })
                }
              }}
              onEdgeMouseLeave={() => {
                setHoveredEdge(null)
                setHoverEdgeTooltipPos(null)
                setHoverEdgeTooltipSide(null)
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
            {/* Right Edge Hover Tooltip */}
            {hoveredEdge && hoverEdgeTooltipPos && hoverEdgeTooltipSide === 'right' && (() => {
              const offset = 12
              const margin = 8
              const viewportH = (typeof window !== 'undefined') ? window.innerHeight : 800
              const estimatedH = 200
              const desiredBelowTop = hoverEdgeTooltipPos.y + offset
              const wouldOverflowBelow = desiredBelowTop + estimatedH > (viewportH - margin)
              const placeBelow = !wouldOverflowBelow
              const top = placeBelow ? `${desiredBelowTop}px` : `${Math.max(margin, hoverEdgeTooltipPos.y - offset - estimatedH)}px`
              const viewportWidth = (typeof window !== 'undefined') ? window.innerWidth : 1024
              const pane = rightPaneRect ?? { left: Math.floor(viewportWidth / 2) + 8, width: Math.floor(viewportWidth / 2) - 16, right: viewportWidth - 8 } as any
              const maxTooltipW = Math.min(320, Math.max(240, pane.width - 16))
              const half = maxTooltipW / 2
              let left = hoverEdgeTooltipPos.x - half
              const minLeft = pane.left + 8
              const maxLeft = (pane.left + pane.width) - maxTooltipW - 8
              if (left < minLeft) left = minLeft
              if (left > maxLeft) left = maxLeft
              return (
                <div className="fixed z-50 pointer-events-none" style={{ left: `${left}px`, top, maxWidth: `${maxTooltipW}px` }}>
                  <EdgeTooltipContent edge={hoveredEdge} optimization={rightOptimization.data} />
                </div>
              )
            })()}
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

