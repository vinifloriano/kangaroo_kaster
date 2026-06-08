import { useState } from 'react'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import MixerPage from './pages/MixerPage'
import VirtualDevicesPage from './pages/VirtualDevicesPage'
import SoundboardPage from './pages/SoundboardPage'
import SettingsPage from './pages/SettingsPage'
import RouterPage from './pages/RouterPage'
import HelpPage from './pages/HelpPage'
import { AudioEngineProvider } from './services/AudioEngine'

export type Page = 'mixer' | 'devices' | 'soundboard' | 'settings' | 'router' | 'help'

function MainLayout() {
  const [activePage, setActivePage] = useState<Page>('mixer')

  const renderPage = () => {
    switch (activePage) {
      case 'mixer':
        return <MixerPage />
      case 'devices':
        return <VirtualDevicesPage onNavigate={setActivePage} />
      case 'soundboard':
        return <SoundboardPage />
      case 'settings':
        return <SettingsPage />
      case 'router':
        return <RouterPage onNavigate={setActivePage} />
      case 'help':
        return <HelpPage />
      default:
        return <MixerPage />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface-900 overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className={`flex-1 ${activePage === 'router' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
          <div className={`animate-in ${activePage === 'router' ? 'h-full flex flex-col' : ''}`}>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AudioEngineProvider>
      <MainLayout />
    </AudioEngineProvider>
  )
}
