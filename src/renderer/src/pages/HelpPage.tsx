import { Info, AlertTriangle, Cable, SlidersHorizontal, Radio, Zap } from 'lucide-react'

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
          Documentation
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">Help Center</span>
        </h1>
        <p className="text-sm text-white/30 mt-1">
          Master professional audio routing and broadcasting with Kangaroo Kaster.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Core Concept */}
        <div className="glass p-6 border border-brand-500/10 bg-brand-500/[0.02] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Zap size={120} className="text-brand-400" />
          </div>
          <h3 className="text-base font-bold text-brand-400 flex items-center gap-2 mb-4">
            <Zap size={18} /> Core Concept: Routing-First Workflow
          </h3>
          <p className="text-sm text-white/60 leading-relaxed">
            Kangaroo Kaster uses a node-based routing system. Unlike standard mixers, you define where audio comes from and where it goes using the <strong className="text-white/80">Routing Matrix</strong>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
                <Info size={16} className="text-cyan-400" />
              </div>
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">1. Sources</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">Hardware mics, system audio, or individual applications.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center mb-3">
                <SlidersHorizontal size={16} className="text-brand-400" />
              </div>
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">2. Mixer</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">The central hub where you adjust volumes, pan, and apply DSP effects.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                <Radio size={16} className="text-emerald-400" />
              </div>
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">3. Outputs</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">Your speakers, headphones, or the final stream/recording mix.</p>
            </div>
          </div>
        </div>

        {/* Detailed Guides */}
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest px-1">Detailed Guides</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guide: App Capture */}
            <div className="glass-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                <Cable size={16} className="text-cyan-400" /> Per-App Audio Capture
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Kangaroo Kaster uses ScreenCaptureKit (macOS) to isolate audio from specific windows.
              </p>
              <ul className="space-y-2">
                <li className="text-[11px] text-white/30 flex gap-2">
                  <span className="text-brand-400 font-bold">•</span>
                  <span>Create a <strong className="text-white/50">Virtual Cable</strong> in the Devices tab.</span>
                </li>
                <li className="text-[11px] text-white/30 flex gap-2">
                  <span className="text-brand-400 font-bold">•</span>
                  <span>Select the target <strong className="text-white/50">Application</strong> from the dropdown.</span>
                </li>
                <li className="text-[11px] text-white/30 flex gap-2">
                  <span className="text-brand-400 font-bold">•</span>
                  <span>In the <strong className="text-white/50">Router</strong>, connect that cable to a Mixer input.</span>
                </li>
              </ul>
            </div>

            {/* Guide: Low Latency */}
            <div className="glass-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                <Zap size={16} className="text-amber-400" /> Achieving Low Latency
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">
                For professional live mixing, latency must be below 10ms.
              </p>
              <ul className="space-y-2">
                <li className="text-[11px] text-white/30 flex gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>Set buffer size to <strong className="text-white/50">128 or 64 samples</strong> in Settings.</span>
                </li>
                <li className="text-[11px] text-white/30 flex gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>Ensure your system sample rate matches <strong className="text-white/50">48kHz</strong>.</span>
                </li>
                <li className="text-[11px] text-white/30 flex gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>Use wired headphones for monitoring instead of Bluetooth.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Troubleshooting / FAQ Card */}
        <div className="glass p-6 border border-amber-500/10 bg-amber-500/[0.01] space-y-4">
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={18} /> Troubleshooting & FAQ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm mt-4">
            <div className="space-y-2">
              <h4 className="font-bold text-white/80 text-xs uppercase tracking-wider">No Audio in Mixer?</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Check the <strong className="text-white/60">Router</strong>. Ensure there is a path from your Source to the Mixer input port. Also verify the application is actually playing sound.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-white/80 text-xs uppercase tracking-wider">Crackling Sound?</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Your CPU might be struggling with a low buffer size. Increase the <strong className="text-white/60">Buffer Size</strong> in Settings to 256 or 512 samples.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-white/80 text-xs uppercase tracking-wider">Permission Errors?</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">
                macOS requires <strong className="text-white/60">Screen Recording</strong> permission for per-app audio and <strong className="text-white/60">Microphone</strong> permission for hardware inputs.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-white/80 text-xs uppercase tracking-wider">Driver Not Showing?</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">
                If BlackHole is installed but not active, run <code className="bg-black/40 px-1 rounded text-brand-400">sudo killall coreaudiod</code> in your terminal to refresh the driver list.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
