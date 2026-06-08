import { Info, AlertTriangle } from 'lucide-react'

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">
          Documentation
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">Help & Guides</span>
        </h1>
        <p className="text-sm text-white/30 mt-1">
          Learn how to route audio and troubleshoot common issues.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Guide Card */}
        <div className="glass p-6 border border-brand-500/10 bg-brand-500/[0.02] space-y-4">
          <div>
            <h3 className="text-base font-bold text-brand-400 flex items-center gap-2">
              <Info size={18} /> How to Route Application Audio
            </h3>
            <p className="text-sm text-white/50 leading-relaxed mt-2">
              Kangaroo Kaster provides built-in Application Audio Capture! You can route sound from any running application directly to a virtual cable by choosing it in the dropdown for that cable. Alternatively, you can route application audio using standard virtual audio drivers:
            </p>
            <ul className="list-disc pl-5 text-sm text-white/40 space-y-3 mt-4 leading-relaxed">
              <li>
                <strong className="text-white/70">App-Specific Settings (Recommended):</strong> Open the settings inside applications like Discord, Spotify, Zoom, or VLC, and set their <strong className="text-white/70">Output Device</strong> directly to your virtual driver (e.g. <strong className="text-white/70">BlackHole 2ch</strong>).
              </li>
              <li>
                <strong className="text-white/70">macOS System Sound Output:</strong> For apps that do not support choosing custom audio output devices (like Safari, Chrome, YouTube, or system sounds), change the macOS default output device to <strong className="text-white/70">BlackHole 2ch</strong> in macOS System Settings.
              </li>
              <li>
                <strong className="text-white/70">Visual Matrix Routing:</strong> In the <strong className="text-brand-400">Visual Routing Matrix</strong>, wire the output of your physical device (e.g. <strong className="text-white/70">BlackHole 2ch Out</strong>) to the mixer input strip (e.g. <strong className="text-white/70">In 2 (Desktop)</strong>).
              </li>
            </ul>
          </div>
        </div>

        {/* Troubleshooting / FAQ Card */}
        <div className="glass p-6 border border-amber-500/10 bg-amber-500/[0.01] space-y-4">
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={18} /> Virtual Cable FAQ & Troubleshooting
          </h3>
          <div className="space-y-6 text-sm mt-4">
            <div>
              <h4 className="font-semibold text-white/85 text-base">Q: Why does only &quot;BlackHole 2ch&quot; show in macOS System Settings?</h4>
              <p className="text-white/40 mt-1.5 leading-relaxed">
                Kangaroo Kaster supports built-in Application Audio Capture, meaning you only need one virtual driver installed (e.g. <strong className="text-white/60">BlackHole 2ch</strong>) to act as a system bridge. You can select individual apps directly in the virtual cables section, and they will route to the mixer independently without requiring multiple system drivers!
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white/85 text-base">Q: How do I route multiple applications onto separate channels?</h4>
              <p className="text-white/40 mt-1.5 leading-relaxed">
                Simply select different apps for different virtual cables! For example, choose Spotify for the &quot;Music Audio (Virtual)&quot; cable, and Chrome for the &quot;Browser Audio (Virtual)&quot; cable. Kangaroo Kaster will separate them internally. No extra hardware drivers needed!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
