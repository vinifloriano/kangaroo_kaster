import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { AudioEngineProvider, useAudioEngine } from './AudioEngine'

// Mock MediaStream before everything
class MockMediaStream {
  getTracks() { return [] }
  getVideoTracks() { return [] }
  getAudioTracks() { return [] }
}
vi.stubGlobal('MediaStream', MockMediaStream)

class MockAudioNode {
  connect = vi.fn()
  disconnect = vi.fn()
}

class MockAudioParam {
  setTargetAtTime = vi.fn()
  setValueAtTime = vi.fn()
  value = 0
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam()
}

class MockAudioContext {
  state = 'suspended'
  currentTime = 0
  createGain = vi.fn(() => new MockGainNode())
  createAnalyser = vi.fn(() => ({
    fftSize: 0,
    smoothingTimeConstant: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn()
  }))
  createStereoPanner = vi.fn(() => ({
    pan: new MockAudioParam(),
    connect: vi.fn(),
    disconnect: vi.fn()
  }))
  createMediaStreamDestination = vi.fn(() => ({ stream: new MockMediaStream() }))
  createMediaStreamSource = vi.fn(() => new MockAudioNode())
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => Promise.resolve())
  destination = new MockAudioNode()
}

function AudioContextMock() {
  return new MockAudioContext()
}
const MockAudioContextSpy = vi.fn().mockImplementation(AudioContextMock)
vi.stubGlobal('AudioContext', MockAudioContextSpy)

vi.stubGlobal('navigator', {
  mediaDevices: {
    enumerateDevices: vi.fn(() => Promise.resolve([])),
    getUserMedia: vi.fn(() => Promise.resolve(new MockMediaStream())),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
})

vi.stubGlobal('window', {
  api: {
    permissions: {
      getMicrophoneStatus: vi.fn(() => Promise.resolve('granted')),
      requestMicrophone: vi.fn(() => Promise.resolve('granted'))
    },
    drivers: {
      checkStatus: vi.fn(() => Promise.resolve({ installed: true, type: 'virtual', message: 'Ready' })),
      onInstallProgress: vi.fn(() => () => {})
    },
    apps: {
      getSources: vi.fn(() => Promise.resolve([])),
      setCaptureSource: vi.fn(() => Promise.resolve())
    }
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
})

// Mock Audio element more thoroughly for happy-dom
vi.stubGlobal('Audio', class {
  _srcObject = null
  get srcObject() { return this._srcObject }
  set srcObject(val) { this._srcObject = val }
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  setSinkId = vi.fn(() => Promise.resolve())
})

const TestComponent = () => {
  const { masterVolume, setMasterVolume, devices } = useAudioEngine()
  return (
    <div>
      <span data-testid="master-volume">{masterVolume}</span>
      <button onClick={() => setMasterVolume(90)}>Increase Volume</button>
      <ul data-testid="device-list">
        {devices.map(d => <li key={d.deviceId}>{d.label}</li>)}
      </ul>
    </div>
  )
}

describe('AudioEngineProvider Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(window.api.permissions.getMicrophoneStatus).mockResolvedValue('granted')
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([])
  })

  it('provides default values', async () => {
    render(
      <AudioEngineProvider>
        <TestComponent />
      </AudioEngineProvider>
    )

    expect(screen.getByTestId('master-volume').textContent).toBe('85')
  })

  it('updates master volume', async () => {
    render(
      <AudioEngineProvider>
        <TestComponent />
      </AudioEngineProvider>
    )

    const button = screen.getByText('Increase Volume')
    fireEvent.click(button)

    expect(screen.getByTestId('master-volume').textContent).toBe('90')
    expect(localStorage.getItem('kk_master_volume')).toBe('90')
  })

  it('handles permission denial', async () => {
    vi.mocked(window.api.permissions.getMicrophoneStatus).mockRejectedValue(new Error('denied'))

    const StatusComponent = () => {
      const { permissionStatus } = useAudioEngine()
      return <div data-testid="perm-status">{permissionStatus}</div>
    }

    render(
      <AudioEngineProvider>
        <StatusComponent />
      </AudioEngineProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('perm-status').textContent).toBe('denied')
    }, { container: document.body })
  })

  it('handles device list updates', async () => {
    const mockDevices = [
      { deviceId: 'dev1', label: 'Mic 1', kind: 'audioinput', groupId: 'g1' }
    ]
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue(mockDevices as any)

    render(
      <AudioEngineProvider>
        <TestComponent />
      </AudioEngineProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Mic 1')).toBeDefined()
    }, { container: document.body })
  })
})
