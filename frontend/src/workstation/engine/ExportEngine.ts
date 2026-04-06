import * as Tone from 'tone';
import { Track, InstrumentPreset } from '../models/types';
import { getPreset } from '../models/presets';
import useDawStore from '../state/dawStore';

// Convert MIDI note number to note name
const midiToNote = (midi: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteNames[midi % 12]}${octave}`;
};

const velocityToGain = (velocity: number): number => velocity / 127;

// Create a synth for offline rendering
// Note: Samplers don't work in Tone.Offline, so we fall back to a basic synth
// Per-preset volume normalization (dB) — mirrors AudioEngine values
const PRESET_GAIN_DB: Record<string, number> = {
  'salamander-piano': -6, 'organ': -4, 'harmonium': -3,
  'violin': -2, 'cello': -2, 'contrabass': -3, 'harp': -4,
  'trumpet': -5, 'trombone': -5, 'french-horn': -5, 'tuba': -6,
  'flute': -2, 'clarinet': -2, 'bassoon': -3, 'saxophone': -4,
  'guitar-acoustic': -3, 'guitar-electric': -4, 'guitar-nylon': -3,
  'bass-electric': -4, 'xylophone': -3,
  'saw-lead': -8, 'square-lead': -7, 'fm-lead': 0, 'fat-lead': -10, 'pwm-lead': -7,
  'warm-pad': -5, 'string-pad': -5, 'glass-pad': -3, 'am-pad': -4,
  'sub-bass': -6, 'saw-bass': -8, 'fm-bass': -4, 'reese-bass': -9,
  'pluck': -2, 'fm-pluck': -1, 'kalimba': -1, 'membrane': -4, 'metal': -8,
};

function createSynth(presetId: InstrumentPreset): Tone.PolySynth {
  const preset = getPreset(presetId);

  let synth: Tone.PolySynth;

  // Sampler presets can't load in offline context — use a basic synth fallback
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
    synth = new Tone.PolySynth(SynthClass, cfg.options);
  } else {
    // Fallback for sampler presets or unknown
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
    });
  }

  const gainDb = PRESET_GAIN_DB[presetId as string];
  if (gainDb !== undefined && gainDb !== 0) {
    synth.volume.value = gainDb;
  }
  return synth;
}

// Calculate the end time of the project in seconds
function getProjectDuration(tracks: Track[], bpm: number): number {
  let maxBeat = 0;
  for (const track of tracks) {
    if (track.muted) continue;
    for (const clip of track.clips) {
      const endBeat = clip.startBeat + clip.duration;
      if (endBeat > maxBeat) maxBeat = endBeat;
    }
  }
  // Add a little tail for reverb/delay to ring out
  return ((maxBeat + 2) / bpm) * 60;
}

// Interpolate automation value at a given beat
function getAutomationValue(points: { beat: number; value: number }[], beat: number): number {
  if (!points || points.length === 0) return 100;
  if (beat <= points[0].beat) return points[0].value;
  if (beat >= points[points.length - 1].beat) return points[points.length - 1].value;

  for (let i = 0; i < points.length - 1; i++) {
    if (beat >= points[i].beat && beat < points[i + 1].beat) {
      const t = (beat - points[i].beat) / (points[i + 1].beat - points[i].beat);
      return points[i].value + t * (points[i + 1].value - points[i].value);
    }
  }
  return points[points.length - 1].value;
}

// Render the project to an AudioBuffer using Tone.Offline
async function renderOffline(): Promise<{ buffer: AudioBuffer; projectName: string }> {
  const { tracks, bpm, projectName } = useDawStore.getState();
  const hasSolo = tracks.some((t) => t.solo);
  const duration = getProjectDuration(tracks, bpm);

  if (duration <= 0) throw new Error('Project is empty');

  // Pre-load all audio clip buffers before entering offline context
  const audioBuffers = new Map<number, Tone.ToneAudioBuffer>();
  for (const track of tracks) {
    if (track.type !== 'audio') continue;
    const shouldPlay = hasSolo ? track.solo : !track.muted;
    if (!shouldPlay) continue;

    for (const clip of track.clips) {
      if (!clip.audioFileUrl) continue;
      try {
        const buf = new Tone.ToneAudioBuffer();
        await buf.load(clip.audioFileUrl);
        audioBuffers.set(clip.id, buf);
      } catch (err) {
        console.warn(`Failed to load audio for clip ${clip.id}:`, err);
      }
    }
  }

  const buffer = await Tone.Offline(({ transport }) => {
    transport.bpm.value = bpm;

    for (const track of tracks) {
      const shouldPlay = hasSolo ? track.solo : !track.muted;
      if (!shouldPlay) continue;

      // Create signal chain for this track
      const destination = Tone.getDestination();
      const panner = new Tone.Panner(track.pan / 100).connect(destination);
      const dryGain = new Tone.Gain(1).connect(panner);
      const gain = new Tone.Gain(track.volume / 100).connect(dryGain);

      // Effects
      const fx = track.effects;
      if (fx && fx.reverbMix > 0) {
        const reverb = new Tone.Reverb({ decay: fx.reverbDecay, wet: 1 }).connect(panner);
        const reverbSend = new Tone.Gain(fx.reverbMix / 100).connect(reverb);
        dryGain.connect(reverbSend);
      }
      if (fx && fx.delayMix > 0) {
        const delay = new Tone.FeedbackDelay({
          delayTime: fx.delayTime,
          feedback: fx.delayFeedback / 100,
          wet: 1,
        }).connect(panner);
        const delaySend = new Tone.Gain(fx.delayMix / 100).connect(delay);
        dryGain.connect(delaySend);
      }
      if (fx && fx.filterEnabled) {
        const filter = new Tone.Filter(fx.filterFreq, fx.filterType).connect(dryGain);
        gain.disconnect(dryGain);
        gain.connect(filter);
      }

      // Volume automation — schedule gain changes
      if (track.volumeAutomation && track.volumeAutomation.length > 0) {
        const points = track.volumeAutomation;
        const stepSize = 0.05; // 50ms intervals
        for (let t = 0; t < duration; t += stepSize) {
          const beat = (t * bpm) / 60;
          const autoVal = getAutomationValue(points, beat);
          const vol = (autoVal / 100) * (track.volume / 100);
          transport.schedule((time) => {
            gain.gain.setValueAtTime(vol, time);
          }, t);
        }
      }

      if (track.type === 'audio') {
        // Schedule audio clips using pre-loaded buffers
        for (const clip of track.clips) {
          const audioBuf = audioBuffers.get(clip.id);
          if (!audioBuf) continue;

          const clipStartTime = (clip.startBeat / bpm) * 60;
          const audioOffsetSec = ((clip.audioOffset || 0) / bpm) * 60;

          const player = new Tone.Player(audioBuf).connect(gain);
          transport.schedule((time) => {
            player.start(time, audioOffsetSec);
          }, clipStartTime);
        }
      } else {
        // Schedule MIDI notes
        const synth = createSynth(track.instrument);
        synth.connect(gain);

        for (const clip of track.clips) {
          for (const note of clip.notes) {
            const absoluteBeat = clip.startBeat + note.startBeat;
            const timeInSeconds = (absoluteBeat / bpm) * 60;
            const durationInSeconds = (note.duration / bpm) * 60;
            const noteName = midiToNote(note.pitch);
            const velocity = velocityToGain(note.velocity);

            transport.schedule((time) => {
              synth.triggerAttackRelease(noteName, durationInSeconds, time, velocity);
            }, timeInSeconds);
          }
        }
      }
    }

    transport.start(0);
  }, duration);

  return { buffer, projectName };
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, headerSize + dataSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);              // chunk size
  view.setUint16(20, format, true);           // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Clamp
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Trigger a file download
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export as WAV
export async function exportToWav(): Promise<void> {
  const { buffer, projectName } = await renderOffline();
  const wav = audioBufferToWav(buffer);
  const filename = `${projectName || 'Untitled'}.wav`;
  downloadBlob(wav, filename);
}

// Dynamically load lamejs from CDN (cached after first load)
let lamejsPromise: Promise<any> | null = null;
function loadLamejs(): Promise<any> {
  if (lamejsPromise) return lamejsPromise;
  lamejsPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).lamejs) {
      resolve((window as any).lamejs);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
    script.onload = () => {
      const lame = (window as any).lamejs || (window as any).Lame || (window as any).lame;
      if (lame) {
        resolve(lame);
      } else {
        reject(new Error('lamejs loaded but not available on window'));
      }
    };
    script.onerror = () => {
      lamejsPromise = null;
      reject(new Error('Failed to load lamejs from CDN'));
    };
    document.head.appendChild(script);
  });
  return lamejsPromise;
}

// Export as MP3
export async function exportToMp3(): Promise<void> {
  let lamejs: any;
  try {
    lamejs = await loadLamejs();
  } catch (err) {
    console.warn('lamejs not available, exporting as WAV instead', err);
    alert('MP3 encoding library could not be loaded. Exporting as WAV instead.');
    return exportToWav();
  }

  const { buffer, projectName } = await renderOffline();

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const samples = buffer.length;

  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 192);
  const mp3Data: Uint8Array[] = [];

  // Convert float samples to int16
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  const left = new Int16Array(samples);
  const right = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    left[i] = Math.max(-32768, Math.min(32767, Math.round(leftChannel[i] * 32767)));
    right[i] = Math.max(-32768, Math.min(32767, Math.round(rightChannel[i] * 32767)));
  }

  // Encode in chunks
  const chunkSize = 1152;
  for (let i = 0; i < samples; i += chunkSize) {
    const leftChunk = left.subarray(i, i + chunkSize);
    const rightChunk = right.subarray(i, i + chunkSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }

  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  const blob = new Blob(mp3Data, { type: 'audio/mp3' });
  downloadBlob(blob, `${projectName || 'Untitled'}.mp3`);
}

/** Render the project to an MP3 Blob (for publishing — no download) */
export async function renderToMp3Blob(): Promise<Blob> {
  let lamejs: any;
  try {
    lamejs = await loadLamejs();
  } catch {
    // Fallback to WAV blob
    const { buffer } = await renderOffline();
    const wav = audioBufferToWav(buffer);
    return wav;
  }

  const { buffer } = await renderOffline();
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const samples = buffer.length;

  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 192);
  const mp3Data: Uint8Array[] = [];

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  const left = new Int16Array(samples);
  const right = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    left[i] = Math.max(-32768, Math.min(32767, Math.round(leftChannel[i] * 32767)));
    right[i] = Math.max(-32768, Math.min(32767, Math.round(rightChannel[i] * 32767)));
  }

  const chunkSize = 1152;
  for (let i = 0; i < samples; i += chunkSize) {
    const leftChunk = left.subarray(i, i + chunkSize);
    const rightChunk = right.subarray(i, i + chunkSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }

  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}