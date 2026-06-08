import { useState } from 'react'
import {
  SlidersHorizontal,
  HardDrive,
  Cable,
  Music2,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle
} from 'lucide-react'
import type { Page } from '../App'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const navItems: { id: Page; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'mixer', label: 'Mixer', icon: SlidersHorizontal },
  { id: 'devices', label: 'Devices', icon: HardDrive },
  { id: 'router', label: 'Router', icon: Cable },
  { id: 'soundboard', label: 'Soundboard', icon: Music2 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: HelpCircle }
]

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`shrink-0 flex flex-col bg-surface-900 border-r border-white/[0.06] transition-all duration-300 ease-out ${collapsed ? 'w-[68px]' : 'w-[220px]'
        }`}
    >
      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-1 p-3 pt-4">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                ? 'bg-brand-500/10 text-brand-400'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              title={collapsed ? item.label : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              )}

              <Icon
                size={20}
                className={`shrink-0 transition-colors ${isActive ? 'text-brand-400' : 'text-white/30 group-hover:text-white/60'
                  }`}
              />

              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          )
        })}
      </nav>


      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-white/[0.06] text-white/20 hover:text-white/50 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
