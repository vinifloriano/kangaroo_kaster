import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  MicOff,
  Monitor,
  Globe,
  Music,
  MessageSquare,
  Gamepad2,
  Volume2,
  VolumeX,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react'
import { useAudioEngine, MixerChannel, VirtualDevice } from '../services/AudioEngine'

/* ────────────────────────────────────────────
   Channel Metadata (Icons & Colors)
   ──────────────────────────────────────────── */
const channelMeta: Record<string, { icon: typeof Mic; color: string }> = {
  mic: { icon: Mic, color: '#a855f7' },
  desktop: { icon: Monitor, color: '#6366f1' },
  browser: { icon: Globe, color: '#22d3ee' },
  music: { icon: Music, color: '#ec4899' },
  discord: { icon: MessageSquare, color: '#34d399' },
  game: { icon: Gamepad2, color: '#f97316' }
}

/* ────────────────────────────────────────────
   Meter Bar Component
   ──────────────────────────────────────────── */
function MeterBar({ level, color, muted }: { level: number; color: string; muted: boolean }) {
  const [displayLevel, setDisplayLevel] = useState(level)
  const rafRef = useRef<number>()

  useEffect(() => {
    const animate = () => {
      setDisplayLevel((prev) => {
        if (muted) return Math.max(0, prev - 3)
        const target = level
        return prev + (target - prev) * 0.35
      })
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [level, muted])

  const segments = 20
  const activeSegments = Math.round((displayLevel / 100) * segments)

  return (
    <div className="flex flex-col-reverse gap-[2px] w-3">
      {Array.from({ length: segments }).map((_, i) => {
        const isActive = i < activeSegments
        const ratio = i / segments
        let segColor = color
        if (ratio > 0.85) segColor = '#ef4444'
        else if (ratio > 0.65) segColor = '#facc15'

        return (
          <div
            key={i}
            className="h-[5px] rounded-[1px] transition-all duration-75"
            style={{
              background: isActive ? segColor : 'rgba(255,255,255,0.04)',
              boxShadow: isActive ? `0 0 4px ${segColor}40` : 'none'
            }}
          />
        )
      })}
    </div>
  )
}

/* ────────────────────────────────────────────
   Channel Strip Component
   ──────────────────────────────────────────── */
function ChannelStrip({
  channel,
  liveLevel,
  inputSourceLabel,
  onChange,
  virtualDevice,
  appSources,
  onSetAppSource
}: {
  channel: MixerChannel
  liveLevel?: number
  inputSourceLabel: string
  onChange: (id: string, fields: Partial<MixerChannel>) => void
  virtualDevice?: VirtualDevice
  appSources?: { id: string; name: string }[]
  onSetAppSource?: (appSourceId: string | undefined, appSourceName: string | undefined) => void
}) {
  const meta = channelMeta[channel.id] || { icon: Mic, color: '#6366f1' }
  const Icon = meta.icon
  const color = meta.color

  const meterLevel = channel.isLive ? (liveLevel ?? 0) : 0

  return (
    <div className="glass-sm p-4 flex flex-col items-center gap-3 min-w-[120px] max-w-[140px] group hover:border-white/10 transition-colors">
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: `${color}15` }}
      >
        <Icon size={18} style={{ color: color }} />
      </div>

      {/* Name */}
      <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider text-center">
        {channel.name}
      </span>

      {/* Input Routing label / selector dropdown */}
      {virtualDevice && virtualDevice.type === 'loopback' && appSources && onSetAppSource ? (
        <div className="w-full px-1">
          <select
            value={virtualDevice.appSourceId || ''}
            onChange={(e) => {
              const val = e.target.value
              if (!val) {
                onSetAppSource(undefined, undefined)
              } else {
                const matched = appSources.find((s) => s.id === val)
                onSetAppSource(val, matched ? matched.name : 'Application')
              }
            }}
            className="w-full px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.06] text-[9px] text-white/50 outline-none hover:text-white/80 transition-colors cursor-pointer truncate"
            title="Choose application audio source"
          >
            <option value="" className="bg-slate-900 text-white/40">
              System Audio
            </option>
            {appSources
              .filter((s) => s.name.trim() !== '')
              .map((source) => (
                <option
                  key={source.id}
                  value={source.id}
                  className="bg-slate-900 text-white"
                >
                  {source.name}
                </option>
              ))}
          </select>
        </div>
      ) : (
        <span className="text-[9px] text-white/30 bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded truncate max-w-[100px]" title={inputSourceLabel}>
          In: {inputSourceLabel}
        </span>
      )}

      {/* Live indicator */}
      {channel.isLive && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
          Live
        </span>
      )}

      {/* Meter + Fader */}
      <div className="flex items-center gap-3">
        <MeterBar level={meterLevel} color={color} muted={channel.muted} />

        <div className="flex flex-col items-center">
          <input
            type="range"
            className="vertical"
            min={0}
            max={100}
            value={channel.volume}
            onChange={(e) => onChange(channel.id, { volume: Number(e.target.value) })}
            style={{ accentColor: color }}
            aria-label={`${channel.name} volume`}
          />
        </div>

        <MeterBar level={meterLevel} color={color} muted={channel.muted} />
      </div>

      {/* Volume label */}
      <span className="text-xs font-mono text-white/50" style={{ color: color }}>
        {channel.muted ? '—' : `${channel.volume}%`}
      </span>

      {/* Pan */}
      <div className="w-full">
        <input
          type="range"
          min={-100}
          max={100}
          value={channel.pan}
          onChange={(e) => onChange(channel.id, { pan: Number(e.target.value) })}
          className="w-full h-1"
          aria-label={`${channel.name} pan`}
        />
        <p className="text-[9px] text-center text-white/20 mt-0.5">
          {channel.pan === 0 ? 'C' : channel.pan < 0 ? `L${Math.abs(channel.pan)}` : `R${channel.pan}`}
        </p>
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-1.5 w-full">
        <button
          onClick={() => onChange(channel.id, { muted: !channel.muted })}
          className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
            channel.muted
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/50'
          }`}
        >
          {channel.muted ? <VolumeX size={12} className="mx-auto" /> : 'M'}
        </button>
        <button
          onClick={() => onChange(channel.id, { solo: !channel.solo })}
          className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
            channel.solo
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/50'
          }`}
        >
          S
        </button>
      </div>
    </div>
  )
}

const PORT_MAP: Record<string, string> = {
  mic: 'mixer-in1',
  desktop: 'mixer-in2',
  browser: 'mixer-in3',
  game: 'mixer-in4',
  music: 'mixer-in5',
  discord: 'mixer-in6'
}

export default function MixerPage() {
  const {
    mixerChannels,
    updateMixerChannel,
    masterVolume,
    setMasterVolume,
    masterMuted,
    setMasterMuted,
    permissionStatus,
    connections,
    virtualDevices,
    channelLevels,
    masterLevel,
    setVirtualDeviceAppSource,
    getAppSources
  } = useAudioEngine()

  const [appSources, setAppSources] = useState<{ id: string; name: string }[]>([])

  const refreshAppSources = useCallback(async () => {
    try {
      const sources = await getAppSources()
      setAppSources(sources)
    } catch (err) {
      console.error('Failed to load app sources:', err)
    }
  }, [getAppSources])

  useEffect(() => {
    refreshAppSources()
    const interval = setInterval(refreshAppSources, 5000)
    return () => clearInterval(interval)
  }, [refreshAppSources])

  const getChannelInputSourceLabel = (channelId: string) => {
    const portId = PORT_MAP[channelId]
    if (!portId) return 'N/A'

    const conn = connections.find((c) => c.toNodeId === 'mixer' && c.toPortId === portId)
    if (!conn) {
      if (channelId === 'music') return 'Soundboard Input'
      return 'Disconnected'
    }

    if (conn.fromNodeId === 'mic') {
      return 'Microphone (Default)'
    }

    const dev = virtualDevices.find((d) => d.id === conn.fromNodeId)
    if (dev) {
      if (dev.appSourceName) {
        return `${dev.appSourceName} (App Capture)`
      }
      return dev.name.replace(/\(Simulated.*\)/gi, '').trim()
    }

    return 'Virtual Cable'
  }

  const getChannelVirtualDevice = (channelId: string): VirtualDevice | undefined => {
    const portId = PORT_MAP[channelId]
    if (!portId) return undefined
    const conn = connections.find((c) => c.toNodeId === 'mixer' && c.toPortId === portId)
    if (!conn) return undefined
    return virtualDevices.find((d) => d.id === conn.fromNodeId)
  }

  const getMasterOutputDestinationsLabel = () => {
    const dests = connections
      .filter((c) => c.fromNodeId === 'mixer' && (c.fromPortId === 'mixer-out' || c.fromPortId === 'mixer-mon'))
      .map((c) => {
        if (c.toNodeId === 'headphones') return 'Headphones'
        if (c.toNodeId === 'speakers') return 'Speakers'
        
        const dev = virtualDevices.find((d) => d.id === c.toNodeId)
        if (dev) {
          return dev.name.replace(/\(Simulated.*\)/gi, '').trim()
        }
        return 'Audio Device'
      })

    const uniqueDests = Array.from(new Set(dests))
    if (uniqueDests.length === 0) return 'No Output Routed'
    return uniqueDests.join(' + ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
            Audio Mixer
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Channel <span className="gradient-text">Mixer</span>
          </h1>
          <p className="text-sm text-white/30 mt-1">
            {mixerChannels.length} channels • Audio Engine Active
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-sm px-3 py-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-[11px] font-mono text-white/40">48kHz / 32-bit</span>
          </div>
        </div>
      </div>

      {/* Permission Banner */}
      {permissionStatus === 'denied' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Microphone Access Denied</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              Go to System Settings → Privacy & Security → Microphone, and enable access for
              Kangaroo Kaster.
            </p>
          </div>
        </div>
      )}

      {/* Channel Strips */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {mixerChannels.map((ch) => {
          const vDev = getChannelVirtualDevice(ch.id)
          return (
            <ChannelStrip
              key={ch.id}
              channel={ch}
              liveLevel={channelLevels[ch.id] ?? 0}
              inputSourceLabel={getChannelInputSourceLabel(ch.id)}
              onChange={updateMixerChannel}
              virtualDevice={vDev}
              appSources={appSources}
              onSetAppSource={(appSourceId, appSourceName) => {
                if (vDev) {
                  setVirtualDeviceAppSource(vDev.id, appSourceId, appSourceName)
                }
              }}
            />
          )
        })}

        {/* Master Channel */}
        <div className="glass p-4 flex flex-col items-center gap-3 min-w-[140px] border-brand-500/20">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-500/15">
            <Volume2 size={18} className="text-brand-400" />
          </div>
          <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">
            Master
          </span>
          <span className="text-[9px] text-brand-400/60 bg-brand-500/5 border border-brand-500/10 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={getMasterOutputDestinationsLabel()}>
            Out: {getMasterOutputDestinationsLabel()}
          </span>

          <div className="flex items-center gap-3">
            <MeterBar level={masterLevel} color="#6366f1" muted={masterMuted} />
            <input
              type="range"
              className="vertical"
              min={0}
              max={100}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              aria-label="Master volume"
            />
            <MeterBar level={masterLevel} color="#6366f1" muted={masterMuted} />
          </div>

          <span className="text-sm font-mono font-bold text-brand-400">
            {masterMuted ? '—' : `${masterVolume}%`}
          </span>

          <button
            onClick={() => setMasterMuted(!masterMuted)}
            className={`w-full py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
              masterMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-white/[0.03] text-white/25 border border-white/[0.06] hover:text-white/50'
            }`}
          >
            {masterMuted ? 'UNMUTE' : 'MUTE'}
          </button>
        </div>
      </div>

      {/* DSP Section */}
      <div>
        <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wider">
          DSP Chain
        </h2>
        <div className="flex gap-2 flex-wrap">
          {['Noise Gate', 'Compressor', 'EQ (10-band)', 'De-Esser', 'Limiter', 'VST3 Host'].map(
            (fx) => (
              <button
                key={fx}
                className="glass-sm px-4 py-2 text-xs font-medium text-white/40 hover:text-white/70 hover:border-brand-500/20 transition-all"
              >
                {fx}
              </button>
            )
          )}
        </div>
      </div>

      {/* Output Info */}
      <div className="glass p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-white/30 uppercase">Output Node</span>
            <span className="text-xs font-mono text-white/50">{getMasterOutputDestinationsLabel()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>CoreAudio Pipeline Active</span>
        </div>
      </div>
    </div>
  )
}
