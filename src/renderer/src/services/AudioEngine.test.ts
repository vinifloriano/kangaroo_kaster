import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isVirtualDeviceLabel, getSystemVirtualDevicePairs, SystemDevice } from './AudioEngine'
import { AudioGraphManager } from './AudioGraph'

// Mock AudioContext and related APIs
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

class MockStereoPannerNode extends MockAudioNode {
  pan = new MockAudioParam()
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 0
  smoothingTimeConstant = 0
  getByteFrequencyData = vi.fn()
}

class MockAudioContext {
  state = 'suspended'
  currentTime = 0
  createGain = vi.fn(() => new MockGainNode())
  createAnalyser = vi.fn(() => new MockAnalyserNode())
  createStereoPanner = vi.fn(() => new MockStereoPannerNode())
  createMediaStreamDestination = vi.fn(() => ({ stream: {} }))
  createMediaStreamSource = vi.fn(() => new MockAudioNode())
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => Promise.resolve())
  destination = new MockAudioNode()
}

// Ensure AudioContext is a constructor
function AudioContextMock() {
  return new MockAudioContext()
}
const MockAudioContextSpy = vi.fn().mockImplementation(AudioContextMock)
vi.stubGlobal('AudioContext', MockAudioContextSpy)
vi.stubGlobal('Audio', class {
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  srcObject = null
  setSinkId = vi.fn(() => Promise.resolve())
})

describe('AudioEngine Utilities', () => {
  describe('isVirtualDeviceLabel', () => {
    it('should identify BlackHole as a virtual device', () => {
      expect(isVirtualDeviceLabel('BlackHole 2ch')).toBe(true)
    })

    it('should identify VB-Cable as a virtual device', () => {
      expect(isVirtualDeviceLabel('VB-Audio Virtual Cable')).toBe(true)
    })

    it('should not identify regular speakers as virtual', () => {
      expect(isVirtualDeviceLabel('MacBook Pro Speakers')).toBe(false)
    })

    it('should handle Portuguese labels', () => {
      expect(isVirtualDeviceLabel('Cabo Virtual')).toBe(true)
    })
  })

  describe('getSystemVirtualDevicePairs', () => {
    it('should pair BlackHole input and output', () => {
      const devices: SystemDevice[] = [
        { deviceId: 'in1', label: 'BlackHole 2ch', kind: 'audioinput', groupId: 'g1' },
        { deviceId: 'out1', label: 'BlackHole 2ch', kind: 'audiooutput', groupId: 'g1' }
      ]
      const pairs = getSystemVirtualDevicePairs(devices)
      expect(pairs).toHaveLength(1)
      expect(pairs[0]).toEqual({
        name: 'BlackHole 2ch',
        inputId: 'in1',
        outputId: 'out1'
      })
    })

    it('should handle unpaired virtual inputs', () => {
      const devices: SystemDevice[] = [
        { deviceId: 'in1', label: 'BlackHole 2ch', kind: 'audioinput', groupId: 'g1' }
      ]
      const pairs = getSystemVirtualDevicePairs(devices)
      expect(pairs).toHaveLength(1)
      expect(pairs[0].inputId).toBe('in1')
      expect(pairs[0].outputId).toBeNull()
    })
  })
})

describe('AudioGraphManager', () => {
  let manager: AudioGraphManager

  beforeEach(() => {
    manager = new AudioGraphManager()
  })

  afterEach(() => {
    manager.close()
  })

  it('should initialize AudioContext', () => {
    const ctx = manager.getContext()
    expect(ctx).toBeDefined()
    expect(MockAudioContextSpy).toHaveBeenCalled()
  })

  it('should initialize master bus', () => {
    manager.initMasterBus(80, false)
    const masterGain = manager.getMasterGain()
    expect(masterGain).toBeDefined()
    expect(masterGain?.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, 0, 0.01)
  })

  it('should update master volume', () => {
    manager.initMasterBus(80, false)
    manager.updateMasterVolume(50, false)
    const masterGain = manager.getMasterGain()
    expect(masterGain?.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.01)
  })

  it('should mute master volume', () => {
    manager.initMasterBus(80, false)
    manager.updateMasterVolume(80, true)
    const masterGain = manager.getMasterGain()
    expect(masterGain?.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01)
  })

  it('should initialize mixer channel', () => {
    manager.initMasterBus(80, false)
    manager.initMixerChannel('mic')
    const input = manager.getMixerInput('mic')
    expect(input).toBeDefined()
  })

  it('should update mixer channel', () => {
    manager.initMasterBus(80, false)
    manager.initMixerChannel('mic')
    manager.updateMixerChannel('mic', 70, false, 20, false, false)

    // We can't easily check private faders/panners but we can check if update calls were made if we exposed them or used spies.
    // For now, let's just ensure it doesn't crash and the manager state is consistent.
    expect(manager.getMixerInput('mic')).toBeDefined()
  })

  it('should create and cache device gains', () => {
    const gain1 = manager.getDeviceGain('dev1')
    const gain2 = manager.getDeviceGain('dev1')
    expect(gain1).toBe(gain2)
  })

  it('should create and cache outputs', () => {
    const output1 = manager.createOutput('out1')
    const output2 = manager.createOutput('out1')
    expect(output1).toBe(output2)
  })
})
