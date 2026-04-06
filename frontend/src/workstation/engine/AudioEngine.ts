import * as Tone from 'tone';
import { Track, MidiNote, InstrumentPreset } from '../models/types';
import { getPreset, InstrumentPresetDef } from '../models/presets';

// Convert MIDI note number to note name (e.g. 60 -> 'C4')
const midiToNote = (midi: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = noteNames[midi % 12];
  return `${note}${octave}`;
};

// Convert velocity (0-127) to Tone.js volume-friendly value (0-1)
const velocityToGain = (velocity: number): number => {
  return velocity / 127;
};

interface TrackNodes {
  synth: Tone.PolySynth | Tone.NoiseSynth | Tone.Sampler;
  samplerLoaded: boolean; // true when sampler samples are loaded
  gain: Tone.Gain;
  panner: Tone.Panner;
  // Effects
  reverb: Tone.Reverb | null;
  reverbSend: Tone.Gain | null;
  delay: Tone.FeedbackDelay | null;
  delaySend: Tone.Gain | null;
  filter: Tone.Filter | null;
  // Post-effects dry path
  dryGain: Tone.Gain;
  // Audio playback
  players: Map<number, Tone.Player>; // clipId → Player
  scheduledEvents: number[];
  automationEvents: number[];
}

class AudioEngine {
  private trackNodes: Map<number, TrackNodes> = new Map();
  private isInitialized = false;
  private scheduledEvents: number[] = [];
  private _pendingAudioStarts: { player: Tone.Player; offset: number }[] = [];

  // Cache of loaded sampler buffers — keyed by preset ID
  // Once a sampler's buffers are loaded, reuse them instead of re-downloading
  private samplerBufferCache: Map<string, Record<string, Tone.ToneAudioBuffer>> = new Map();

  // Callbacks for sampler load state changes
  private onSamplerLoadCallbacks: Set<() => void> = new Set();

  // Preview synth for real-time note audition (piano roll dragging)
  private previewSynth: Tone.PolySynth | Tone.Sampler | null = null;
  private previewGain: Tone.Gain | null = null;
  private activePreviewNotes: Set<string> = new Set();

  // Subscribe to sampler load events (for UI loading indicators)
  onSamplerLoad(cb: () => void): () => void {
    this.onSamplerLoadCallbacks.add(cb);
    return () => this.onSamplerLoadCallbacks.delete(cb);
  }

  private notifySamplerLoad(): void {
    this.onSamplerLoadCallbacks.forEach((cb) => cb());
  }

  // Check if a track's sampler is loaded
  isTrackSamplerLoaded(trackId: number): boolean {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return true;
    return nodes.samplerLoaded;
  }

  // Must be called from a user gesture (click/tap)
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await Tone.start();
    this.isInitialized = true;
    console.log('AudioEngine initialized');
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // Create a synth or sampler based on preset ID
  // Per-preset volume normalization (dB). Tune these to equalize loudness.
  // Negative = quieter, positive = louder, 0 = no change.
  private static PRESET_GAIN_DB: Record<string, number> = {
    // Sampled instruments (tend to be recorded hot)
    'salamander-piano': -6,
    'organ': -4,
    'harmonium': -3,
    'violin': -2,
    'cello': -2,
    'contrabass': -3,
    'harp': -4,
    'trumpet': -5,
    'trombone': -5,
    'french-horn': -5,
    'tuba': -6,
    'flute': -2,
    'clarinet': -2,
    'bassoon': -3,
    'saxophone': -4,
    'guitar-acoustic': -3,
    'guitar-electric': -4,
    'guitar-nylon': -3,
    'bass-electric': -4,
    'xylophone': -3,
    // Synth presets (generally more controlled)
    'saw-lead': -8,
    'square-lead': -7,
    'fm-lead': 0,
    'fat-lead': -10,
    'pwm-lead': -7,
    'warm-pad': -5,
    'string-pad': -5,
    'glass-pad': -3,
    'am-pad': -4,
    'sub-bass': -6,
    'saw-bass': -8,
    'fm-bass': -4,
    'reese-bass': -9,
    'pluck': -2,
    'fm-pluck': -1,
    'kalimba': -1,
    'membrane': -4,
    'metal': -8,
  };

  private applyPresetGain(synth: Tone.PolySynth | Tone.Sampler, presetId: string): void {
    const gainDb = AudioEngine.PRESET_GAIN_DB[presetId];
    if (gainDb !== undefined && gainDb !== 0) {
      synth.volume.value = gainDb;
    }
  }

  private createSynth(presetId: InstrumentPreset, _trackType: string): Tone.PolySynth | Tone.Sampler {
    const preset = getPreset(presetId);

    if (preset && preset.type === 'sampler' && preset.samplerConfig) {
      const cfg = preset.samplerConfig;

      // Check if we have cached buffers for this preset
      const cachedBuffers = this.samplerBufferCache.get(presetId);
      if (cachedBuffers) {
        // Create sampler from cached buffers — instant, no network
        const sampler = new Tone.Sampler({
          urls: {},
          release: cfg.release ?? 1,
        });
        // Manually add cached buffers
        for (const [note, buffer] of Object.entries(cachedBuffers)) {
          sampler.add(note, buffer);
        }
        // Mark as already loaded after a microtask (so trackNodes is set first)
        setTimeout(() => {
          for (const [, nodes] of this.trackNodes) {
            if (nodes.synth === sampler) {
              nodes.samplerLoaded = true;
            }
          }
          this.notifySamplerLoad();
        }, 0);
        this.applyPresetGain(sampler, presetId);
        return sampler;
      }

      // No cache — load samples individually so 404s don't break everything
      const sampler = new Tone.Sampler({
        urls: {},
        release: cfg.release ?? 1,
      });

      const noteEntries = Object.entries(cfg.urls);
      let loaded = 0;
      let failed = 0;
      const total = noteEntries.length;

      const checkDone = () => {
        if (loaded + failed >= total) {
          // Cache whatever loaded successfully
          const buffers: Record<string, Tone.ToneAudioBuffer> = {};
          for (const [note] of noteEntries) {
            try {
              const buf = (sampler as any)._buffers?.get(
                Tone.Frequency(note).toMidi()
              );
              if (buf && buf.loaded) buffers[note] = buf;
            } catch { /* skip */ }
          }
          if (Object.keys(buffers).length > 0) {
            this.samplerBufferCache.set(presetId, buffers);
          }
          // Mark as loaded
          for (const [, nodes] of this.trackNodes) {
            if (nodes.synth === sampler) {
              nodes.samplerLoaded = true;
            }
          }
          this.notifySamplerLoad();
          if (failed > 0) {
            console.warn(`[AudioEngine] ${presetId}: ${loaded}/${total} samples loaded, ${failed} failed`);
          }
        }
      };

      for (const [note, filename] of noteEntries) {
        const url = cfg.baseUrl + filename;
        const buf = new Tone.ToneAudioBuffer(url,
          () => {
            // Success — add to sampler
            try { sampler.add(note, buf); } catch { /* ignore */ }
            loaded++;
            checkDone();
          },
          () => {
            // Fail — skip this note, sampler will pitch-shift from neighbors
            failed++;
            checkDone();
          }
        );
      }

      this.applyPresetGain(sampler, presetId);
      return sampler;
    }

    if (preset && preset.type === 'synth' && preset.synthConfig) {
      const cfg = preset.synthConfig;
      const synthMap: Record<string, any> = {
        'Synth': Tone.Synth,
        'FMSynth': Tone.FMSynth,
        'AMSynth': Tone.AMSynth,
        'MembraneSynth': Tone.MembraneSynth,
        'MetalSynth': Tone.MetalSynth,
      };
      const SynthClass = synthMap[cfg.synthType] || Tone.Synth;
      const poly = new Tone.PolySynth(SynthClass, cfg.options);
      this.applyPresetGain(poly, presetId);
      return poly;
    }

    // Fallback: basic triangle
    const fallback = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
    });
    this.applyPresetGain(fallback, presetId);
    return fallback;
  }

  // Create or update the audio nodes for a track
  private ensureTrackNodes(track: Track): TrackNodes {
    let nodes = this.trackNodes.get(track.id);

    if (!nodes) {
      // Signal chain: synth → gain → [filter] → dryGain → panner → destination
      //                                      ↘ reverbSend → reverb → panner
      //                                      ↘ delaySend → delay → panner
      const panner = new Tone.Panner(track.pan / 100).toDestination();
      const dryGain = new Tone.Gain(1).connect(panner);
      const gain = new Tone.Gain(track.volume / 100).connect(dryGain);

      const synth = this.createSynth(track.instrument, track.type);
      synth.connect(gain);

      nodes = {
        synth, gain, panner, dryGain,
        samplerLoaded: synth instanceof Tone.Sampler ? false : true,
        reverb: null, reverbSend: null,
        delay: null, delaySend: null,
        filter: null,
        players: new Map(),
        scheduledEvents: [], automationEvents: [],
      };
      this.trackNodes.set(track.id, nodes);
    }

    // Update gain and pan (skip gain if automation is active)
    if (!track.volumeAutomation || track.volumeAutomation.length === 0) {
      nodes.gain.gain.value = track.muted ? 0 : track.volume / 100;
    }
    nodes.panner.pan.value = track.pan / 100;

    // Update effects
    this.updateTrackEffects(track, nodes);

    return nodes;
  }

  // Update effect nodes to match track settings
  private updateTrackEffects(track: Track, nodes: TrackNodes): void {
    const fx = track.effects;
    if (!fx) return;

    // ─── Reverb ───
    if (fx.reverbMix > 0) {
      if (!nodes.reverb) {
        nodes.reverb = new Tone.Reverb({ decay: fx.reverbDecay, wet: 1 }).connect(nodes.panner);
        nodes.reverbSend = new Tone.Gain(fx.reverbMix / 100).connect(nodes.reverb);
        nodes.dryGain.connect(nodes.reverbSend);
      }
      nodes.reverbSend!.gain.value = fx.reverbMix / 100;
      nodes.reverb.decay = fx.reverbDecay;
    } else if (nodes.reverbSend) {
      nodes.reverbSend.gain.value = 0;
    }

    // ─── Delay ───
    if (fx.delayMix > 0) {
      if (!nodes.delay) {
        nodes.delay = new Tone.FeedbackDelay({
          delayTime: fx.delayTime,
          feedback: fx.delayFeedback / 100,
          wet: 1,
        }).connect(nodes.panner);
        nodes.delaySend = new Tone.Gain(fx.delayMix / 100).connect(nodes.delay);
        nodes.dryGain.connect(nodes.delaySend);
      }
      nodes.delaySend!.gain.value = fx.delayMix / 100;
      nodes.delay.delayTime.value = fx.delayTime;
      nodes.delay.feedback.value = fx.delayFeedback / 100;
    } else if (nodes.delaySend) {
      nodes.delaySend.gain.value = 0;
    }

    // ─── Filter ───
    if (fx.filterEnabled) {
      if (!nodes.filter) {
        nodes.filter = new Tone.Filter({
          frequency: fx.filterFreq,
          type: fx.filterType,
          rolloff: -24,
        });
        // Insert filter between gain and dryGain
        nodes.gain.disconnect(nodes.dryGain);
        nodes.gain.connect(nodes.filter);
        nodes.filter.connect(nodes.dryGain);
      }
      nodes.filter.frequency.value = fx.filterFreq;
      nodes.filter.type = fx.filterType;
    } else if (nodes.filter) {
      // Bypass filter
      nodes.gain.disconnect(nodes.filter);
      nodes.filter.disconnect(nodes.dryGain);
      nodes.gain.connect(nodes.dryGain);
      nodes.filter.dispose();
      nodes.filter = null;
    }
  }

  // Update effects for a specific track (called from UI)
  updateEffects(track: Track): void {
    const nodes = this.trackNodes.get(track.id);
    if (nodes) this.updateTrackEffects(track, nodes);
  }

  // Schedule all notes for all tracks
  schedulePlayback(tracks: Track[], bpm: number, startTime: number = 0): void {
    // Clear any previously scheduled events
    this.clearSchedule();

    Tone.getTransport().bpm.value = bpm;

    // Check if any track has solo enabled
    const hasSolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      // Skip muted tracks, or non-solo tracks when solo is active
      const shouldPlay = hasSolo ? track.solo : !track.muted;
      if (!shouldPlay) return;
      if (track.type === 'audio') return; // Audio tracks handled separately later

      const nodes = this.ensureTrackNodes(track);

      track.clips.forEach((clip) => {
        clip.notes.forEach((note) => {
          // Absolute beat position = clip start + note position within clip
          const absoluteBeat = clip.startBeat + note.startBeat;

          // Convert beats to Tone.js time notation (bars:beats:sixteenths)
          const timeInSeconds = (absoluteBeat / bpm) * 60;
          const noteName = midiToNote(note.pitch);
          const durationInSeconds = (note.duration / bpm) * 60;
          const noteEndTime = timeInSeconds + durationInSeconds;
          const velocity = velocityToGain(note.velocity);

          // Note ends before our start position — skip entirely
          if (noteEndTime <= startTime) return;

          if (timeInSeconds < startTime) {
            // Note is mid-play at seek position — play the remaining portion immediately
            const remainingDuration = noteEndTime - startTime;

            const eventId = Tone.getTransport().schedule((time) => {
              if (nodes.synth instanceof Tone.PolySynth || nodes.synth instanceof Tone.Sampler) {
                nodes.synth.triggerAttackRelease(
                  noteName,
                  remainingDuration,
                  time,
                  velocity
                );
              }
            }, startTime);

            nodes.scheduledEvents.push(eventId);
            this.scheduledEvents.push(eventId);
          } else {
            // Note starts in the future — schedule normally
            const eventId = Tone.getTransport().schedule((time) => {
              if (nodes.synth instanceof Tone.PolySynth || nodes.synth instanceof Tone.Sampler) {
                nodes.synth.triggerAttackRelease(
                  noteName,
                  durationInSeconds,
                  time,
                  velocity
                );
              }
            }, timeInSeconds);

            nodes.scheduledEvents.push(eventId);
            this.scheduledEvents.push(eventId);
          }
        });
      });
    });

    // ─── Schedule audio clips ───
    tracks.forEach((track) => {
      if (track.type !== 'audio') return;
      const shouldPlay = hasSolo ? track.solo : !track.muted;
      if (!shouldPlay) return;

      const nodes = this.ensureTrackNodes(track);

      track.clips.forEach((clip) => {
        if (!clip.audioFileUrl) return;

        const clipStartTime = (clip.startBeat / bpm) * 60;
        const clipEndTime = ((clip.startBeat + clip.duration) / bpm) * 60;
        const audioOffsetSec = ((clip.audioOffset || 0) / bpm) * 60;

        if (clipEndTime <= startTime) return; // clip already finished

        // Get or create player for this clip
        let player = nodes.players.get(clip.id);
        if (!player) {
          player = new Tone.Player(clip.audioFileUrl).connect(nodes.gain);
          nodes.players.set(clip.id, player);
        }

        if (clipStartTime <= startTime) {
          // Clip is mid-play or starts at exactly the current time
          // Start immediately when transport starts (don't schedule, avoids race condition)
          const playOffset = audioOffsetSec + (startTime - clipStartTime);
          this._pendingAudioStarts.push({ player: player!, offset: playOffset });
        } else {
          const eventId = Tone.getTransport().schedule((time) => {
            if (player!.loaded) player!.start(time, audioOffsetSec);
          }, clipStartTime);
          nodes.scheduledEvents.push(eventId);
          this.scheduledEvents.push(eventId);
        }

        // Schedule stop at clip end
        const stopId = Tone.getTransport().schedule((time) => {
          if (player!.state === 'started') player!.stop(time);
        }, clipEndTime);
        nodes.scheduledEvents.push(stopId);
        this.scheduledEvents.push(stopId);
      });
    });
  }

  // Clear all scheduled events
  clearSchedule(): void {
    this.scheduledEvents.forEach((id) => {
      Tone.getTransport().clear(id);
    });
    this.scheduledEvents = [];
    this._pendingAudioStarts = [];
    this.trackNodes.forEach((nodes) => {
      nodes.scheduledEvents = [];
      nodes.automationEvents = [];
      // Stop any playing audio clips
      nodes.players.forEach((player) => {
        if (player.state === 'started') player.stop();
      });
    });
  }

  // Reschedule without stopping transport — seamless update during playback
  reschedule(tracks: Track[], bpm: number): void {
    this.clearSchedule();
    const currentTime = Tone.getTransport().seconds;
    this.schedulePlayback(tracks, bpm, currentTime);

    // Start any audio clips that should already be playing
    this._pendingAudioStarts.forEach(({ player, offset }) => {
      if (player.loaded) player.start(Tone.now(), offset);
    });
    this._pendingAudioStarts = [];
  }

  // Start playback
  async play(tracks: Track[], bpm: number, fromTime: number = 0): Promise<void> {
    this.schedulePlayback(tracks, bpm, fromTime);

    // Wait for all audio players to be loaded
    const loadPromises: Promise<void>[] = [];
    this.trackNodes.forEach((nodes) => {
      nodes.players.forEach((player) => {
        if (!player.loaded) {
          loadPromises.push(new Promise<void>((resolve) => {
            const check = () => {
              if (player.loaded) resolve();
              else setTimeout(check, 10);
            };
            check();
          }));
        }
      });
    });
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }

    // Apply volume automation immediately before starting transport
    const currentBeat = (fromTime * bpm) / 60;
    tracks.forEach((track) => {
      const points = track.volumeAutomation;
      if (!points || points.length === 0) return;

      let value: number = points[0].value;
      if (currentBeat <= points[0].beat) {
        value = points[0].value;
      } else if (currentBeat >= points[points.length - 1].beat) {
        value = points[points.length - 1].value;
      } else {
        for (let i = 0; i < points.length - 1; i++) {
          if (currentBeat >= points[i].beat && currentBeat < points[i + 1].beat) {
            const t = (currentBeat - points[i].beat) / (points[i + 1].beat - points[i].beat);
            value = points[i].value + t * (points[i + 1].value - points[i].value);
            break;
          }
        }
      }

      const vol = (value / 100) * (track.muted ? 0 : track.volume / 100);
      const nodes = this.trackNodes.get(track.id);
      if (nodes) nodes.gain.gain.value = vol;
    });

    Tone.getTransport().seconds = fromTime;
    Tone.getTransport().start();

    // Start any audio clips that should already be playing
    this._pendingAudioStarts.forEach(({ player, offset }) => {
      if (player.loaded) player.start(Tone.now(), offset);
    });
    this._pendingAudioStarts = [];
  }

  // Pause playback
  pause(): void {
    Tone.getTransport().pause();
    // Stop audio players immediately (synths handle pause via transport)
    this.trackNodes.forEach((nodes) => {
      nodes.players.forEach((player) => {
        if (player.state === 'started') player.stop();
      });
    });
  }

  // Stop and reset
  stop(): void {
    Tone.getTransport().stop();
    this.clearSchedule();
    this.releaseAllNotes();
  }

  // Release any currently sounding notes
  private releaseAllNotes(): void {
    this.trackNodes.forEach((nodes) => {
      if (nodes.synth instanceof Tone.PolySynth || nodes.synth instanceof Tone.Sampler) {
        nodes.synth.releaseAll();
      }
    });
  }

  // Get current transport time in seconds
  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  // Update track volume/pan/mute in real time (no re-schedule needed)
  updateTrackParams(track: Track): void {
    const nodes = this.trackNodes.get(track.id);
    if (nodes) {
      nodes.gain.gain.value = track.muted ? 0 : track.volume / 100;
      nodes.panner.pan.value = track.pan / 100;
    }
  }

  // Set a track's gain directly (used by real-time automation)
  setTrackGain(trackId: number, value: number): void {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.gain.gain.value = value;
    }
  }

  // Rebuild a track's synth when instrument preset changes
  rebuildTrackSynth(track: Track): void {
    const nodes = this.trackNodes.get(track.id);
    if (nodes) {
      // Release and dispose old synth
      if (nodes.synth instanceof Tone.PolySynth || nodes.synth instanceof Tone.Sampler) {
        nodes.synth.releaseAll();
      } else if (nodes.synth instanceof Tone.Sampler) {
        nodes.synth.releaseAll();
      }
      nodes.synth.dispose();

      // Create new synth with updated preset
      const newSynth = this.createSynth(track.instrument, track.type);
      newSynth.connect(nodes.gain);
      nodes.synth = newSynth;
      nodes.samplerLoaded = newSynth instanceof Tone.Sampler ? false : true;
    }
  }

  // Set BPM
  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  // Ensure preview synth exists
  private ensurePreviewSynth(): void {
    if (!this.previewSynth) {
      this.previewGain = new Tone.Gain(0.5).toDestination();
      this.previewSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.02,
          decay: 0.3,
          sustain: 0.4,
          release: 0.6,
        },
      }).connect(this.previewGain);
    }
  }

  // Set the release time on the preview synth (for sustain mode)
  setPreviewRelease(seconds: number): void {
    this.ensurePreviewSynth();
    if (this.previewSynth && this.previewSynth instanceof Tone.PolySynth) {
      this.previewSynth.set({ envelope: { release: seconds } });
    }
  }

  // Rebuild the preview synth to match a track's instrument
  rebuildPreviewSynth(instrument: string): void {
    if (!this.isInitialized) return;

    // Release and dispose old preview synth
    if (this.previewSynth) {
      this.activePreviewNotes.forEach((n) => this.previewSynth!.triggerRelease(n));
      this.activePreviewNotes.clear();
      this.previewSynth.dispose();
      this.previewSynth = null;
    }

    // Create new one with the instrument's sound
    if (!this.previewGain) {
      this.previewGain = new Tone.Gain(0.5).toDestination();
    }
    this.previewSynth = this.createSynth(instrument as any, 'instrument');
    this.previewSynth.connect(this.previewGain);
  }

  // Play a preview note (supports chords — multiple simultaneous notes)
  previewNoteOn(pitch: number, velocity: number = 100): void {
    if (!this.isInitialized) return;
    this.ensurePreviewSynth();

    const noteName = midiToNote(pitch);

    // Don't re-trigger if already playing
    if (this.activePreviewNotes.has(noteName)) return;

    // If it's a Sampler, check that buffers are loaded
    if (this.previewSynth instanceof Tone.Sampler) {
      if (!this.previewSynth.loaded) return; // silently skip — buffers still loading
    }

    this.previewSynth!.triggerAttack(noteName, undefined, velocityToGain(velocity));
    this.activePreviewNotes.add(noteName);
  }

  // Update preview to a new pitch (while dragging — seamless pitch change)
  previewNoteChange(pitch: number, velocity: number = 100): void {
    if (!this.isInitialized || !this.previewSynth) return;
    if (this.previewSynth instanceof Tone.Sampler && !this.previewSynth.loaded) return;

    const noteName = midiToNote(pitch);
    if (this.activePreviewNotes.has(noteName)) return;

    // Release all current notes and play the new one
    this.activePreviewNotes.forEach((n) => this.previewSynth!.triggerRelease(n));
    this.activePreviewNotes.clear();

    this.previewSynth.triggerAttack(noteName, undefined, velocityToGain(velocity));
    this.activePreviewNotes.add(noteName);
  }

  // Stop a specific preview note
  previewNoteOffSingle(pitch: number): void {
    if (!this.previewSynth) return;
    const noteName = midiToNote(pitch);
    if (this.activePreviewNotes.has(noteName)) {
      this.previewSynth.triggerRelease(noteName);
      this.activePreviewNotes.delete(noteName);
    }
  }

  // Stop all preview notes
  previewNoteOff(): void {
    if (!this.previewSynth || this.activePreviewNotes.size === 0) return;
    this.activePreviewNotes.forEach((n) => this.previewSynth!.triggerRelease(n));
    this.activePreviewNotes.clear();
  }

  // Clean up everything
  dispose(): void {
    this.stop();
    this.previewNoteOff();
    if (this.previewSynth) {
      this.previewSynth.dispose();
      this.previewSynth = null;
    }
    if (this.previewGain) {
      this.previewGain.dispose();
      this.previewGain = null;
    }
    this.trackNodes.forEach((nodes) => {
      nodes.synth.dispose();
      nodes.gain.dispose();
      nodes.panner.dispose();
    });
    this.trackNodes.clear();
  }
}

// Singleton instance
const audioEngine = new AudioEngine();
export default audioEngine;