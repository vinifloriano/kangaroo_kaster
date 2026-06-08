import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Volume2, Star } from 'lucide-react'
import { useAudioEngine } from '../services/AudioEngine'

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */
interface SoundPad {
  id: string
  name: string
  icon: string
  color: string
  category: string
  playing: boolean
  // Synthesis parameters
  synth: SynthConfig
}

interface SynthConfig {
  type: 'tone' | 'noise' | 'sweep' | 'multi' | 'fm'
  frequency?: number
  endFrequency?: number
  duration: number
  waveform?: OscillatorType
  attack?: number
  decay?: number
  noiseType?: 'white' | 'pink'
}

/* ────────────────────────────────────────────
   Sound Library
   ──────────────────────────────────────────── */
const categories = [
  'All', 'Favorites', 'Animals', 'Cartoons', 'Comedy', 'Daily Life',
  'Electronic', 'Foley', 'Horror', 'Musical', 'Sci-Fi', 'Sports',
  'Transitions', 'Vocals'
]

const defaultPads: SoundPad[] = [
  { id: '1', name: 'Applause', icon: '👏', color: '#7c3aed', category: 'Comedy', playing: false,
    synth: { type: 'noise', duration: 1.5, noiseType: 'pink', attack: 0.1, decay: 0.8 } },
  { id: '2', name: 'Air Horn', icon: '📯', color: '#0891b2', category: 'Sports', playing: false,
    synth: { type: 'multi', frequency: 440, duration: 0.8, waveform: 'sawtooth', attack: 0.01, decay: 0.3 } },
  { id: '3', name: 'Drum Roll', icon: '🥁', color: '#be185d', category: 'Musical', playing: false,
    synth: { type: 'noise', duration: 1.2, noiseType: 'white', attack: 0.05, decay: 0.6 } },
  { id: '4', name: 'Sad Trombone', icon: '🎺', color: '#c2410c', category: 'Comedy', playing: false,
    synth: { type: 'sweep', frequency: 440, endFrequency: 220, duration: 1.5, waveform: 'sawtooth', attack: 0.05, decay: 0.4 } },
  { id: '5', name: 'Victory', icon: '🏆', color: '#15803d', category: 'Sports', playing: false,
    synth: { type: 'multi', frequency: 523, duration: 1.0, waveform: 'square', attack: 0.02, decay: 0.3 } },
  { id: '6', name: 'Whoosh', icon: '💨', color: '#1d4ed8', category: 'Transitions', playing: false,
    synth: { type: 'sweep', frequency: 200, endFrequency: 2000, duration: 0.4, waveform: 'sine', attack: 0.01, decay: 0.2 } },
  { id: '7', name: 'Boing', icon: '🦘', color: '#be185d', category: 'Cartoons', playing: false,
    synth: { type: 'sweep', frequency: 150, endFrequency: 800, duration: 0.3, waveform: 'sine', attack: 0.01, decay: 0.15 } },
  { id: '8', name: 'Laugh Track', icon: '😂', color: '#a16207', category: 'Comedy', playing: false,
    synth: { type: 'noise', duration: 2.0, noiseType: 'pink', attack: 0.15, decay: 1.0 } },
  { id: '9', name: 'Laser Blast', icon: '🔫', color: '#6d28d9', category: 'Sci-Fi', playing: false,
    synth: { type: 'sweep', frequency: 3000, endFrequency: 100, duration: 0.25, waveform: 'sawtooth', attack: 0.001, decay: 0.1 } },
  { id: '10', name: 'Crickets', icon: '🦗', color: '#065f46', category: 'Animals', playing: false,
    synth: { type: 'fm', frequency: 4500, duration: 2.0, waveform: 'sine', attack: 0.05, decay: 0.8 } },
  { id: '11', name: 'Rimshot', icon: '🪘', color: '#9f1239', category: 'Musical', playing: false,
    synth: { type: 'noise', duration: 0.15, noiseType: 'white', attack: 0.001, decay: 0.08 } },
  { id: '12', name: 'Gong', icon: '🔔', color: '#b45309', category: 'Musical', playing: false,
    synth: { type: 'tone', frequency: 110, duration: 3.0, waveform: 'sine', attack: 0.01, decay: 2.5 } },
  { id: '13', name: 'Record Scratch', icon: '💿', color: '#047857', category: 'Transitions', playing: false,
    synth: { type: 'sweep', frequency: 800, endFrequency: 100, duration: 0.2, waveform: 'sawtooth', attack: 0.001, decay: 0.1 } },
  { id: '14', name: 'Police Siren', icon: '🚨', color: '#1e40af', category: 'Daily Life', playing: false,
    synth: { type: 'sweep', frequency: 600, endFrequency: 1200, duration: 1.0, waveform: 'sine', attack: 0.05, decay: 0.3 } },
  { id: '15', name: 'Explosion', icon: '💥', color: '#b91c1c', category: 'Foley', playing: false,
    synth: { type: 'noise', duration: 1.0, noiseType: 'white', attack: 0.001, decay: 0.8 } },
  { id: '16', name: 'Cash Register', icon: '💰', color: '#166534', category: 'Daily Life', playing: false,
    synth: { type: 'multi', frequency: 2000, duration: 0.3, waveform: 'square', attack: 0.001, decay: 0.1 } }
]

/* ────────────────────────────────────────────
   Audio Synthesizer Hook
   ──────────────────────────────────────────── */
function useSoundEngine() {
  const { getAudioContext, getChannelInputNode } = useAudioEngine()
  const soundboardMasterGainRef = useRef<GainNode | null>(null)

  const getGainNode = useCallback(() => {
    const ctx = getAudioContext()
    if (!ctx) return null

    if (!soundboardMasterGainRef.current) {
      const masterGain = ctx.createGain()
      masterGain.gain.value = 0.8 // default soundboard master volume
      
      const musicNode = getChannelInputNode('music')
      if (musicNode) {
        masterGain.connect(musicNode)
      } else {
        // Fallback to default destination if mixer music node is not found
        masterGain.connect(ctx.destination)
      }
      soundboardMasterGainRef.current = masterGain
    }
    return soundboardMasterGainRef.current
  }, [getAudioContext, getChannelInputNode])

  const setMasterVolume = useCallback((value: number) => {
    const gainNode = getGainNode()
    if (gainNode) {
      gainNode.gain.value = value / 100
    }
  }, [getGainNode])

  const playSound = useCallback((synth: SynthConfig) => {
    const ctx = getAudioContext()
    const masterGain = getGainNode()
    if (!ctx || !masterGain) return

    // Ensure audio context is running
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime
    const attack = synth.attack ?? 0.01

    if (synth.type === 'noise') {
      // Generate noise buffer
      const bufferSize = ctx.sampleRate * synth.duration
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      if (synth.noiseType === 'pink') {
        // Pink noise approximation
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1
          b0 = 0.99886 * b0 + white * 0.0555179
          b1 = 0.99332 * b1 + white * 0.0750759
          b2 = 0.96900 * b2 + white * 0.1538520
          b3 = 0.86650 * b3 + white * 0.3104856
          b4 = 0.55000 * b4 + white * 0.5329522
          b5 = -0.7616 * b5 - white * 0.0168980
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
          b6 = white * 0.115926
        }
      } else {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1
        }
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.5, now + attack)
      gain.gain.linearRampToValueAtTime(0, now + synth.duration)
      source.connect(gain)
      gain.connect(masterGain)
      source.start(now)
      source.stop(now + synth.duration)
    } else if (synth.type === 'tone') {
      const osc = ctx.createOscillator()
      osc.type = synth.waveform ?? 'sine'
      osc.frequency.setValueAtTime(synth.frequency ?? 440, now)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.3, now + attack)
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.duration)
      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now)
      osc.stop(now + synth.duration)
    } else if (synth.type === 'sweep') {
      const osc = ctx.createOscillator()
      osc.type = synth.waveform ?? 'sine'
      osc.frequency.setValueAtTime(synth.frequency ?? 440, now)
      osc.frequency.exponentialRampToValueAtTime(
        synth.endFrequency ?? 220,
        now + synth.duration
      )
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.35, now + attack)
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.duration)
      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now)
      osc.stop(now + synth.duration)
    } else if (synth.type === 'multi') {
      // Multi-oscillator for richer sounds
      const freq = synth.frequency ?? 440
      const harmonics = [1, 1.5, 2, 2.5]
      harmonics.forEach((h) => {
        const osc = ctx.createOscillator()
        osc.type = synth.waveform ?? 'square'
        osc.frequency.setValueAtTime(freq * h, now)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.15 / h, now + attack)
        gain.gain.exponentialRampToValueAtTime(0.001, now + synth.duration)
        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(now)
        osc.stop(now + synth.duration)
      })
    } else if (synth.type === 'fm') {
      // FM synthesis for insect/electronic sounds
      const carrier = ctx.createOscillator()
      const modulator = ctx.createOscillator()
      const modGain = ctx.createGain()
      carrier.type = 'sine'
      modulator.type = 'sine'
      carrier.frequency.setValueAtTime(synth.frequency ?? 4500, now)
      modulator.frequency.setValueAtTime((synth.frequency ?? 4500) * 0.5, now)
      modGain.gain.setValueAtTime(200, now)
      // Add tremolo
      modulator.connect(modGain)
      modGain.connect(carrier.frequency)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.12, now + attack)
      gain.gain.setValueAtTime(0.12, now + synth.duration * 0.7)
      gain.gain.exponentialRampToValueAtTime(0.001, now + synth.duration)
      carrier.connect(gain)
      gain.connect(masterGain)
      carrier.start(now)
      modulator.start(now)
      carrier.stop(now + synth.duration)
      modulator.stop(now + synth.duration)
    }
  }, [getAudioContext, getGainNode])

  return { playSound, setMasterVolume }
}

/* ────────────────────────────────────────────
   Waveform Bars Component
   ──────────────────────────────────────────── */
function WaveformBars({ playing }: { playing: boolean }) {
  const [heights, setHeights] = useState<number[]>(Array(8).fill(3))
  const rafRef = useRef<number>()
  const frameCountRef = useRef(0)

  useEffect(() => {
    if (!playing) {
      setHeights(Array(8).fill(3))
      return
    }

    const animate = () => {
      frameCountRef.current++
      if (frameCountRef.current % 3 === 0) {
        setHeights(Array(8).fill(0).map(() => Math.floor(Math.random() * 16 + 3)))
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  return (
    <div className="flex items-end gap-[2px] h-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm transition-all duration-75"
          style={{
            height: `${h}px`,
            background: playing ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'
          }}
        />
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────
   Soundboard Page
   ──────────────────────────────────────────── */
export default function SoundboardPage() {
  const [pads, setPads] = useState<SoundPad[]>(defaultPads)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [masterVolume, setMasterVolumeState] = useState(80)
  const { playSound, setMasterVolume } = useSoundEngine()
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const triggerPad = useCallback(
    (pad: SoundPad) => {
      // Clear existing timeout
      const existing = timeoutsRef.current.get(pad.id)
      if (existing) clearTimeout(existing)

      // Play synthesized sound
      playSound(pad.synth)

      // Visual feedback
      setPads((prev) => prev.map((p) => (p.id === pad.id ? { ...p, playing: true } : p)))

      const timeout = setTimeout(() => {
        setPads((prev) => prev.map((p) => (p.id === pad.id ? { ...p, playing: false } : p)))
        timeoutsRef.current.delete(pad.id)
      }, pad.synth.duration * 1000)

      timeoutsRef.current.set(pad.id, timeout)
    },
    [playSound]
  )

  const handleMasterVolume = useCallback(
    (value: number) => {
      setMasterVolumeState(value)
      setMasterVolume(value)
    },
    [setMasterVolume]
  )

  const filteredPads = pads.filter((p) => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory
    const matchesSearch =
      searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="flex gap-6 h-full">
      {/* Category Sidebar */}
      <div className="w-[180px] shrink-0 flex flex-col gap-1">
        <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-2">
          Categories
        </p>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left ${
              activeCategory === cat
                ? 'bg-brand-500/10 text-brand-400 font-semibold'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'
            }`}
          >
            {cat === 'Favorites' && <Star size={14} />}
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
            Sound Effects
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Sound<span className="gradient-text">board</span>
          </h1>
          <p className="text-sm text-white/30 mt-1">
            {filteredPads.length} sounds • Click pads to play real audio • Synthesized via Web Audio API
          </p>
        </div>

        {/* Search + Volume */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sounds..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-brand-500/30 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 glass-sm px-3 py-2">
            <Volume2 size={14} className="text-white/30" />
            <input
              type="range"
              min={0}
              max={100}
              value={masterVolume}
              onChange={(e) => handleMasterVolume(Number(e.target.value))}
              className="w-24"
              aria-label="Soundboard master volume"
            />
            <span className="text-[11px] font-mono text-white/40 w-8">{masterVolume}%</span>
          </div>
        </div>

        {/* Pad Grid */}
        <div className="grid grid-cols-4 gap-3 overflow-y-auto">
          {filteredPads.map((pad) => (
            <button
              key={pad.id}
              onClick={() => triggerPad(pad)}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border border-white/[0.08] transition-all duration-150 overflow-hidden group ${
                pad.playing ? 'scale-95' : 'hover:scale-[1.03]'
              }`}
              style={{
                background: `linear-gradient(135deg, ${pad.color}dd, ${pad.color}88)`,
                boxShadow: pad.playing
                  ? `0 0 30px ${pad.color}50, inset 0 0 30px ${pad.color}30`
                  : `0 4px 20px ${pad.color}20`
              }}
            >
              <span className="text-2xl">{pad.icon}</span>
              <span className="text-xs font-bold text-white/90 drop-shadow-sm">{pad.name}</span>

              {/* Waveform at bottom */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                <WaveformBars playing={pad.playing} />
              </div>

              {/* Playing overlay */}
              {pad.playing && (
                <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
              )}
            </button>
          ))}
        </div>

        {/* Bottom Info */}
        <div className="glass p-3 flex items-center justify-between mt-auto shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-white/30">
              Output: System Default → Speakers
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-white/30">Engine: Web Audio API 48kHz</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="text-[11px] font-mono text-white/30">Mode: Overlap</span>
          </div>
        </div>
      </div>
    </div>
  )
}
