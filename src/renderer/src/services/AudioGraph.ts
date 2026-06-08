export class AudioGraphManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  private mixerInputs = new Map<string, GainNode>();
  private mixerFaders = new Map<string, GainNode>();
  private mixerPanners = new Map<string, StereoPannerNode>();
  private mixerAnalysers = new Map<string, AnalyserNode>();

  private deviceGains = new Map<string, GainNode>();
  private sources = new Map<string, MediaStreamAudioSourceNode>();
  private outputs = new Map<string, { destNode: MediaStreamAudioDestinationNode; audio: HTMLAudioElement }>();

  constructor() {
    // Initialization is done lazily or through explicit init methods
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  public resumeContext(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      return ctx.resume();
    }
    return Promise.resolve();
  }

  public initMasterBus(volume: number, muted: boolean) {
    const ctx = this.getContext();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterAnalyser = ctx.createAnalyser();
      this.masterAnalyser.fftSize = 256;
      this.masterAnalyser.smoothingTimeConstant = 0.4;

      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(ctx.destination);
    }
    this.updateMasterVolume(volume, muted);
  }

  public updateMasterVolume(volume: number, muted: boolean) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : volume / 100, this.getContext().currentTime, 0.01);
    }
  }

  public initMixerChannel(id: string) {
    const ctx = this.getContext();
    if (!this.mixerInputs.has(id)) {
      const input = ctx.createGain();
      const fader = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      input.connect(analyser);
      analyser.connect(fader);
      fader.connect(panner);

      if (this.masterGain) {
        panner.connect(this.masterGain);
      }

      this.mixerInputs.set(id, input);
      this.mixerFaders.set(id, fader);
      this.mixerPanners.set(id, panner);
      this.mixerAnalysers.set(id, analyser);
    }
  }

  public updateMixerChannel(id: string, volume: number, muted: boolean, pan: number, soloActive: boolean, isSolo: boolean) {
    const fader = this.mixerFaders.get(id);
    const panner = this.mixerPanners.get(id);
    const ctx = this.getContext();

    if (fader) {
      let targetVolume = volume / 100;
      if (muted || (soloActive && !isSolo)) {
        targetVolume = 0;
      }
      fader.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.01);
    }

    if (panner) {
      panner.pan.setTargetAtTime(pan / 100, ctx.currentTime, 0.01);
    }
  }

  public getMixerInput(id: string): GainNode | null {
    return this.mixerInputs.get(id) || null;
  }

  public getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  public getDeviceGain(key: string): GainNode {
    let gain = this.deviceGains.get(key);
    if (!gain) {
      gain = this.getContext().createGain();
      this.deviceGains.set(key, gain);
    }
    return gain;
  }

  public connectSourceToDeviceGain(key: string, source: MediaStreamAudioSourceNode): boolean {
    const gain = this.getDeviceGain(key);
    try {
      source.connect(gain);
      return true;
    } catch (e) {
      console.warn(`Source already connected or error connecting to ${key}`, e);
      return false;
    }
  }

  public createOutput(deviceId: string): { destNode: MediaStreamAudioDestinationNode; audio: HTMLAudioElement } {
    if (this.outputs.has(deviceId)) {
      return this.outputs.get(deviceId)!;
    }

    const ctx = this.getContext();
    const dest = ctx.createMediaStreamDestination();
    const audio = new Audio();
    audio.srcObject = dest.stream;

    if (typeof audio.setSinkId === 'function') {
      audio.setSinkId(deviceId).catch(err => console.error(`Failed to set sink ID ${deviceId}`, err));
    }

    audio.play().catch(() => {});

    const output = { destNode: dest, audio };
    this.outputs.set(deviceId, output);
    return output;
  }

  public getMixerAnalysers() {
    return this.mixerAnalysers;
  }

  public getMasterAnalyser() {
    return this.masterAnalyser;
  }

  public disconnectAllDynamicConnections() {
    // This is for the "non-incremental" part of the transition,
    // we might want to be more surgical later.
    this.deviceGains.forEach(gain => {
      try { gain.disconnect(); } catch (e) {
        // Gain might already be disconnected
      }
    });
  }

  public close() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.mixerInputs.clear();
    this.mixerFaders.clear();
    this.mixerPanners.clear();
    this.mixerAnalysers.clear();
    this.deviceGains.clear();
    this.sources.clear();
    this.outputs.forEach(o => {
      o.audio.pause();
      o.audio.srcObject = null;
    });
    this.outputs.clear();
  }
}
