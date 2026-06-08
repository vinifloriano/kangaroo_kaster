import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */
export interface SystemDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
  groupId: string
}

export interface VirtualDevice {
  id: string
  name: string
  type: 'input' | 'output' | 'loopback'
  active: boolean
  sampleRate: number
  channels: string
  volume: number
  destinations: string[]
  appSourceId?: string
  appSourceName?: string
  linkedDeviceId?: string // If it's a proxy for a hardware device
  isPhysical?: boolean
  physicalName?: string
}

export interface Connection {
  id: string
  fromNodeId: string
  fromPortId: string
  toNodeId: string
  toPortId: string
}

export interface MixerChannel {
  id: string
  name: string
  volume: number
  muted: boolean
  solo: boolean
  pan: number // -100 to 100
  isLive: boolean
}

export interface AudioEngineContextType {
  devices: SystemDevice[]
  virtualDevices: VirtualDevice[]
  connections: Connection[]
  mixerChannels: MixerChannel[]
  masterVolume: number
  masterMuted: boolean
  driverStatus: { installed: boolean; type: string; message: string }
  driverLogs: string[]
  installingDriver: boolean
  loadingDevices: boolean
  permissionStatus: 'unknown' | 'granted' | 'denied'
  channelLevels: Record<string, number>
  masterLevel: number
  audioErrors: { id: string; message: string; timestamp: number }[]

  // Actions
  enumerateDevices: () => Promise<void>
  requestMicrophonePermission: () => Promise<void>
  addConnection: (fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => void
  removeConnection: (id: string) => void
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>
  toggleVirtualDevice: (id: string) => void
  addVirtualCable: () => void
  removeVirtualDevice: (id: string) => void
  setVirtualDeviceVolume: (id: string, volume: number) => void
  setVirtualDeviceAppSource: (id: string, appSourceId: string | undefined, appSourceName: string | undefined) => void
  getAppSources: () => Promise<{ id: string; name: string }[]>
  updateMixerChannel: (id: string, fields: Partial<MixerChannel>) => void
  setMasterVolume: (volume: number) => void
  setMasterMuted: (muted: boolean) => void
  checkDriverStatus: () => Promise<void>
  installDriver: () => Promise<void>
  clearDriverLogs: () => void
  getAudioContext: () => AudioContext | null
  getChannelInputNode: (id: string) => GainNode | null
  
  hardwareMicId: string
  hardwareSpeakerId: string
  hardwareMonitorId: string
  setHardwareMicId: (id: string) => void
  setHardwareSpeakerId: (id: string) => void
  setHardwareMonitorId: (id: string) => void
}

const AudioEngineContext = createContext<AudioEngineContextType | undefined>(undefined)

/* ────────────────────────────────────────────
   Helper Constants
   ──────────────────────────────────────────── */
const PORT_TO_CHANNEL_MAP: Record<string, string> = {
  'mic-in': 'mic',
  'desktop-in': 'desktop',
  'browser-in': 'browser',
  'music-in': 'music',
  'discord-in': 'discord',
  'game-in': 'game'
}

/* ────────────────────────────────────────────
   Virtual Device Utilities
   ──────────────────────────────────────────── */
export const isVirtualDeviceLabel = (label: string): boolean => {
  const l = label.toLowerCase()
  return (
    l.includes('blackhole') ||
    l.includes('vb-cable') ||
    l.includes('vb-audio') ||
    l.includes('virtual audio') ||
    l.includes('loopback') ||
    l.includes('audio virtual') || // Portuguese/Spanish
    l.includes('cabo virtual') || // Portuguese
    l.includes('cable virtual') // Spanish
  )
}

export interface VirtualDevicePair {
  name: string
  inputId: string | null
  outputId: string | null
}

export const getSystemVirtualDevicePairs = (devices: SystemDevice[]): VirtualDevicePair[] => {
  const inputs = devices.filter((d) => d.kind === 'audioinput' && isVirtualDeviceLabel(d.label))
  const outputs = devices.filter((d) => d.kind === 'audiooutput' && isVirtualDeviceLabel(d.label))

  const pairs: VirtualDevicePair[] = []

  // Try to pair them by matching labels
  outputs.forEach((outDev) => {
    // Remove numbers and channel counts for better fuzzy matching (e.g. \"BlackHole 2ch\" vs \"BlackHole 16ch\")
    const outLabel = outDev.label.replace(/\(.*\)/g, '').replace(/\d+ch/gi, '').trim()
    const matchingInput = inputs.find((inDev) => {
      const inLabel = inDev.label.replace(/\(.*\)/g, '').replace(/\d+ch/gi, '').trim()
      return inLabel === outLabel || inLabel.includes(outLabel) || inLabel.includes(inLabel)
    })

    pairs.push({
      name: outDev.label,
      inputId: matchingInput ? matchingInput.deviceId : null,
      outputId: outDev.deviceId
    })
  })

  // Any inputs that weren't paired
  inputs.forEach((inDev) => {
    const isPaired = pairs.some((p) => p.inputId === inDev.deviceId)
    if (!isPaired) {
      pairs.push({
        name: inDev.label,
        inputId: inDev.deviceId,
        outputId: null
      })
    }
  })

  return pairs
}

/* ────────────────────────────────────────────
   Provider Implementation
   ──────────────────────────────────────────── */
export const AudioEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<SystemDevice[]>([])
  const [connections, setConnectionsState] = useState<Connection[]>(() => {
    const saved = localStorage.getItem('kk_connections')
    let list: Connection[] = []
    let hasSaved = false
    if (saved) {
      try { 
        list = JSON.parse(saved) 
        hasSaved = true
      } catch (e) {
          // ignore
        }
    }

    if (hasSaved && list.length > 0) {
    // Migrate legacy/placeholder IDs to the correct loopbacks and ports
      return list.map((c) => {
        let fromNodeId = c.fromNodeId
        let fromPortId = c.fromPortId
      let toNodeId = c.toNodeId
      let toPortId = c.toPortId

        if (fromNodeId === 'desktop' || fromNodeId === 'vloop-1') {
          fromNodeId = 'vloop-desktop'
          fromPortId = 'vloop-desktop-out'
        }
        if (fromNodeId === 'browser' || fromNodeId === 'vloop-2') {
          fromNodeId = 'vloop-browser'
          fromPortId = 'vloop-browser-out'
        }
        if (fromNodeId === 'game') {
          fromNodeId = 'vloop-game'
          fromPortId = 'vloop-game-out'
        }
        if (fromNodeId === 'music') {
          fromNodeId = 'vloop-music'
          fromPortId = 'vloop-music-out'
        }
        if (fromNodeId === 'discord') {
          fromNodeId = 'vloop-discord'
          fromPortId = 'vloop-discord-out'
        }

      // Port migration for mixer inputs
      if (toNodeId === 'mixer') {
        if (toPortId === 'mixer-in1') toPortId = 'mic-in'
        if (toPortId === 'mixer-in2') toPortId = 'desktop-in'
        if (toPortId === 'mixer-in3') toPortId = 'browser-in'
        if (toPortId === 'mixer-in5') toPortId = 'music-in'
        if (toPortId === 'mixer-in6') toPortId = 'discord-in'
        if (toPortId === 'mixer-in4') toPortId = 'game-in'
      }

        return { id: c.id, fromNodeId, fromPortId, toNodeId, toPortId }
      })
    }

    return [
      { id: 'c1', fromNodeId: 'mic', fromPortId: 'mic-out', toNodeId: 'mixer', toPortId: 'mic-in' },
      { id: 'c2', fromNodeId: 'vloop-desktop', fromPortId: 'vloop-desktop-out', toNodeId: 'mixer', toPortId: 'desktop-in' },
      { id: 'c3', fromNodeId: 'vloop-browser', fromPortId: 'vloop-browser-out', toNodeId: 'mixer', toPortId: 'browser-in' },
      { id: 'c4', fromNodeId: 'vloop-game', fromPortId: 'vloop-game-out', toNodeId: 'mixer', toPortId: 'game-in' },
      { id: 'c5', fromNodeId: 'vloop-music', fromPortId: 'vloop-music-out', toNodeId: 'mixer', toPortId: 'music-in' },
      { id: 'c6', fromNodeId: 'vloop-discord', fromPortId: 'vloop-discord-out', toNodeId: 'mixer', toPortId: 'discord-in' },
      { id: 'c-out', fromNodeId: 'mixer', fromPortId: 'mixer-out', toNodeId: 'speakers', toPortId: 'speakers-in' }
    ]
  })

  useEffect(() => {
    localStorage.setItem('kk_connections', JSON.stringify(connections))
  }, [connections])

  const [mixerChannels, setMixerChannels] = useState<MixerChannel[]>(() => {
    const saved = localStorage.getItem('kk_mixer_channels')
    let list: MixerChannel[] = []
    if (saved) {
      try { list = JSON.parse(saved) } catch (e) {
          // ignore
        }
    }
    
    const defaultChannels = [
      { id: 'mic', name: 'Microphone', volume: 0, muted: true, solo: false, pan: 0, isLive: false },
      { id: 'desktop', name: 'Desktop', volume: 60, muted: false, solo: false, pan: 0, isLive: false },
      { id: 'browser', name: 'Browser', volume: 45, muted: false, solo: false, pan: 0, isLive: false },
      { id: 'music', name: 'Music', volume: 55, muted: false, solo: false, pan: -20, isLive: false },
      { id: 'discord', name: 'Discord', volume: 40, muted: false, solo: false, pan: 0, isLive: false },
      { id: 'game', name: 'Game', volume: 70, muted: false, solo: false, pan: 0, isLive: false }
    ]

    if (list.length === 0) {
      return defaultChannels
    }

    return list
  })

  useEffect(() => {
    localStorage.setItem('kk_mixer_channels', JSON.stringify(mixerChannels))
  }, [mixerChannels])

  const [masterVolume, setMasterVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('kk_master_volume')
    return saved ? Number(saved) : 85
  })

  const [masterMuted, setMasterMutedState] = useState<boolean>(() => {
    const saved = localStorage.getItem('kk_master_muted')
    return saved === 'true'
  })

  // --- Persistent Virtual Cables with expansion to 5 default loopbacks ---
  const [virtualCables, setVirtualCables] = useState<VirtualDevice[]>(() => {
    const saved = localStorage.getItem('kk_virtual_cables')
    let list: VirtualDevice[] = []
    if (saved) {
      try { list = JSON.parse(saved) } catch (e) {
          // ignore
        }
    }

    const defaultLoopbacks: VirtualDevice[] = [
      {
        id: 'vloop-desktop',
        name: 'Desktop Audio',
        type: 'loopback',
        active: true,
        sampleRate: 48000,
        channels: '2-ch Stereo',
        volume: 100,
        destinations: ['Stream Output']
      },
      {
        id: 'vloop-browser',
        name: 'Browser Audio',
        type: 'loopback',
        active: true,
        sampleRate: 48000,
        channels: '2-ch Stereo',
        volume: 100,
        destinations: ['Stream Output']
      },
      {
        id: 'vloop-game',
        name: 'Game Audio',
        type: 'loopback',
        active: true,
        sampleRate: 48000,
        channels: '2-ch Stereo',
        volume: 100,
        destinations: ['Stream Output']
      },
      {
        id: 'vloop-music',
        name: 'Music Audio',
        type: 'loopback',
        active: true,
        sampleRate: 48000,
        channels: '2-ch Stereo',
        volume: 100,
        destinations: ['Stream Output']
      },
      {
        id: 'vloop-discord',
        name: 'Discord Audio',
        type: 'loopback',
        active: true,
        sampleRate: 48000,
        channels: '2-ch Stereo',
        volume: 100,
        destinations: ['Stream Output']
      }
    ]

    if (list.length === 0) {
      return defaultLoopbacks
    }
    
    // Ensure the 5 default loopbacks exist
    defaultLoopbacks.forEach(defaultCable => {
      const exists = list.some((c) => c.id === defaultCable.id)
      if (!exists) {
        list.push(defaultCable)
      }
    })

    return list
  })

  useEffect(() => {
    localStorage.setItem('kk_virtual_cables', JSON.stringify(virtualCables))
  }, [virtualCables])

  const [driverStatus, setDriverStatus] = useState({
    installed: false,
    type: 'unknown',
    message: 'Checking status...'
  })
  const [driverLogs, setDriverLogs] = useState<string[]>([])
  const [installingDriver, setInstallingDriver] = useState(false)
  
  // --- Live Metering States ---
  const [micLevel, setMicLevel] = useState(0)

  // --- Web Audio Graph References ---
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  
  // Maps to hold active audio objects so we can rebuild/teardown them
  const activeStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const activeSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map())
  const activeGainNodesRef = useRef<Map<string, GainNode>>(new Map()) // Permanent mixer input nodes
  const activeFaderNodesRef = useRef<Map<string, GainNode>>(new Map()) // Permanent mixer fader nodes
  const activePannerNodesRef = useRef<Map<string, StereoPannerNode>>(new Map()) // Permanent panners
  const activeAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map()) // Input analysers
  const masterAnalyserRef = useRef<AnalyserNode | null>(null) // Final master analyser
  
  const activeSimulatedLoopbacksRef = useRef<Map<string, GainNode>>(new Map())
  const activeSimulatedSourcesRef = useRef<Map<string, { nodes: AudioNode[] }>>(new Map()) // oscillator/noise/filter/etc
  
  // Track setSinkId outputs to avoid creating duplicate audio elements for the same device
  // id -> { destNode, audio }
  const activeOutputsRef = useRef<Map<string, { destNode: MediaStreamAudioDestinationNode; audio: HTMLAudioElement }>>(new Map()) // target setSinkId outputs
  const deviceGainsRef = useRef<Map<string, GainNode>>(new Map())
  
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [channelLevels, setChannelLevels] = useState<Record<string, number>>({})
  const [audioErrors, setAudioErrors] = useState<{ id: string; message: string; timestamp: number }[]>([])

  const addAudioError = useCallback((message: string) => {
    setAudioErrors((prev) => [...prev, { id: Date.now().toString(), message, timestamp: Date.now() }].slice(-5))
  }, [])
  const [masterLevel, setMasterLevel] = useState(0)
  const rebuildingRef = useRef(false)
  const pendingRebuildRef = useRef(false)
  const rafRef = useRef<number>()

  const [deviceVolumes, setDeviceVolumes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('kk_device_volumes')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {
          // ignore
        }
    }
    return {}
  })

  useEffect(() => {
    localStorage.setItem('kk_device_volumes', JSON.stringify(deviceVolumes))
  }, [deviceVolumes])

  const [hardwareMicId, setHardwareMicIdState] = useState<string>(() => localStorage.getItem('kk_hw_mic') || 'default')
  const [hardwareSpeakerId, setHardwareSpeakerIdState] = useState<string>(() => localStorage.getItem('kk_hw_speaker') || 'default')
  const [hardwareMonitorId, setHardwareMonitorIdState] = useState<string>(() => localStorage.getItem('kk_hw_monitor') || 'default')

  const setHardwareMicId = useCallback((id: string) => {
    setHardwareMicIdState(id)
    localStorage.setItem('kk_hw_mic', id)
  }, [])
  
  const setHardwareSpeakerId = useCallback((id: string) => {
    setHardwareSpeakerIdState(id)
    localStorage.setItem('kk_hw_speaker', id)
  }, [])
  
  const setHardwareMonitorId = useCallback((id: string) => {
    setHardwareMonitorIdState(id)
    localStorage.setItem('kk_hw_monitor', id)
  }, [])

  // Auto-map placeholder outputs/inputs to real default devices once listed
  useEffect(() => {
    if (devices.length === 0) return

    setConnectionsState((prev) => {
      let changed = false
      const next = prev.map((c) => {
        let fromNodeId = c.fromNodeId
        let fromPortId = c.fromPortId
        const toNodeId = c.toNodeId
        const toPortId = c.toPortId

        // Map legacy placeholders to new loopback IDs
        if (fromNodeId === 'desktop' || fromNodeId === 'vloop-1') {
          fromNodeId = 'vloop-desktop'
          fromPortId = 'vloop-desktop-out'
          changed = true
        }
        if (fromNodeId === 'browser' || fromNodeId === 'vloop-2') {
          fromNodeId = 'vloop-browser'
          fromPortId = 'vloop-browser-out'
          changed = true
        }
        if (fromNodeId === 'game') {
          fromNodeId = 'vloop-game'
          fromPortId = 'vloop-game-out'
          changed = true
        }
        if (fromNodeId === 'music') {
          fromNodeId = 'vloop-music'
          fromPortId = 'vloop-music-out'
          changed = true
        }
        if (fromNodeId === 'discord') {
          fromNodeId = 'vloop-discord'
          fromPortId = 'vloop-discord-out'
          changed = true
        }

        return { id: c.id, fromNodeId, fromPortId, toNodeId, toPortId }
      })

      if (changed) {
        return next
      }
      return prev
    })
  }, [devices])

  const setMasterVolume = (vol: number) => {
    setMasterVolumeState(vol)
    localStorage.setItem('kk_master_volume', vol.toString())
  }

  const setMasterMuted = (muted: boolean) => {
    setMasterMutedState(muted)
    localStorage.setItem('kk_master_muted', muted.toString())
  }

  // --- Dynamic Virtual Cable mapping helpers ---
  const resolvePhysicalInputId = useCallback((nodeId: string): { physicalId: string | null; isDefaultMic: boolean } => {
    // 1. Resolve logical "mic" or "default"
    if (nodeId === 'mic' || nodeId === 'default') {
      const targetId = hardwareMicId === 'default' ? 'default' : hardwareMicId
      const realDevice = devices.find(d => d.deviceId === targetId && d.kind === 'audioinput')
      return { 
        physicalId: realDevice ? realDevice.deviceId : (targetId === 'default' ? null : targetId),
        isDefaultMic: targetId === 'default'
      }
    }
    
    // 2. Resolve by loopback index (for virtual cables that act as proxies)
    const systemPairs = getSystemVirtualDevicePairs(devices)
    const loopbackCables = virtualCables.filter(c => c.type === 'loopback')
    const loopbackIndex = loopbackCables.findIndex(c => c.id === nodeId)
    if (loopbackIndex !== -1 && loopbackIndex < systemPairs.length) {
      return { physicalId: systemPairs[loopbackIndex].inputId, isDefaultMic: false }
    }
    
    // 3. Resolve by direct device ID or label matching (fallback for macOS device ID changes)
    const directMatch = devices.find(d => d.deviceId === nodeId && d.kind === 'audioinput')
    if (directMatch) return { physicalId: directMatch.deviceId, isDefaultMic: false }

    // Fallback: search by label if ID changed but device is still there
    const savedPos = localStorage.getItem('kk_node_positions')
    if (savedPos) {
       // This is a bit of a stretch, but on macOS IDs can change.
       // We'll trust the nodeId for now.
    }
    
    return { physicalId: nodeId, isDefaultMic: false }
  }, [devices, virtualCables, hardwareMicId])

  const resolvePhysicalOutputId = useCallback((nodeId: string): string | null => {
    let targetId = nodeId

    if (nodeId === 'headphones') targetId = hardwareMonitorId
    else if (nodeId === 'speakers' || nodeId === 'stream' || nodeId === 'recording' || nodeId === 'default') {
      targetId = hardwareSpeakerId
    } else {
      // Check if it's a loopback cable
      const systemPairs = getSystemVirtualDevicePairs(devices)
      const loopbackCables = virtualCables.filter(c => c.type === 'loopback')
      const loopbackIndex = loopbackCables.findIndex(c => c.id === nodeId)
      if (loopbackIndex !== -1 && loopbackIndex < systemPairs.length) {
        return systemPairs[loopbackIndex].outputId
      }
    }
    
    // Verify targetId exists
    const exists = devices.some(d => d.deviceId === targetId && d.kind === 'audiooutput')
    if (exists) return targetId
    
    // If it's a specific ID that no longer exists, try to find a similar label
    // or fallback to 'default'
    return 'default'
  }, [devices, virtualCables, hardwareSpeakerId, hardwareMonitorId])

  // Centralized Audio Graph Initialization
  const initAudioGraph = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current

    // Use standard browser audio context. Hardware mismatch errors (-10868)
    // usually happen when trying to force a rate in low-latency mode.
    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    // 1. Master Bus
    const masterGain = ctx.createGain()
    masterGain.gain.value = masterMuted ? 0 : masterVolume / 100
    masterGainRef.current = masterGain

    const mAnalyser = ctx.createAnalyser()
    mAnalyser.fftSize = 256
    mAnalyser.smoothingTimeConstant = 0.4
    masterAnalyserRef.current = mAnalyser

    // Chain: Gain -> Analyser -> Physical Output (handled in rebuild)
    masterGain.connect(mAnalyser)
    
    // Always connect master bus to destination as fallback
    mAnalyser.connect(ctx.destination)

    // 2. Create permanent mixer channel strips
    mixerChannels.forEach((ch) => {
      const chInput = ctx.createGain()
      chInput.gain.value = 1
      const chFader = ctx.createGain()
      chFader.gain.value = ch.muted ? 0 : ch.volume / 100
      const chAnalyser = ctx.createAnalyser()
      chAnalyser.fftSize = 256
      const chPanner = ctx.createStereoPanner()
      chPanner.pan.value = ch.pan / 100

      // Chain: Input -> Analyser (pre-fader) -> Fader -> Panner -> Master
      chInput.connect(chAnalyser)
      chAnalyser.connect(chFader)
      chFader.connect(chPanner)
      chPanner.connect(masterGain)

      activeGainNodesRef.current.set(ch.id, chInput)
      activeFaderNodesRef.current.set(ch.id, chFader)
      activePannerNodesRef.current.set(ch.id, chPanner)
      activeAnalysersRef.current.set(ch.id, chAnalyser)
    })

    return ctx
  }, [mixerChannels, masterMuted, masterVolume])

  // --- Ensure AudioContext Resumes on Interaction ---
  useEffect(() => {
    const handleInteraction = () => {
      if (audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {})
        }
        activeOutputsRef.current.forEach(({ audio }) => {
          if (audio.paused) audio.play().catch(() => {})
        })
      }
    }
    window.addEventListener('mousedown', handleInteraction, { capture: true })
    window.addEventListener('keydown', handleInteraction, { capture: true })
    return () => {
      window.removeEventListener('mousedown', handleInteraction, { capture: true })
      window.removeEventListener('keydown', handleInteraction, { capture: true })
    }
  }, [])

  const getAudioContext = useCallback(() => {
    return initAudioGraph()
  }, [initAudioGraph])

  const getChannelInputNode = useCallback((channelId: string): GainNode | null => {
    initAudioGraph()
    return activeGainNodesRef.current.get(channelId) || null
  }, [initAudioGraph])

  const resolveAudioNode = useCallback((nodeId: string, portId: string, type: 'input' | 'output') => {
    const ctx = initAudioGraph()

    // 1. Check Mixer
    if (nodeId === 'mixer') {
      if (type === 'input') {
        const mixerChId = PORT_TO_CHANNEL_MAP[portId]
        return activeGainNodesRef.current.get(mixerChId) || null
      } else {
        if (portId === 'mixer-out') return masterGainRef.current
        if (portId === 'mixer-mon') return masterGainRef.current // For now, both use master
      }
    }

    // 2. Check Loopbacks
    const cable = virtualCables.find(c => c.id === nodeId)
    if (cable && cable.type === 'loopback') {
      if (type === 'output') {
        const isAppSource = cable.active && cable.appSourceId
        const { physicalId, isDefaultMic } = resolvePhysicalInputId(nodeId)
        const sourceKey = isAppSource
          ? `app-${nodeId}`
          : (isDefaultMic ? 'mic' : (physicalId || nodeId))

        let devGain = deviceGainsRef.current.get(sourceKey)
        if (!devGain) {
          devGain = ctx.createGain()
          deviceGainsRef.current.set(sourceKey, devGain)
          const rawSource = activeSourcesRef.current.get(sourceKey) || activeSimulatedLoopbacksRef.current.get(sourceKey)
          if (rawSource) rawSource.connect(devGain)
        }
        return devGain
      } else {
        // Loopback as destination
        const outId = resolvePhysicalOutputId(nodeId)
        if (outId) {
          let devGain = deviceGainsRef.current.get(outId)
          if (!devGain) {
            devGain = ctx.createGain()
            deviceGainsRef.current.set(outId, devGain)

            if (!activeOutputsRef.current.has(outId)) {
               const dest = ctx.createMediaStreamDestination()
               const audio = new Audio()
               audio.srcObject = dest.stream
               if (typeof audio.setSinkId === 'function') audio.setSinkId(outId)
               audio.play().catch(() => {})
               activeOutputsRef.current.set(outId, { destNode: dest, audio })
               devGain.connect(dest)
            }
          }
          return devGain
        }
      }
    }

    // 3. Check Hardware Devices
    if (type === 'output') {
      const { physicalId, isDefaultMic } = resolvePhysicalInputId(nodeId)
      const sourceKey = isDefaultMic ? 'mic' : (physicalId || nodeId)
      let devGain = deviceGainsRef.current.get(sourceKey)
      if (!devGain) {
        devGain = ctx.createGain()
        deviceGainsRef.current.set(sourceKey, devGain)
        const rawSource = activeSourcesRef.current.get(sourceKey) || activeSimulatedLoopbacksRef.current.get(sourceKey)
        if (rawSource) rawSource.connect(devGain)
      }
      return devGain
    } else {
      const outId = resolvePhysicalOutputId(nodeId)
      if (outId) {
        let devGain = deviceGainsRef.current.get(outId)
        if (!devGain) {
          devGain = ctx.createGain()
          deviceGainsRef.current.set(outId, devGain)

          if (!activeOutputsRef.current.has(outId)) {
             const dest = ctx.createMediaStreamDestination()
             const audio = new Audio()
             audio.srcObject = dest.stream
             if (typeof audio.setSinkId === 'function') audio.setSinkId(outId)
             audio.play().catch(() => {})
             activeOutputsRef.current.set(outId, { destNode: dest, audio })
             devGain.connect(dest)
          }
        }
        return devGain
      }
    }

    return null
  }, [initAudioGraph, virtualCables, resolvePhysicalInputId, resolvePhysicalOutputId])

  // --- Device Enumeration ---
  const enumerateDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const micStatus = await window.api?.permissions.getMicrophoneStatus()
      const devs = await navigator.mediaDevices.enumerateDevices()
      const mappedDevs = devs.map((d) => ({
        deviceId: d.deviceId,
        label: d.label || (d.kind === 'audioinput' ? 'Input Device' : 'Output Device'),
        kind: d.kind,
        groupId: d.groupId
      }))
      setDevices(mappedDevs)
      setPermissionStatus(micStatus === 'granted' ? 'granted' : 'unknown')
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err)
      setPermissionStatus('denied')
    }
    setLoadingDevices(false)
  }, [])

  const requestMicrophonePermission = useCallback(async () => {
    try {
      const result = await window.api?.permissions.requestMicrophone()
      if (result === 'granted') {
        setPermissionStatus('granted')
        await enumerateDevices()
      } else {
        setPermissionStatus('denied')
      }
    } catch {
      setPermissionStatus('denied')
    }
  }, [enumerateDevices])

  // --- Driver Checking & Installing ---
  const checkDriverStatus = useCallback(async () => {
    if (!window.api?.drivers) return
    try {
      const status = await window.api.drivers.checkStatus()
      setDriverStatus(status)
    } catch (err) {
      console.error('Failed to check driver status:', err)
    }
  }, [])

  const installDriver = useCallback(async () => {
    if (!window.api?.drivers) return
    setInstallingDriver(true)
    setDriverLogs([])
    
    const unsubscribe = window.api.drivers.onInstallProgress((data) => {
      setDriverLogs((prev) => [...prev, data.log])
    })

    try {
      const result = await window.api.drivers.install()
      if (result.success) {
        setDriverLogs((prev) => [...prev, '\n✓ Virtual Audio Driver installed successfully!\nRefreshing device list...'])
        await enumerateDevices()
        await checkDriverStatus()
      } else {
        setDriverLogs((prev) => [...prev, `\n✕ Installation failed: ${result.error}`])
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setDriverLogs((prev) => [...prev, `\n✕ Error during installation: ${errMsg}`])
    } finally {
      unsubscribe()
      setInstallingDriver(false)
    }
  }, [enumerateDevices, checkDriverStatus])

  const clearDriverLogs = useCallback(() => setDriverLogs([]), [])

  // --- Merge Virtual Devices dynamically ---
  const virtualDevices = useMemo(() => {
    const list: VirtualDevice[] = []
    
    // Get all system virtual device pairs
    const systemPairs = getSystemVirtualDevicePairs(devices)
    
    // 1. Hardware Inputs (exclude virtual ones to avoid redundancy)
    devices
      .filter((d) => d.kind === 'audioinput' && !isVirtualDeviceLabel(d.label))
      .forEach((d) => {
        list.push({
          id: d.deviceId,
          name: d.label,
          type: 'input',
          active: true,
          sampleRate: 48000,
          channels: '2-ch Stereo',
          volume: deviceVolumes[d.deviceId] ?? 80,
          destinations: ['Stream Output'],
          linkedDeviceId: d.deviceId
        })
      })

    // 2. Hardware Outputs (exclude virtual ones to avoid redundancy)
    devices
      .filter((d) => d.kind === 'audiooutput' && !isVirtualDeviceLabel(d.label))
      .forEach((d, i) => {
        list.push({
          id: d.deviceId,
          name: d.label,
          type: 'output',
          active: true,
          sampleRate: 48000,
          channels: '2-ch Stereo',
          volume: deviceVolumes[d.deviceId] ?? 100,
          destinations: i === 0 ? ['Speakers'] : ['Monitor'],
          linkedDeviceId: d.deviceId
        })
      })

    // 3. User Loopbacks
    virtualCables.forEach((c, index) => {
      // Map name to the system virtual device if available
      let mappedName = c.name
      let isPhysical = false
      let physicalName = ''
      if (index < systemPairs.length) {
        isPhysical = true
        physicalName = systemPairs[index].name
        mappedName = `${systemPairs[index].name} (${c.name})`
      }
      list.push({
        ...c,
        name: mappedName,
        isPhysical,
        physicalName
      })
    })

    return list
  }, [devices, virtualCables, deviceVolumes])

  // --- High-Performance Audio Routing Engine ---
  const rebuildAudioRouting = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    try {
      const ctx = initAudioGraph()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})

      // 1. Inputs Calculation
      const neededInputs = new Set<string>()
      
      connections.forEach((conn) => {
        const cable = virtualCables.find(c => c.id === conn.fromNodeId)
        if (cable?.active && cable.appSourceId) {
          neededInputs.add(`app-${cable.id}`)
        } else {
          const { physicalId, isDefaultMic } = resolvePhysicalInputId(conn.fromNodeId)
          if (isDefaultMic && permissionStatus === 'granted') neededInputs.add('mic')
          else if (physicalId) neededInputs.add(physicalId)
        }
      })

      // 2. Stream Acquisition
      for (const key of neededInputs) {
        let stream = activeStreamsRef.current.get(key)
        if (!stream || stream.getTracks().some(t => t.readyState !== 'live')) {
          try {
            if (key === 'mic') {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            } else if (key.startsWith('app-')) {
              const cable = virtualCables.find((c) => `app-${c.id}` === key)
              if (cable?.appSourceId) {
                // Set the pending source for the main process handler to pick up
                await window.api.apps.setCaptureSource(cable.appSourceId)

                // Use getDisplayMedia: the "best and greatest" technique for 
                // per-app audio on macOS/Windows in modern Electron/Chromium.
                // Our main process handler will automatically select the right source.
                stream = await navigator.mediaDevices.getDisplayMedia({
                  audio: true,
                  video: true
                })
                stream.getVideoTracks().forEach((t) => t.stop())
              }
            } else {
              stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: key } })
            }
            if (stream) activeStreamsRef.current.set(key, stream)
          } catch (err) {
            const deviceLabel = devices.find(d => d.deviceId === key)?.label || key
            addAudioError(`Failed to capture audio from ${deviceLabel}: ${err instanceof Error ? err.message : String(err)}`)
            continue
          }
        }
        if (stream && !activeSourcesRef.current.has(key)) {
          activeSourcesRef.current.set(key, ctx.createMediaStreamSource(stream))
        }
      }

      // 3. Clear Dynamic device gains
      deviceGainsRef.current.forEach(n => { try { n.disconnect() } catch (e) { /* ignore */ } })

      // 4. Reset terminal analyser
      const mAnalyser = masterAnalyserRef.current!
      try { mAnalyser.disconnect() } catch (e) { /* ignore */ }
      // Always reconnect to destination
      mAnalyser.connect(ctx.destination)

      // 5. Final Wiring
      connections.forEach((conn) => {
        const sourceNode = resolveAudioNode(conn.fromNodeId, conn.fromPortId, 'output')
        const targetNode = resolveAudioNode(conn.toNodeId, conn.toPortId, 'input')

        if (sourceNode && targetNode) {
          sourceNode.connect(targetNode)
        }
      })
    } catch (err) { console.error('Rebuild failed:', err) }
  }, [connections, permissionStatus, devices, virtualCables, resolvePhysicalInputId, resolvePhysicalOutputId, initAudioGraph])

  // --- Serialized Safe Rebuild Runner ---
  const safeRebuild = useCallback(async () => {
    if (rebuildingRef.current) {
      pendingRebuildRef.current = true
      return
    }

    rebuildingRef.current = true
    pendingRebuildRef.current = false

    try {
      await rebuildAudioRouting()
    } finally {
      rebuildingRef.current = false
      if (pendingRebuildRef.current) {
        setTimeout(() => safeRebuild(), 50)
      }
    }
  }, [rebuildAudioRouting])

  // --- Rebuild trigger ---
  const virtualCablesStructure = useMemo(() => {
    return virtualCables.map(c => `${c.id}:${c.active}:${c.appSourceId}`).join('|')
  }, [virtualCables])

  useEffect(() => {
    safeRebuild()
  }, [connections, permissionStatus, devices, virtualCablesStructure, safeRebuild])

  // --- Dynamic gain updates ---
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterMuted ? 0 : masterVolume / 100
    }
  }, [masterVolume, masterMuted])

  // --- Dynamic mixer updates ---
  useEffect(() => {
    const hasSolo = mixerChannels.some(ch => ch.solo)
    mixerChannels.forEach((ch) => {
      const chFader = activeFaderNodesRef.current.get(ch.id)
      if (chFader) {
        let targetVolume = ch.volume / 100
        if (ch.muted) targetVolume = 0
        else if (hasSolo && !ch.solo) targetVolume = 0
        chFader.gain.setValueAtTime(targetVolume, audioCtxRef.current?.currentTime || 0)
      }
      const chPanner = activePannerNodesRef.current.get(ch.id)
      if (chPanner) chPanner.pan.setValueAtTime(ch.pan / 100, audioCtxRef.current?.currentTime || 0)
    })
  }, [mixerChannels])

  // --- Meters loop ---
  useEffect(() => {
    let active = true
    const dataArray = new Uint8Array(128)
    const updateAllMeters = () => {
      if (!active) return
      const ctx = audioCtxRef.current
      if (ctx && ctx.state === 'running') {
        const nextLevels: Record<string, number> = {}
        activeAnalysersRef.current.forEach((analyser, chId) => {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          nextLevels[chId] = Math.min(100, (sum / dataArray.length / 128) * 100)
        })
        setChannelLevels(nextLevels)
        setMicLevel(nextLevels.mic ?? 0)
        if (masterAnalyserRef.current) {
          masterAnalyserRef.current.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          setMasterLevel(Math.min(100, (sum / dataArray.length / 128) * 100))
        }
      }
      requestAnimationFrame(updateAllMeters)
    }
    requestAnimationFrame(updateAllMeters)
    return () => { active = false }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      activeSimulatedSourcesRef.current.forEach((src) => {
        src.nodes.forEach((n) => {
          try { (n as unknown as { stop?: () => void }).stop?.() } catch (e) { /* ignore */ }
          try { n.disconnect() } catch (e) { /* ignore */ }
        })
      })
      activeSimulatedSourcesRef.current.clear()
    }
  }, [])

  // Lifecycle
  useEffect(() => {
    enumerateDevices().then(() => {
      const handleDeviceChange = () => enumerateDevices()
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
      return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    })
  }, [enumerateDevices])

  useEffect(() => {
    if (devices.length > 0) checkDriverStatus()
  }, [devices, checkDriverStatus])

  const addConnection = useCallback((fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => {
    setConnectionsState((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, fromNodeId, fromPortId, toNodeId, toPortId }
    ])
  }, [])

  const removeConnection = useCallback((id: string) => {
    setConnectionsState((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const toggleVirtualDevice = useCallback((id: string) => {
    setVirtualCables((prev) => prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d)))
  }, [])

  const addVirtualCable = useCallback(() => {
    setVirtualCables((prev) => [
      ...prev,
      {
        id: `vloop-${Date.now()}`,
        name: `Virtual Cable ${prev.length + 1}`,
        type: 'loopback',
        active: true,
        sampleRate: 48000,
        channels: '2-ch Stereo',
        volume: 100,
        destinations: ['Stream Output']
      }
    ])
  }, [])

  const removeVirtualDevice = useCallback((id: string) => {
    if (!['vloop-desktop', 'vloop-browser', 'vloop-game', 'vloop-music', 'vloop-discord'].includes(id)) {
      setVirtualCables((prev) => prev.filter((d) => d.id !== id))
    }
  }, [])

  const setVirtualDeviceVolume = useCallback((id: string, volume: number) => {
    setVirtualCables((prev) => prev.map((d) => (d.id === id ? { ...d, volume } : d)))
    setDeviceVolumes((prev) => ({ ...prev, [id]: volume }))
  }, [])

  const setVirtualDeviceAppSource = useCallback((id: string, appSourceId: string | undefined, appSourceName: string | undefined) => {
    setVirtualCables((prev) => prev.map((d) => (d.id === id ? { ...d, appSourceId, appSourceName } : d)))
  }, [])

  const getAppSources = useCallback(async () => {
    return window.api?.apps?.getSources ? window.api.apps.getSources() : []
  }, [])

  const updateMixerChannel = useCallback((id: string, fields: Partial<MixerChannel>) => {
    setMixerChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...fields } : ch)))
  }, [])

  return (
    <AudioEngineContext.Provider
      value={{
        devices, virtualDevices, connections, mixerChannels, masterVolume, masterMuted,
        driverStatus, driverLogs, installingDriver, micLevel, loadingDevices,
        permissionStatus, channelLevels, masterLevel, audioErrors,
        enumerateDevices, requestMicrophonePermission, addConnection, removeConnection,
        setConnections: setConnectionsState, toggleVirtualDevice, addVirtualCable,
        removeVirtualDevice, setVirtualDeviceVolume, setVirtualDeviceAppSource,
        getAppSources, updateMixerChannel, setMasterVolume, setMasterMuted,
        checkDriverStatus, installDriver, clearDriverLogs, getAudioContext, getChannelInputNode,
        hardwareMicId, hardwareSpeakerId, hardwareMonitorId,
        setHardwareMicId, setHardwareSpeakerId, setHardwareMonitorId
      }}
    >
      {children}
    </AudioEngineContext.Provider>
  )
}

export const useAudioEngine = () => {
  const context = useContext(AudioEngineContext)
  if (context === undefined) throw new Error('useAudioEngine must be used within an AudioEngineProvider')
  return context
}
