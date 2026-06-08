import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AudioGraphManager } from './AudioGraph'

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
      const toNodeId = c.toNodeId
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

  // --- Persistent Virtual Cables ---
  const [virtualCables, setVirtualCables] = useState<VirtualDevice[]>(() => {
    const saved = localStorage.getItem('kk_virtual_cables')
    let list: VirtualDevice[] = []
    if (saved) {
      try { list = JSON.parse(saved) } catch (e) {
          // ignore
        }
    }

    const defaultLoopbacks: VirtualDevice[] = [
      { id: 'vloop-desktop', name: 'Desktop Audio', type: 'loopback', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: 100, destinations: ['Stream Output'] },
      { id: 'vloop-browser', name: 'Browser Audio', type: 'loopback', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: 100, destinations: ['Stream Output'] },
      { id: 'vloop-game', name: 'Game Audio', type: 'loopback', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: 100, destinations: ['Stream Output'] },
      { id: 'vloop-music', name: 'Music Audio', type: 'loopback', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: 100, destinations: ['Stream Output'] },
      { id: 'vloop-discord', name: 'Discord Audio', type: 'loopback', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: 100, destinations: ['Stream Output'] }
    ]

    if (list.length === 0) return defaultLoopbacks
    
    defaultLoopbacks.forEach(defaultCable => {
      const exists = list.some((c) => c.id === defaultCable.id)
      if (!exists) list.push(defaultCable)
    })

    return list
  })

  useEffect(() => {
    localStorage.setItem('kk_virtual_cables', JSON.stringify(virtualCables))
  }, [virtualCables])

  const [driverStatus, setDriverStatus] = useState({ installed: false, type: 'unknown', message: 'Checking status...' })
  const [driverLogs, setDriverLogs] = useState<string[]>([])
  const [installingDriver, setInstallingDriver] = useState(false)
  
  const [micLevel, setMicLevel] = useState(0)

  // --- Graph Manager Reference ---
  const graphManagerRef = useRef<AudioGraphManager | null>(null)
  
  const activeStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const activeSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map())
  
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

  useEffect(() => {
    if (devices.length === 0) return
    setConnectionsState((prev) => {
      let changed = false
      const next = prev.map((c) => {
        let fromNodeId = c.fromNodeId
        let fromPortId = c.fromPortId
        if (fromNodeId === 'desktop' || fromNodeId === 'vloop-1') { fromNodeId = 'vloop-desktop'; fromPortId = 'vloop-desktop-out'; changed = true }
        if (fromNodeId === 'browser' || fromNodeId === 'vloop-2') { fromNodeId = 'vloop-browser'; fromPortId = 'vloop-browser-out'; changed = true }
        if (fromNodeId === 'game') { fromNodeId = 'vloop-game'; fromPortId = 'vloop-game-out'; changed = true }
        if (fromNodeId === 'music') { fromNodeId = 'vloop-music'; fromPortId = 'vloop-music-out'; changed = true }
        if (fromNodeId === 'discord') { fromNodeId = 'vloop-discord'; fromPortId = 'vloop-discord-out'; changed = true }
        return { ...c, fromNodeId, fromPortId }
      })
      return changed ? next : prev
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

  const resolvePhysicalInputId = useCallback((nodeId: string): { physicalId: string | null; isDefaultMic: boolean } => {
    if (nodeId === 'mic' || nodeId === 'default') {
      const targetId = hardwareMicId === 'default' ? 'default' : hardwareMicId
      const realDevice = devices.find(d => d.deviceId === targetId && d.kind === 'audioinput')
      return { physicalId: realDevice ? realDevice.deviceId : (targetId === 'default' ? null : targetId), isDefaultMic: targetId === 'default' }
    }
    const systemPairs = getSystemVirtualDevicePairs(devices)
    const loopbackCables = virtualCables.filter(c => c.type === 'loopback')
    const loopbackIndex = loopbackCables.findIndex(c => c.id === nodeId)
    if (loopbackIndex !== -1 && loopbackIndex < systemPairs.length) {
      return { physicalId: systemPairs[loopbackIndex].inputId, isDefaultMic: false }
    }
    const directMatch = devices.find(d => d.deviceId === nodeId && d.kind === 'audioinput')
    if (directMatch) return { physicalId: directMatch.deviceId, isDefaultMic: false }
    return { physicalId: nodeId, isDefaultMic: false }
  }, [devices, virtualCables, hardwareMicId])

  const resolvePhysicalOutputId = useCallback((nodeId: string): string | null => {
    let targetId = nodeId
    if (nodeId === 'headphones') targetId = hardwareMonitorId
    else if (nodeId === 'speakers' || nodeId === 'stream' || nodeId === 'recording' || nodeId === 'default') targetId = hardwareSpeakerId
    else {
      const systemPairs = getSystemVirtualDevicePairs(devices)
      const loopbackCables = virtualCables.filter(c => c.type === 'loopback')
      const loopbackIndex = loopbackCables.findIndex(c => c.id === nodeId)
      if (loopbackIndex !== -1 && loopbackIndex < systemPairs.length) return systemPairs[loopbackIndex].outputId
    }
    return devices.some(d => d.deviceId === targetId && d.kind === 'audiooutput') ? targetId : 'default'
  }, [devices, virtualCables, hardwareSpeakerId, hardwareMonitorId])

  const initAudioGraph = useCallback(() => {
    if (!graphManagerRef.current) {
      graphManagerRef.current = new AudioGraphManager()
    }
    const manager = graphManagerRef.current
    manager.initMasterBus(masterVolume, masterMuted)
    mixerChannels.forEach(ch => manager.initMixerChannel(ch.id))
    return manager.getContext()
  }, [mixerChannels, masterMuted, masterVolume])

  useEffect(() => {
    const handleInteraction = () => {
      if (graphManagerRef.current) {
        graphManagerRef.current.resumeContext().catch(() => {})
      }
    }
    window.addEventListener('mousedown', handleInteraction, { capture: true })
    window.addEventListener('keydown', handleInteraction, { capture: true })
    return () => {
      window.removeEventListener('mousedown', handleInteraction, { capture: true })
      window.removeEventListener('keydown', handleInteraction, { capture: true })
    }
  }, [])

  const getAudioContext = useCallback(() => initAudioGraph(), [initAudioGraph])
  const getChannelInputNode = useCallback((channelId: string) => {
    initAudioGraph()
    return graphManagerRef.current?.getMixerInput(channelId) || null
  }, [initAudioGraph])

  const resolveAudioNode = useCallback((nodeId: string, portId: string, type: 'input' | 'output') => {
    const manager = graphManagerRef.current
    if (!manager) return null

    if (nodeId === 'mixer') {
      if (type === 'input') {
        const mixerChId = PORT_TO_CHANNEL_MAP[portId]
        return manager.getMixerInput(mixerChId)
      } else {
        return manager.getMasterGain()
      }
    }

    const cable = virtualCables.find(c => c.id === nodeId)
    if (cable && cable.type === 'loopback') {
      if (type === 'output') {
        const isAppSource = cable.active && cable.appSourceId
        const { physicalId, isDefaultMic } = resolvePhysicalInputId(nodeId)
        const sourceKey = isAppSource ? `app-${nodeId}` : (isDefaultMic ? 'mic' : (physicalId || nodeId))
        const devGain = manager.getDeviceGain(sourceKey)
        const source = activeSourcesRef.current.get(sourceKey)
        if (source) manager.connectSourceToDeviceGain(sourceKey, source)
        return devGain
      } else {
        const outId = resolvePhysicalOutputId(nodeId)
        if (outId) {
          const devGain = manager.getDeviceGain(outId)
          const output = manager.createOutput(outId)
          devGain.connect(output.destNode)
          return devGain
        }
      }
    }

    if (type === 'output') {
      const { physicalId, isDefaultMic } = resolvePhysicalInputId(nodeId)
      const sourceKey = isDefaultMic ? 'mic' : (physicalId || nodeId)
      const devGain = manager.getDeviceGain(sourceKey)
      const source = activeSourcesRef.current.get(sourceKey)
      if (source) manager.connectSourceToDeviceGain(sourceKey, source)
      return devGain
    } else {
      const outId = resolvePhysicalOutputId(nodeId)
      if (outId) {
        const devGain = manager.getDeviceGain(outId)
        const output = manager.createOutput(outId)
        devGain.connect(output.destNode)
        return devGain
      }
    }
    return null
  }, [virtualCables, resolvePhysicalInputId, resolvePhysicalOutputId])

  const enumerateDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const micStatus = await window.api?.permissions.getMicrophoneStatus()
      const devs = await navigator.mediaDevices.enumerateDevices()
      setDevices(devs.map(d => ({ deviceId: d.deviceId, label: d.label || (d.kind === 'audioinput' ? 'Input Device' : 'Output Device'), kind: d.kind, groupId: d.groupId })))
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
      if (result === 'granted') { setPermissionStatus('granted'); await enumerateDevices() }
      else setPermissionStatus('denied')
    } catch { setPermissionStatus('denied') }
  }, [enumerateDevices])

  const checkDriverStatus = useCallback(async () => {
    if (!window.api?.drivers) return
    try { setDriverStatus(await window.api.drivers.checkStatus()) } catch (err) { console.error('Failed to check driver status:', err) }
  }, [])

  const installDriver = useCallback(async () => {
    if (!window.api?.drivers) return
    setInstallingDriver(true); setDriverLogs([])
    const unsubscribe = window.api.drivers.onInstallProgress((data) => setDriverLogs((prev) => [...prev, data.log]))
    try {
      const result = await window.api.drivers.install()
      if (result.success) { setDriverLogs((prev) => [...prev, '\n✓ Virtual Audio Driver installed successfully!\nRefreshing device list...']); await enumerateDevices(); await checkDriverStatus() }
      else setDriverLogs((prev) => [...prev, `\n✕ Installation failed: ${result.error}`])
    } catch (err) { setDriverLogs((prev) => [...prev, `\n✕ Error during installation: ${err instanceof Error ? err.message : String(err)}`]) }
    finally { unsubscribe(); setInstallingDriver(false) }
  }, [enumerateDevices, checkDriverStatus])

  const clearDriverLogs = useCallback(() => setDriverLogs([]), [])

  const virtualDevices = useMemo(() => {
    const list: VirtualDevice[] = []
    const systemPairs = getSystemVirtualDevicePairs(devices)
    devices.filter(d => d.kind === 'audioinput' && !isVirtualDeviceLabel(d.label)).forEach(d => list.push({ id: d.deviceId, name: d.label, type: 'input', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: deviceVolumes[d.deviceId] ?? 80, destinations: ['Stream Output'], linkedDeviceId: d.deviceId }))
    devices.filter(d => d.kind === 'audiooutput' && !isVirtualDeviceLabel(d.label)).forEach((d, i) => list.push({ id: d.deviceId, name: d.label, type: 'output', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: deviceVolumes[d.deviceId] ?? 100, destinations: i === 0 ? ['Speakers'] : ['Monitor'], linkedDeviceId: d.deviceId }))
    virtualCables.forEach((c, index) => {
      let mappedName = c.name, isPhysical = false, physicalName = ''
      if (index < systemPairs.length) { isPhysical = true; physicalName = systemPairs[index].name; mappedName = `${systemPairs[index].name} (${c.name})` }
      list.push({ ...c, name: mappedName, isPhysical, physicalName })
    })
    return list
  }, [devices, virtualCables, deviceVolumes])

  const rebuildAudioRouting = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    try {
      const ctx = initAudioGraph()
      const manager = graphManagerRef.current!
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})

      const neededInputs = new Set<string>()
      connections.forEach((conn) => {
        const cable = virtualCables.find(c => c.id === conn.fromNodeId)
        if (cable?.active && cable.appSourceId) neededInputs.add(`app-${cable.id}`)
        else {
          const { physicalId, isDefaultMic } = resolvePhysicalInputId(conn.fromNodeId)
          if (isDefaultMic && permissionStatus === 'granted') neededInputs.add('mic')
          else if (physicalId) neededInputs.add(physicalId)
        }
      })

      for (const key of neededInputs) {
        let stream = activeStreamsRef.current.get(key)
        if (!stream || stream.getTracks().some(t => t.readyState !== 'live')) {
          try {
            if (key === 'mic') stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            else if (key.startsWith('app-')) {
              const cable = virtualCables.find((c) => `app-${c.id}` === key)
              if (cable?.appSourceId) {
                await window.api.apps.setCaptureSource(cable.appSourceId)
                stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
                stream.getVideoTracks().forEach((t) => t.stop())
              }
            } else stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: key } })
            if (stream) activeStreamsRef.current.set(key, stream)
          } catch (err) {
            const errorMsg = `Failed to capture audio for ${key}: ${err instanceof Error ? err.message : String(err)}`
            console.error(errorMsg)
            addAudioError(errorMsg)
            continue
          }
        }
        if (stream && !activeSourcesRef.current.has(key)) {
          try {
            activeSourcesRef.current.set(key, ctx.createMediaStreamSource(stream))
          } catch (err) {
            console.error(`Failed to create source for ${key}:`, err)
            addAudioError(`Failed to initialize audio source for ${key}`)
          }
        }
      }

      manager.disconnectAllDynamicConnections()
      connections.forEach((conn) => {
        try {
          const sourceNode = resolveAudioNode(conn.fromNodeId, conn.fromPortId, 'output')
          const targetNode = resolveAudioNode(conn.toNodeId, conn.toPortId, 'input')
          if (sourceNode && targetNode) {
            sourceNode.connect(targetNode)
          } else {
            console.warn(`Could not resolve nodes for connection ${conn.id}: ${conn.fromNodeId} -> ${conn.toNodeId}`)
          }
        } catch (err) {
          console.error(`Error establishing connection ${conn.id}:`, err)
          addAudioError(`Connection error: ${conn.fromNodeId} to ${conn.toNodeId}`)
        }
      })
    } catch (err) { console.error('Rebuild failed:', err) }
  }, [connections, permissionStatus, devices, virtualCables, resolvePhysicalInputId, resolvePhysicalOutputId, initAudioGraph, resolveAudioNode, addAudioError])

  const safeRebuild = useCallback(async () => {
    if (rebuildingRef.current) { pendingRebuildRef.current = true; return }
    rebuildingRef.current = true; pendingRebuildRef.current = false
    try { await rebuildAudioRouting() } finally { rebuildingRef.current = false; if (pendingRebuildRef.current) setTimeout(() => safeRebuild(), 50) }
  }, [rebuildAudioRouting])

  useEffect(() => { safeRebuild() }, [connections, permissionStatus, devices, virtualCables, safeRebuild])

  useEffect(() => { graphManagerRef.current?.updateMasterVolume(masterVolume, masterMuted) }, [masterVolume, masterMuted])

  useEffect(() => {
    const manager = graphManagerRef.current
    if (!manager) return
    const hasSolo = mixerChannels.some(ch => ch.solo)
    mixerChannels.forEach(ch => manager.updateMixerChannel(ch.id, ch.volume, ch.muted, ch.pan, hasSolo, ch.solo))
  }, [mixerChannels])

  useEffect(() => {
    let active = true
    const dataArray = new Uint8Array(128)
    const updateAllMeters = () => {
      if (!active) return
      const manager = graphManagerRef.current
      if (manager && manager.getContext().state === 'running') {
        const nextLevels: Record<string, number> = {}
        manager.getMixerAnalysers().forEach((analyser, chId) => {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          nextLevels[chId] = Math.min(100, (sum / dataArray.length / 128) * 100)
        })
        setChannelLevels(nextLevels); setMicLevel(nextLevels.mic ?? 0)
        const mAnalyser = manager.getMasterAnalyser()
        if (mAnalyser) {
          mAnalyser.getByteFrequencyData(dataArray)
          let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          setMasterLevel(Math.min(100, (sum / dataArray.length / 128) * 100))
        }
      }
      requestAnimationFrame(updateAllMeters)
    }
    requestAnimationFrame(updateAllMeters)
    return () => { active = false }
  }, [])

  useEffect(() => {
    enumerateDevices().then(() => {
      const handleDeviceChange = () => enumerateDevices()
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
      return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    })
  }, [enumerateDevices])

  useEffect(() => { if (devices.length > 0) checkDriverStatus() }, [devices, checkDriverStatus])

  const addConnection = useCallback((fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => setConnectionsState((prev) => [...prev, { id: `c-${Date.now()}`, fromNodeId, fromPortId, toNodeId, toPortId }]), [])
  const removeConnection = useCallback((id: string) => setConnectionsState((prev) => prev.filter((c) => c.id !== id)), [])
  const toggleVirtualDevice = useCallback((id: string) => setVirtualCables((prev) => prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d))), [])
  const addVirtualCable = useCallback(() => setVirtualCables((prev) => [...prev, { id: `vloop-${Date.now()}`, name: `Virtual Cable ${prev.length + 1}`, type: 'loopback', active: true, sampleRate: 48000, channels: '2-ch Stereo', volume: 100, destinations: ['Stream Output'] }]), [])
  const removeVirtualDevice = useCallback((id: string) => { if (!['vloop-desktop', 'vloop-browser', 'vloop-game', 'vloop-music', 'vloop-discord'].includes(id)) setVirtualCables((prev) => prev.filter((d) => d.id !== id)) }, [])
  const setVirtualDeviceVolume = useCallback((id: string, volume: number) => { setVirtualCables((prev) => prev.map((d) => (d.id === id ? { ...d, volume } : d))); setDeviceVolumes((prev) => ({ ...prev, [id]: volume })) }, [])
  const setVirtualDeviceAppSource = useCallback((id: string, appSourceId: string | undefined, appSourceName: string | undefined) => setVirtualCables((prev) => prev.map((d) => (d.id === id ? { ...d, appSourceId, appSourceName } : d))), [])
  const getAppSources = useCallback(async () => window.api?.apps?.getSources ? window.api.apps.getSources() : [], [])
  const updateMixerChannel = useCallback((id: string, fields: Partial<MixerChannel>) => setMixerChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...fields } : ch))), [])

  return (
    <AudioEngineContext.Provider
      value={{
        devices, virtualDevices, connections, mixerChannels, masterVolume, masterMuted, driverStatus, driverLogs, installingDriver, loadingDevices, permissionStatus, channelLevels, masterLevel, audioErrors, enumerateDevices, requestMicrophonePermission, addConnection, removeConnection, setConnections: setConnectionsState, toggleVirtualDevice, addVirtualCable, removeVirtualDevice, setVirtualDeviceVolume, setVirtualDeviceAppSource, getAppSources, updateMixerChannel, setMasterVolume, setMasterMuted, checkDriverStatus, installDriver, clearDriverLogs, getAudioContext, getChannelInputNode, hardwareMicId, hardwareSpeakerId, hardwareMonitorId, setHardwareMicId, setHardwareSpeakerId, setHardwareMonitorId
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
