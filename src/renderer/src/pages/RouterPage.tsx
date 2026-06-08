import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Cable,
  ArrowLeft
} from 'lucide-react'
import { useAudioEngine, isVirtualDeviceLabel } from '../services/AudioEngine'
import type { Page } from '../App'

/* ────────────────────────────────────────────
   Types & Interfaces
   ──────────────────────────────────────────── */
interface Position {
  x: number
  y: number
}

interface Port {
  id: string
  label: string
  type: 'input' | 'output'
}

interface AudioNode {
  id: string
  label: string
  icon: string
  color: string
  category: 'source' | 'processor' | 'destination'
  position: Position
  ports: Port[]
}

/* ────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────── */
const NODE_WIDTH = 200
const PORT_HEIGHT = 28
const NODE_HEADER_HEIGHT = 52

/* ────────────────────────────────────────────
   Positioning Helpers
   ──────────────────────────────────────────── */
const getInitialPosition = (category: 'source' | 'processor' | 'destination', index: number): Position => {
  switch (category) {
    case 'source':
      return { x: 80, y: 40 + index * 130 }
    case 'processor':
      return { x: 440, y: 120 + index * 260 }
    case 'destination':
      return { x: 800, y: 40 + index * 130 }
  }
}

function getPortPosition(
  node: AudioNode,
  portId: string,
  portType: 'input' | 'output'
): Position {
  const port = node.ports.find((p) => p.id === portId)
  if (!port) return { x: node.position.x, y: node.position.y }

  const inputPorts = node.ports.filter((p) => p.type === 'input')
  const outputPorts = node.ports.filter((p) => p.type === 'output')
  const ports = portType === 'input' ? inputPorts : outputPorts
  const index = ports.findIndex((p) => p.id === portId)

  const x = portType === 'input' ? node.position.x : node.position.x + NODE_WIDTH
  const y = node.position.y + NODE_HEADER_HEIGHT + (index >= 0 ? index : 0) * PORT_HEIGHT + PORT_HEIGHT / 2

  return { x, y }
}

function createCurvePath(from: Position, to: Position): string {
  const dx = Math.abs(to.x - from.x)
  const cp = Math.max(80, dx * 0.5)
  return `M ${from.x} ${from.y} C ${from.x + cp} ${from.y}, ${to.x - cp} ${to.y}, ${to.x} ${to.y}`
}

/* ────────────────────────────────────────────
   Connection Line Component
   ──────────────────────────────────────────── */
function ConnectionLine({
  from,
  to,
  color,
  animated,
  onDelete
}: {
  from: Position
  to: Position
  color: string
  animated: boolean
  onDelete?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const path = createCurvePath(from, to)

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: onDelete ? 'pointer' : 'default' }}
      onClick={onDelete}
    >
      {/* Invisible wider hit area */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={16} />

      {/* Glow */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={hovered ? 4 : 2}
        strokeOpacity={hovered ? 0.4 : 0.15}
        filter="url(#glow)"
      />

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={hovered ? 3 : 2}
        strokeOpacity={hovered ? 1 : 0.6}
        strokeLinecap="round"
      />

      {/* Animated flow dots */}
      {animated && (
        <circle r="3" fill={color} opacity="0.8">
          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
        </circle>
      )}

      {/* Delete indicator */}
      {hovered && onDelete && (
        <g>
          <circle
            cx={(from.x + to.x) / 2}
            cy={(from.y + to.y) / 2}
            r="10"
            fill="#1e293b"
            stroke="#ef4444"
            strokeWidth="1.5"
          />
          <text
            x={(from.x + to.x) / 2}
            y={(from.y + to.y) / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ef4444"
            fontSize="12"
            fontWeight="bold"
          >
            ×
          </text>
        </g>
      )}
    </g>
  )
}

/* ────────────────────────────────────────────
   Graph Node Component
   ──────────────────────────────────────────── */
function GraphNode({
  node,
  onDragStart,
  onPortMouseDown,
  onPortMouseUp,
  connectingPort
}: {
  node: AudioNode
  onDragStart: (id: string, e: React.MouseEvent) => void
  onPortMouseDown: (nodeId: string, portId: string, portType: 'input' | 'output', pos: Position) => void
  onPortMouseUp: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  connectingPort: { nodeId: string; portId: string; portType: 'input' | 'output' } | null
}) {
  const inputPorts = node.ports.filter((p) => p.type === 'input')
  const outputPorts = node.ports.filter((p) => p.type === 'output')
  const maxPorts = Math.max(inputPorts.length, outputPorts.length)
  const nodeHeight = NODE_HEADER_HEIGHT + maxPorts * PORT_HEIGHT + 8

  const categoryBorder = {
    source: 'border-l-4 border-l-cyan-500/40',
    processor: 'border-l-4 border-l-brand-500/40',
    destination: 'border-l-4 border-l-emerald-500/40'
  }

  return (
    <g>
      <foreignObject
        x={node.position.x}
        y={node.position.y}
        width={NODE_WIDTH}
        height={nodeHeight}
      >
        <div
          className={`bg-surface-800/90 backdrop-blur-md border border-white/[0.08] rounded-xl overflow-hidden select-none ${categoryBorder[node.category]}`}
          style={{
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)`,
            height: nodeHeight
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-3 h-[52px] cursor-grab active:cursor-grabbing"
            style={{ borderBottom: `1px solid ${node.color}20` }}
            onMouseDown={(e) => {
              e.stopPropagation()
              onDragStart(node.id, e)
            }}
          >
            <span className="text-lg">{node.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-white/80 truncate">{node.label}</p>
              <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${node.color}80` }}>
                {node.category}
              </p>
            </div>
          </div>

          {/* Ports */}
          <div className="flex">
            {/* Input ports */}
            <div className="flex-1">
              {inputPorts.map((port) => {
                const isValidTarget =
                  connectingPort &&
                  connectingPort.portType === 'output' &&
                  connectingPort.nodeId !== node.id

                return (
                  <div
                    key={port.id}
                    className={`flex items-center gap-2 h-[28px] pl-1 pr-3 text-[10px] font-mono transition-colors ${isValidTarget ? 'text-emerald-400 bg-emerald-500/5' : 'text-white/35'
                      }`}
                    onMouseUp={() => onPortMouseUp(node.id, port.id, 'input')}
                  >
                    <div
                      className={`w-3 h-3 rounded-full border-2 cursor-crosshair transition-all -ml-1.5 ${isValidTarget
                        ? 'border-emerald-400 bg-emerald-400/30 scale-125'
                        : 'border-white/20 bg-surface-900 hover:border-white/40'
                        }`}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        const pos = getPortPosition(node, port.id, 'input')
                        onPortMouseDown(node.id, port.id, 'input', pos)
                      }}
                    />
                    {port.label}
                  </div>
                )
              })}
            </div>

            {/* Output ports */}
            <div className="flex-1">
              {outputPorts.map((port) => {
                const isValidTarget =
                  connectingPort &&
                  connectingPort.portType === 'input' &&
                  connectingPort.nodeId !== node.id

                return (
                  <div
                    key={port.id}
                    className={`flex items-center justify-end gap-2 h-[28px] pl-3 pr-1 text-[10px] font-mono transition-colors ${isValidTarget ? 'text-emerald-400 bg-emerald-500/5' : 'text-white/35'
                      }`}
                    onMouseUp={() => onPortMouseUp(node.id, port.id, 'output')}
                  >
                    {port.label}
                    <div
                      className={`w-3 h-3 rounded-full border-2 cursor-crosshair transition-all -mr-1.5 ${isValidTarget
                        ? 'border-emerald-400 bg-emerald-400/30 scale-125'
                        : 'bg-surface-900 hover:border-white/40'
                        }`}
                      style={{ borderColor: isValidTarget ? undefined : `${node.color}50` }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        const pos = getPortPosition(node, port.id, 'output')
                        onPortMouseDown(node.id, port.id, 'output', pos)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  )
}

/* ────────────────────────────────────────────
   Router Page Component
   ──────────────────────────────────────────── */
interface RouterPageProps {
  onNavigate: (page: Page) => void
}

export default function RouterPage({ onNavigate }: RouterPageProps) {
  const {
    devices: systemDevices,
    virtualDevices,
    connections,
    addConnection,
    removeConnection
  } = useAudioEngine()

  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 })
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [connectingPort, setConnectingPort] = useState<{
    nodeId: string
    portId: string
    portType: 'input' | 'output'
    startPos: Position
  } | null>(null)
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  // Persistent coordinates storage for nodes
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>(() => {
    const saved = localStorage.getItem('kk_node_positions')
    return saved ? JSON.parse(saved) : {}
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const dragStartRef = useRef<Position>({ x: 0, y: 0 })
  const nodeStartRef = useRef<Position>({ x: 0, y: 0 })
  const panStartRef = useRef<Position>({ x: 0, y: 0 })

  // --- Dynamic Nodes Construction ---
  const nodes = useMemo(() => {
    const nodeList: AudioNode[] = []

    // 1. Sources (real audio input devices, excluding virtual ones)
    const inputs = systemDevices.filter((d) => d.kind === 'audioinput' && !isVirtualDeviceLabel(d.label))
    inputs.forEach((d, idx) => {
      // Map logical mic if matched, else use raw id
      const label = d.label
      const isMic = label.toLowerCase().includes('mic') || label.toLowerCase().includes('microfone')
      nodeList.push({
        id: d.deviceId,
        label: label,
        icon: isMic ? '🎙️' : '🔌',
        color: '#a855f7',
        category: 'source',
        ports: [{ id: `${d.deviceId}-out`, label: 'Out', type: 'output' }],
        position: nodePositions[d.deviceId] || getInitialPosition('source', idx)
      })
    })

    // Special logic: if no hardware inputs are connected, add a mock mic
    if (inputs.length === 0) {
      nodeList.push({
        id: 'mic',
        label: 'Microphone (Simulated)',
        icon: '🎙️',
        color: '#a855f7',
        category: 'source',
        ports: [{ id: 'mic-out', label: 'Out', type: 'output' }],
        position: nodePositions['mic'] || getInitialPosition('source', 0)
      })
    }

    // 2. Processors (Mixer + Virtual Loopbacks)
    // Add Main Mixer
    nodeList.push({
      id: 'mixer',
      label: 'Main Mixer',
      icon: '🎛️',
      color: '#8b5cf6',
      category: 'processor',
      ports: [
        { id: 'mixer-in1', label: 'In 1 (Mic)', type: 'input' },
        { id: 'mixer-in2', label: 'In 2 (Desktop)', type: 'input' },
        { id: 'mixer-in3', label: 'In 3 (Browser)', type: 'input' },
        { id: 'mixer-in5', label: 'In 4 (Music)', type: 'input' },
        { id: 'mixer-in6', label: 'In 5 (Discord)', type: 'input' },
        { id: 'mixer-in4', label: 'In 6 (Game)', type: 'input' },
        { id: 'mixer-out', label: 'Master Out', type: 'output' },
        { id: 'mixer-mon', label: 'Monitor', type: 'output' }
      ],
      position: nodePositions['mixer'] || getInitialPosition('processor', 0)
    })

    // Add Loopback virtual devices as Sources
    const loopbacks = virtualDevices.filter((v) => v.type === 'loopback')
    const sourceCount = inputs.length > 0 ? inputs.length : 1
    loopbacks.forEach((v, idx) => {
      nodeList.push({
        id: v.id,
        label: v.name,
        icon: '🔗',
        color: '#06b6d4',
        category: 'source',
        ports: [
          { id: `${v.id}-in`, label: 'In', type: 'input' },
          { id: `${v.id}-out`, label: 'Out', type: 'output' }
        ],
        position: nodePositions[v.id] || getInitialPosition('source', sourceCount + idx)
      })
    })

    // 3. Destinations (real audio output devices, excluding virtual ones)
    const outputs = systemDevices.filter((d) => d.kind === 'audiooutput' && !isVirtualDeviceLabel(d.label))
    outputs.forEach((d, idx) => {
      const label = d.label
      const isHeadphones = label.toLowerCase().includes('headphone') || label.toLowerCase().includes('fone')
      nodeList.push({
        id: d.deviceId,
        label: label,
        icon: isHeadphones ? '🎧' : '🔊',
        color: '#22c55e',
        category: 'destination',
        ports: [{ id: `${d.deviceId}-in`, label: 'In', type: 'input' }],
        position: nodePositions[d.deviceId] || getInitialPosition('destination', idx)
      })
    })

    // Special logic: if no hardware outputs are connected, add headphones and speakers
    if (outputs.length === 0) {
      nodeList.push({
        id: 'headphones',
        label: 'Headphones (Simulated)',
        icon: '🎧',
        color: '#22c55e',
        category: 'destination',
        ports: [{ id: 'headphones-in', label: 'In', type: 'input' }],
        position: nodePositions['headphones'] || getInitialPosition('destination', 0)
      })
      nodeList.push({
        id: 'speakers',
        label: 'Speakers (Simulated)',
        icon: '🔊',
        color: '#3b82f6',
        category: 'destination',
        ports: [{ id: 'speakers-in', label: 'In', type: 'input' }],
        position: nodePositions['speakers'] || getInitialPosition('destination', 1)
      })
    }

    return nodeList;
  }, [systemDevices, virtualDevices, nodePositions])

  // Convert screen coords to SVG coords
  const screenToSvg = useCallback(
    (screenX: number, screenY: number): Position => {
      const svg = svgRef.current
      if (!svg) return { x: screenX, y: screenY }
      const rect = svg.getBoundingClientRect()
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom
      }
    },
    [zoom, pan]
  )

  // Node dragging
  const handleDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.preventDefault()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      setDraggingNode(nodeId)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      nodeStartRef.current = { ...node.position }
    },
    [nodes]
  )

  // Port connection start
  const handlePortMouseDown = useCallback(
    (nodeId: string, portId: string, portType: 'input' | 'output', pos: Position) => {
      setConnectingPort({ nodeId, portId, portType, startPos: pos })
    },
    []
  )

  // Port connection complete
  const handlePortMouseUp = useCallback(
    (nodeId: string, portId: string, portType: 'input' | 'output') => {
      if (!connectingPort) return
      if (connectingPort.nodeId === nodeId) {
        setConnectingPort(null)
        return
      }

      // Determine from/to based on port types
      let fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string

      if (connectingPort.portType === 'output' && portType === 'input') {
        fromNodeId = connectingPort.nodeId
        fromPortId = connectingPort.portId
        toNodeId = nodeId
        toPortId = portId
      } else if (connectingPort.portType === 'input' && portType === 'output') {
        fromNodeId = nodeId
        fromPortId = portId
        toNodeId = connectingPort.nodeId
        toPortId = connectingPort.portId
      } else {
        setConnectingPort(null)
        return
      }

      addConnection(fromNodeId, fromPortId, toNodeId, toPortId)
      setConnectingPort(null)
    },
    [connectingPort, addConnection]
  )

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNode) {
        const dx = (e.clientX - dragStartRef.current.x) / zoom
        const dy = (e.clientY - dragStartRef.current.y) / zoom
        const newPos = {
          x: nodeStartRef.current.x + dx,
          y: nodeStartRef.current.y + dy
        }

        setNodePositions((prev) => {
          const next = { ...prev, [draggingNode]: newPos }
          localStorage.setItem('kk_node_positions', JSON.stringify(next))
          return next
        })
      }

      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        setPan({ x: dx, y: dy })
      }

      if (connectingPort) {
        const pos = screenToSvg(e.clientX, e.clientY)
        setMousePos(pos)
      }
    }

    const handleMouseUp = () => {
      setDraggingNode(null)
      if (isPanning) setIsPanning(false)
      if (connectingPort) setConnectingPort(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingNode, isPanning, connectingPort, zoom, screenToSvg])

  // Canvas pan (middle click or shift+click)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || e.shiftKey) {
        e.preventDefault()
        setIsPanning(true)
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      }
    },
    [pan]
  )

  // Zoom with scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((prev) => Math.max(0.3, Math.min(2, prev - e.deltaY * 0.001)))
  }, [])

  // Fit to view
  const fitToView = useCallback(() => {
    setZoom(0.85)
    setPan({ x: 0, y: 0 })
  }, [])

  return (
    <div className="flex flex-col h-full flex-1">
      {/* Header - Standardized with padding */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface-900/80 backdrop-blur-md border-b border-white/[0.06] shrink-0">
        <div>
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
            Audio Routing
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Routing <span className="gradient-text">Matrix</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] font-mono text-white/30 mr-4">
            <span>{nodes.length} nodes</span>
            <span>•</span>
            <span>{connections.length} connections</span>
          </div>

          <div className="flex items-center gap-1 glass-sm px-2 py-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono text-white/40 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
          <button
            onClick={fitToView}
            className="w-8 h-8 flex items-center justify-center rounded-lg glass-sm text-white/40 hover:text-white/70 transition-colors"
            aria-label="Fit to view"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Canvas - Full Bleed */}
      <div
        className="flex-1 relative overflow-hidden bg-[#080810]"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        {/* Legend Overlay */}
        <div className="absolute top-6 left-6 flex flex-col gap-2 z-10 p-3 rounded-xl bg-surface-900/60 backdrop-blur-md border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Source</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-500" />
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Processor</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Destination</span>
          </div>
          <div className="mt-1 pt-2 border-t border-white/5 text-[9px] text-white/20 italic">
            Drag ports to connect<br />Click wire to delete
          </div>
        </div>

        {/* Grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
        />

        <svg
          ref={svgRef}
          className="w-full h-full"
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Connections */}
            {connections.map((conn) => {
              const fromNode = nodes.find((n) => n.id === conn.fromNodeId)
              const toNode = nodes.find((n) => n.id === conn.toNodeId)
              if (!fromNode || !toNode) return null

              const from = getPortPosition(fromNode, conn.fromPortId, 'output')
              const to = getPortPosition(toNode, conn.toPortId, 'input')

              return (
                <ConnectionLine
                  key={conn.id}
                  from={from}
                  to={to}
                  color={fromNode.color}
                  animated={true}
                  onDelete={() => removeConnection(conn.id)}
                />
              )
            })}

            {/* Active connection being drawn */}
            {connectingPort && (
              <ConnectionLine
                from={connectingPort.startPos}
                to={mousePos}
                color="#6366f1"
                animated={false}
              />
            )}

            {/* Nodes */}
            {nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                onDragStart={handleDragStart}
                onPortMouseDown={handlePortMouseDown}
                onPortMouseUp={handlePortMouseUp}
                connectingPort={connectingPort}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
