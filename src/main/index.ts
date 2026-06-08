import { app, shell, BrowserWindow, ipcMain, systemPreferences, desktopCapturer, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Disable autoplay policy to allow Web Audio API and <audio> tags to route sound without requiring a click
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handlers for permissions
ipcMain.handle('permissions:getMicrophoneStatus', async () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('microphone')
  }
  return 'granted'
})

ipcMain.handle('permissions:requestMicrophone', async () => {
  if (process.platform === 'darwin') {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return granted ? 'granted' : 'denied'
  }
  return 'granted'
})

ipcMain.handle('permissions:getScreenCaptureStatus', async () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen')
  }
  return 'granted'
})

ipcMain.handle('apps:getSources', async () => {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 0, height: 0 }
      })
      return sources.map((s) => ({
        id: s.id,
        name: s.name
      }))
    } catch (err) {
      console.error('Failed to get sources:', err)
      return []
    }
  }
  return []
})

// Store pending capture sources per webContents
const pendingCaptureSources = new Map<number, string>()

ipcMain.handle('apps:setCaptureSource', (event, sourceId: string) => {
  if (event.sender) {
    pendingCaptureSources.set(event.sender.id, sourceId)
  }
})

// IPC handlers for virtual audio drivers
import { exec } from 'child_process'
import { existsSync } from 'fs'

const getBrewPath = (): string => {
  if (existsSync('/opt/homebrew/bin/brew')) {
    return '/opt/homebrew/bin/brew'
  }
  if (existsSync('/usr/local/bin/brew')) {
    return '/usr/local/bin/brew'
  }
  return 'brew'
}

ipcMain.handle('drivers:checkStatus', async () => {
  if (process.platform === 'darwin') {
    // 1. Check if HAL driver exists (could be BlackHole, BlackHole2ch, or BlackHole16ch)
    const halPath = '/Library/Audio/Plug-Ins/HAL'
    const driverExists =
      existsSync(join(halPath, 'BlackHole.driver')) ||
      existsSync(join(halPath, 'BlackHole2ch.driver')) ||
      existsSync(join(halPath, 'BlackHole16ch.driver')) ||
      existsSync(join(halPath, 'BlackHole64ch.driver')) ||
      existsSync(join(halPath, 'VB-Audio.driver')) // Also check for VB-Cable on Mac

    if (driverExists) {
      return {
        installed: true,
        type: 'mac-active',
        message: 'Virtual Audio Driver is installed and active.'
      }
    }

    // 2. Check brew status using absolute path
    const brewPath = getBrewPath()
    return new Promise((resolve) => {
      exec(`"${brewPath}" list --cask 2>/dev/null`, (err, stdout) => {
        if (err && brewPath === 'brew') {
          resolve({
            installed: false,
            type: 'mac-manual',
            message: 'Homebrew not found. Install a virtual audio driver (e.g. BlackHole) manually.'
          })
          return
        }

        const caskInstalled = stdout && (stdout.includes('blackhole-2ch') || stdout.includes('blackhole-16ch'))
        if (caskInstalled) {
          resolve({
            installed: false,
            type: 'mac-inactive',
            message: 'Virtual driver installed via Homebrew but not active. A restart is required.'
          })
        } else {
          resolve({
            installed: false,
            type: 'mac-brew',
            message: 'BlackHole is available for automatic install via Homebrew.'
          })
        }
      })
    })
  } else if (process.platform === 'win32') {
    // Check for VB-Cable on Windows via common installation paths or registry if possible
    // For now, let's look for the driver files in System32/drivers
    const winDriverExists = 
      existsSync('C:\\Windows\\System32\\drivers\\vbcable_x64.sys') ||
      existsSync('C:\\Windows\\System32\\drivers\\vbcable.sys')
    
    if (winDriverExists) {
      return {
        installed: true,
        type: 'win-active',
        message: 'VB-Cable driver is installed and active.'
      }
    }

    return {
      installed: false,
      type: 'win-manual',
      message: 'VB-Cable is recommended for Windows. Install VB-Cable manually from vb-audio.com.'
    }
  }
  return { installed: true, type: 'unknown', message: 'Virtual devices simulated.' }
})

ipcMain.handle('drivers:install', async (event) => {
  if (process.platform === 'darwin') {
    const brewPath = getBrewPath()
    return new Promise((resolve) => {
      // Use --cask specifically for BlackHole
      const child = exec(`"${brewPath}" install --cask blackhole-2ch`)

      child.stdout?.on('data', (data) => {
        event.sender.send('drivers:install-progress', { log: data.toString() })
      })

      child.stderr?.on('data', (data) => {
        event.sender.send('drivers:install-progress', { log: data.toString() })
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: `Installation failed with exit code ${code}` })
        }
      })
    })
  }
  return { success: false, error: 'Unsupported platform' }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.kangarookaster.app')

  // Set up the display media request handler to automatically select the source
  // This is the "best and greatest" technique for per-app audio on macOS
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (!request.webContents) {
      callback()
      return
    }
    const sourceId = pendingCaptureSources.get(request.webContents.id)
    if (sourceId) {
      pendingCaptureSources.delete(request.webContents.id)
      desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
        const source = sources.find((s) => s.id === sourceId)
        if (source) {
          callback({
            video: source,
            audio: source, // Use the same source for audio (per-app audio)
            enableLocalEcho: false
          })
        } else {
          callback() // Cancel if source not found
        }
      })
    } else {
      // If no pending source, allow default behavior (shows picker)
      // or we can just cancel to prevent unexpected pickers
      callback()
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
