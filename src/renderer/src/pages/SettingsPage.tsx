import { useState } from 'react'
import {
  Settings,
  Monitor,
  Headphones,
  Mic,
  Info,
  Moon,
  Sun,
  Volume2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react'
import { useAudioEngine } from '../services/AudioEngine'

export default function SettingsPage() {
  const {
    devices,
    permissionStatus,
    enumerateDevices: triggerEnumerate,
    requestMicrophonePermission,
    hardwareMicId,
    hardwareSpeakerId,
    hardwareMonitorId,
    setHardwareMicId,
    setHardwareSpeakerId,
    setHardwareMonitorId
  } = useAudioEngine()

  const [sampleRate, setSampleRate] = useState('48000')
  const [bufferSize, setBufferSize] = useState('128')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [loading, setLoading] = useState(false)

  const inputDevices = devices.filter((d) => d.kind === 'audioinput')
  const outputDevices = devices.filter((d) => d.kind === 'audiooutput')

  const handleRefresh = async () => {
    setLoading(true)
    await triggerEnumerate()
    setLoading(false)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
          Configuration
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">Settings</span>
        </h1>
        <p className="text-sm text-white/30 mt-1">
          Configure audio devices, performance, and appearance
        </p>
      </div>

      {/* Permission Banner */}
      {permissionStatus === 'unknown' && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Microphone Permission Needed</p>
              <p className="text-xs text-amber-400/60 mt-0.5">
                Grant access to detect all audio devices and enable live mixing.
              </p>
            </div>
          </div>
          <button
            onClick={requestMicrophonePermission}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 transition-all"
          >
            Grant Access
          </button>
        </div>
      )}

      {permissionStatus === 'granted' && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-white/40">
            Microphone access granted — {inputDevices.length} inputs and {outputDevices.length} outputs detected.
          </p>
        </div>
      )}

      {permissionStatus === 'denied' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Microphone Access Denied</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              Go to System Settings → Privacy & Security → Microphone to enable access.
            </p>
          </div>
        </div>
      )}

      {/* Audio Devices */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Volume2 size={16} className="text-brand-400" />
            Audio Devices
          </h2>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="glass-sm p-5 space-y-5">
          {/* Input */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              <Mic size={14} /> Hardware Microphone (Input)
            </label>
            <select
              value={hardwareMicId}
              onChange={(e) => setHardwareMicId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none focus:border-brand-500/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="default" className="bg-surface-800 text-white">System Default Microphone</option>
              {inputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-surface-800 text-white">
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Output */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              <Monitor size={14} /> Main Output Device (Speakers)
            </label>
            <select
              value={hardwareSpeakerId}
              onChange={(e) => setHardwareSpeakerId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none focus:border-brand-500/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="default" className="bg-surface-800 text-white">System Default Output</option>
              {outputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-surface-800 text-white">
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Monitor */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              <Headphones size={14} /> Monitor Output Device (Headphones)
            </label>
            <select
              value={hardwareMonitorId}
              onChange={(e) => setHardwareMonitorId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none focus:border-brand-500/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="default" className="bg-surface-800 text-white">System Default Output</option>
              {outputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-surface-800 text-white">
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Performance */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <Settings size={16} className="text-brand-400" />
          Performance
        </h2>

        <div className="glass-sm p-5 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">
                Sample Rate
              </label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none focus:border-brand-500/30 transition-colors appearance-none cursor-pointer"
              >
                <option value="44100" className="bg-surface-800 text-white">44.1 kHz</option>
                <option value="48000" className="bg-surface-800 text-white">48 kHz</option>
                <option value="96000" className="bg-surface-800 text-white">96 kHz</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">
                Buffer Size
              </label>
              <select
                value={bufferSize}
                onChange={(e) => setBufferSize(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none focus:border-brand-500/30 transition-colors appearance-none cursor-pointer"
              >
                <option value="64" className="bg-surface-800 text-white">64 samples (~1.3ms)</option>
                <option value="128" className="bg-surface-800 text-white">128 samples (~2.7ms)</option>
                <option value="256" className="bg-surface-800 text-white">256 samples (~5.3ms)</option>
                <option value="512" className="bg-surface-800 text-white">512 samples (~10.7ms)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <Moon size={16} className="text-brand-400" />
          Appearance
        </h2>

        <div className="glass-sm p-5">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 block">
            Theme
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                theme === 'dark'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/60'
              }`}
            >
              <Moon size={16} /> Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                theme === 'light'
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/60'
              }`}
            >
              <Sun size={16} /> Light
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <Info size={16} className="text-brand-400" />
          About
        </h2>

        <div className="glass-sm p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center text-lg font-black text-white">
              K
            </div>
            <div>
              <h3 className="text-sm font-bold">Kangaroo Kaster</h3>
              <p className="text-xs text-white/30 font-mono">Version 1.0.0 • Electron 33 • macOS</p>
              <p className="text-xs text-white/20 mt-1">
                The most powerful caster app ever built.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

