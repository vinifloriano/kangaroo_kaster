export default function Titlebar() {
  return (
    <header className="drag-region flex items-center h-10 bg-surface-900 border-b border-white/[0.06] shrink-0 z-50">
      {/* Spacer for macOS traffic light buttons */}
      <div className="w-[78px] shrink-0" />

      {/* Logo + Title — centered */}
      <div className="flex-1 flex items-center justify-center gap-2.5">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center text-[9px] font-black text-white">
          K
        </div>
        <span className="text-[13px] font-semibold text-white/70 tracking-tight">
          Kangaroo <span className="text-brand-400">Kaster</span>
        </span>
        <span className="text-[10px] font-mono text-white/20 ml-1">v1.0.0</span>
      </div>

      {/* Status indicator */}
      <div className="w-[78px] shrink-0 flex items-center justify-end pr-4">
        <div className="flex items-center gap-1.5 text-[10px] text-white/25 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
          Ready
        </div>
      </div>
    </header>
  )
}
