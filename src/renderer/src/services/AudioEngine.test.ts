import { describe, it, expect, vi } from 'vitest'
import { isVirtualDeviceLabel, getSystemVirtualDevicePairs, SystemDevice } from './AudioEngine'

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
