import { useState, useEffect, useCallback } from 'react'
import {
  HardDrive,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Volume2,
  Headphones,
  ArrowRight,
  Mic,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  Download,
  Share2
} from 'lucide-react'
import { useAudioEngine } from '../services/AudioEngine'
import type { Page } from '../App'

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */
const typeColors = {
  input: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  output: { bg: 'bg-brand-500/10', text: 'text-brand-400', border: 'border-brand-500/20' },
  loopback: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' }
}

const typeIcons = {
  input: Mic,
  output: Headphones,
  loopback: HardDrive
}

/* ────────────────────────────────────────────
   Virtual Devices Page
   ──────────────────────────────────────────── */
interface VirtualDevicesPageProps {
  onNavigate: (page: Page) => void
}

export default function VirtualDevicesPage({ onNavigate }: VirtualDevicesPageProps) {
  const {
    devices: systemDevices,
    virtualDevices,
    loadingDevices,
    permissionStatus,
    driverStatus,
    driverLogs,
    installingDriver,

    enumerateDevices,
    requestMicrophonePermission,
    toggleVirtualDevice,
    addVirtualCable,
    removeVirtualDevice,
    setVirtualDeviceVolume,
    setVirtualDeviceAppSource,
    getAppSources,
    installDriver
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
    // Poll every 5 seconds to keep window list updated
    const interval = setInterval(refreshAppSources, 5000)
    return () => clearInterval(interval)
  }, [refreshAppSources])

  const audioInputs = systemDevices.filter((d) => d.kind === 'audioinput')
  const audioOutputs = systemDevices.filter((d) => d.kind === 'audiooutput')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
            Audio Routing
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Virtual <span className="gradient-text">Devices</span>
          </h1>
          <p className="text-sm text-white/30 mt-1">
            {audioInputs.length} inputs • {audioOutputs.length} outputs •{' '}
            {virtualDevices.filter((d) => d.type === 'loopback').length} virtual cables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={enumerateDevices}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm hover:text-white/70 transition-all"
            title="Refresh devices"
          >
            <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={addVirtualCable}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 text-sm font-semibold hover:bg-brand-500/20 transition-all"
          >
            <Plus size={16} />
            Add Virtual Cable
          </button>
        </div>
      </div>

      {/* Driver Installation Card */}
      {!driverStatus.installed && (
        <div className="glass p-6 border border-amber-500/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <HardDrive size={120} className="text-amber-400" />
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Download size={22} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                {driverStatus.type === 'mac-inactive' ? 'Virtual Audio Driver: Installed but Inactive' : 'Virtual Audio Driver Status: Not Installed'}
              </h2>
              <p className="text-xs text-white/50 mt-1 max-w-2xl leading-relaxed">
                {driverStatus.type === 'mac-inactive'
                  ? 'BlackHole is installed via Homebrew, but macOS has not loaded the driver plug-in into CoreAudio yet. A system reboot or manual CoreAudio service reload is required to activate the loopback paths.'
                  : window.api.platform === 'win32'
                    ? 'To route virtual audio channels (like application sounds, music players, and mixer outputs) globally on Windows, you need the VB-Cable driver. Please download and install it manually from the official website.'
                    : 'To route virtual audio channels (like application sounds, music players, and mixer outputs) globally on your operating system, you need the virtual audio driver. Kangaroo Kaster can install this driver directly on macOS via Homebrew.'}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-3 mt-4">
                {driverStatus.type === 'mac-inactive' ? (
                  <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 max-w-xl space-y-3.5">
                    <div>
                      <p className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">1. Ensure Driver Files are Copied</p>
                      <p className="text-[11px] text-white/60 mt-0.5">
                        Homebrew metadata says BlackHole is installed, but the driver bundle is missing from the system HAL folder. Run this command in your terminal to force reinstall and write the driver files (enters sudo pkg installation):
                      </p>
                      <div className="flex items-center gap-2 bg-black/60 border border-white/5 px-3 py-2 rounded-lg font-mono text-xs text-brand-300 select-all cursor-pointer mt-1.5">
                        brew reinstall blackhole-2ch
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">2. Restart CoreAudio (SIP-Compatible)</p>
                      <p className="text-[11px] text-white/60 mt-0.5">
                        Since System Integrity Protection (SIP) is active on your Mac, run this command in your terminal instead of launchctl to restart CoreAudio and load the driver immediately:
                      </p>
                      <div className="flex items-center gap-2 bg-black/60 border border-white/5 px-3 py-2 rounded-lg font-mono text-xs text-brand-300 select-all cursor-pointer mt-1.5">
                        sudo killall coreaudiod
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {driverStatus.type === 'mac-brew' ? (
                      <button
                        onClick={installDriver}
                        disabled={installingDriver}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/25 disabled:opacity-50 transition-all"
                      >
                        <Terminal size={14} />
                        {installingDriver ? 'Installing BlackHole via Brew...' : 'Auto-Install Driver (brew)'}
                      </button>
                    ) : (
                      <a
                        href={window.api.platform === 'win32' ? 'https://vb-audio.com/Cable/' : 'https://github.com/ExistentialAudio/BlackHole'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/25 transition-all"
                      >
                        <Download size={14} />
                        Download Virtual Cable Driver Manually
                      </a>
                    )}
                    <span className="text-[11px] text-white/20 font-mono">
                      {driverStatus.message}
                    </span>
                  </div>
                )}
              </div>

              {/* Logs output */}
              {driverLogs.length > 0 && (
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 font-mono text-[11px] text-white/70 max-h-48 overflow-y-auto mt-4 space-y-1 shadow-inner scrollbar-thin">
                  <p className="text-white/30 border-b border-white/5 pb-1 mb-1 flex items-center gap-1.5">
                    <Terminal size={12} /> Console Output
                  </p>
                  {driverLogs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap font-mono">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permission Banner */}
      {permissionStatus === 'unknown' && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Limited Device Info</p>
              <p className="text-xs text-amber-400/60 mt-0.5">
                Grant microphone permission to see full device names and details.
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

      {permissionStatus === 'denied' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Microphone Access Denied</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              Go to System Settings → Privacy & Security → Microphone, and enable access for Kangaroo Kaster to see full device details.
            </p>
          </div>
        </div>
      )}

      {permissionStatus === 'granted' && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-white/40">
            Full device access granted — showing {systemDevices.length} audio devices from your system.
          </p>
        </div>
      )}

      {/* System Status */}
      <div className="glass p-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${driverStatus.installed ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse-slow`} />
          <span className="text-xs font-mono text-white/50">
            {window.api.platform === 'darwin' ? 'CoreAudio' : 'Windows Audio'}: {driverStatus.installed ? 'Virtual Audio Driver Active' : 'Virtual Audio Driver Missing'}
          </span>
        </div>
      </div>

      {/* Section: System & Virtual Devices */}
      {loadingDevices ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="text-brand-400 animate-spin" />
          <span className="text-sm text-white/40 ml-3">Scanning system audio devices…</span>
        </div>
      ) : (
        <>
          {/* Devices Grid */}
          <div>
            <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wider">
              All Devices
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {virtualDevices.map((device) => {
                const colors = typeColors[device.type] || typeColors.loopback
                const TypeIcon = typeIcons[device.type] || typeIcons.loopback

                return (
                  <div
                    key={device.id}
                    className={`glass-sm p-5 flex flex-col gap-4 transition-all duration-300 ${!device.active ? 'opacity-50' : ''
                      }`}
                  >
                    {/* Device Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}
                        >
                          <TypeIcon size={20} className={colors.text} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold truncate">{device.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
                            >
                              {device.type}
                            </span>
                            <span className="text-[11px] font-mono text-white/25">
                              ID: {device.id.toUpperCase().slice(0, 12)}
                            </span>
                            {device.linkedDeviceId && (
                              <span className="text-[10px] text-emerald-400/50 font-mono">
                                • HW
                              </span>
                            )}
                            {device.type === 'loopback' && (
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                  device.isPhysical
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {device.isPhysical ? '✓ Mapped' : '⚡ Simulated'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
 
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleVirtualDevice(device.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${device.active
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-white/[0.03] text-white/20 hover:text-white/50'
                            }`}
                          aria-label={device.active ? 'Deactivate' : 'Activate'}
                        >
                          {device.active ? <Power size={14} /> : <PowerOff size={14} />}
                        </button>
                        {!device.linkedDeviceId && !['vloop-desktop', 'vloop-browser', 'vloop-game', 'vloop-music', 'vloop-discord'].includes(device.id) && (
                          <button
                            onClick={() => removeVirtualDevice(device.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            aria-label="Remove device"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
 
                    {/* Device Info */}
                    <div className="flex items-center gap-4 text-[11px] font-mono text-white/30">
                      <span>{device.sampleRate / 1000}kHz</span>
                      <span className="w-px h-3 bg-white/10" />
                      <span>{device.channels}</span>
                      <span className="w-px h-3 bg-white/10" />
                      <span>{device.active ? 'Active' : 'Inactive'}</span>
                      {device.linkedDeviceId && (
                        <>
                          <span className="w-px h-3 bg-white/10" />
                          <span className="text-emerald-400/50">Hardware Device</span>
                        </>
                      )}
                      {device.type === 'loopback' && (
                        <>
                          <span className="w-px h-3 bg-white/10" />
                          <span className={device.isPhysical ? 'text-emerald-400/60 font-semibold' : 'text-amber-400/60 font-semibold'}>
                            {device.isPhysical
                              ? `Mapped to ${device.physicalName}`
                              : 'Virtual-only (requires installing more virtual drivers)'}
                          </span>
                        </>
                      )}
                    </div>

                    {/* App Source Selector for loopback */}
                    {device.type === 'loopback' && (
                      <div className="space-y-1.5 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                        <label className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">
                          Audio Source Application
                        </label>
                        <div className="relative">
                          <select
                            value={device.appSourceId || ''}
                            onChange={(e) => {
                              const val = e.target.value
                              if (!val) {
                                setVirtualDeviceAppSource(device.id, undefined, undefined)
                              } else {
                                const matched = appSources.find((s) => s.id === val)
                                setVirtualDeviceAppSource(device.id, val, matched ? matched.name : 'Application')
                              }
                            }}
                            className="w-full px-3 py-2 pr-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 outline-none focus:border-brand-500/30 transition-colors appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-slate-900 text-white/60">
                              System Audio / Simulator (Default)
                            </option>
                            <optgroup label="Running Windows / Apps" className="bg-slate-900 text-white/40">
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
                            </optgroup>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/20">
                            <span className="text-[10px]">▼</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Volume */}
                    <div className="flex items-center gap-3">
                      <Volume2 size={14} className="text-white/20 shrink-0" />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={device.volume}
                        onChange={(e) => setVirtualDeviceVolume(device.id, Number(e.target.value))}
                        className="flex-1"
                        aria-label={`${device.name} volume`}
                      />
                      <span className="text-xs font-mono text-white/40 w-8 text-right">
                        {device.volume}%
                      </span>
                    </div>

                    {/* Routing info */}
                    <div>
                      <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-2">
                        Routes to
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {device.destinations.map((dest) => (
                          <span
                            key={dest}
                            className="flex items-center gap-1 text-[11px] font-medium text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-1"
                          >
                            <ArrowRight size={10} className="text-brand-400" />
                            {dest}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
