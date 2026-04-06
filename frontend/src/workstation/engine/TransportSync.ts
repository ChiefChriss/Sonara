import audioEngine from './AudioEngine';
import useDawStore from '../state/dawStore';
import { Track } from '../models/types';

let animationFrameId: number | null = null;
let unsubscribeTracks: (() => void) | null = null;

// Sync the Zustand store's currentTime with Tone.Transport using rAF
const startPlayheadSync = () => {
  const update = () => {
    const { isPlaying, setCurrentTime, loopEnabled, loopStart, loopEnd, bpm, tracks } = useDawStore.getState();
    if (isPlaying) {
      const currentTime = audioEngine.getCurrentTime();

      // Loop check: if past loop end, jump back to loop start
      if (loopEnabled && loopEnd > loopStart) {
        const loopEndTime = (loopEnd / bpm) * 60;
        const loopStartTime = (loopStart / bpm) * 60;
        if (currentTime >= loopEndTime) {
          audioEngine.stop();
          audioEngine.play(tracks, bpm, loopStartTime);
          setCurrentTime(loopStartTime);
          animationFrameId = requestAnimationFrame(update);
          return;
        }
      }

      // ─── Real-time volume automation ───
      // Use the same currentTime that drives the playhead visual
      const currentBeat = (currentTime * bpm) / 60;
      applyAutomation(tracks, currentBeat);

      setCurrentTime(currentTime);
      animationFrameId = requestAnimationFrame(update);
    }
  };
  animationFrameId = requestAnimationFrame(update);
};

// Interpolate automation value at a given beat and apply to gain nodes
const applyAutomation = (tracks: Track[], beat: number) => {
  tracks.forEach((track) => {
    const points = track.volumeAutomation;
    if (!points || points.length === 0) return;

    let value: number = points[0].value;
    if (beat <= points[0].beat) {
      value = points[0].value;
    } else if (beat >= points[points.length - 1].beat) {
      value = points[points.length - 1].value;
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        if (beat >= points[i].beat && beat < points[i + 1].beat) {
          const t = (beat - points[i].beat) / (points[i + 1].beat - points[i].beat);
          value = points[i].value + t * (points[i + 1].value - points[i].value);
          break;
        }
      }
    }

    const vol = (value / 100) * (track.muted ? 0 : track.volume / 100);
    audioEngine.setTrackGain(track.id, vol);
  });
};

const stopPlayheadSync = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

// Subscribe to track/mute/solo changes and reschedule during playback
const startTrackSubscription = () => {
  if (unsubscribeTracks) return; // Already subscribed

  let previousTracks = useDawStore.getState().tracks;

  unsubscribeTracks = useDawStore.subscribe((state) => {
    // Only reschedule if tracks actually changed and we're playing
    if (state.tracks !== previousTracks && state.isPlaying) {
      previousTracks = state.tracks;

      // Debounce: reschedule on next animation frame to batch rapid updates
      requestAnimationFrame(() => {
        const { tracks, bpm } = useDawStore.getState();
        audioEngine.reschedule(tracks, bpm);
      });
    } else {
      previousTracks = state.tracks;
    }
  });
};

const stopTrackSubscription = () => {
  if (unsubscribeTracks) {
    unsubscribeTracks();
    unsubscribeTracks = null;
  }
};

// Initialize the engine (call from a user gesture)
export const initAudio = async () => {
  await audioEngine.initialize();
};

// Play: schedule notes and start transport
export const play = async () => {
  const { tracks, bpm, currentTime } = useDawStore.getState();

  if (!audioEngine.isReady()) {
    console.warn('Audio engine not initialized. Call initAudio() first.');
    return;
  }

  await audioEngine.play(tracks, bpm, currentTime);

  // Apply automation immediately so gain is correct from the first note
  const currentBeat = (currentTime * bpm) / 60;
  applyAutomation(tracks, currentBeat);

  startPlayheadSync();
  startTrackSubscription();
};

// Pause: keep position but fully stop engine
export const pause = () => {
  audioEngine.stop();
  stopPlayheadSync();
  stopTrackSubscription();
};

// Stop: reset to beginning
export const stop = () => {
  audioEngine.stop();
  stopPlayheadSync();
  stopTrackSubscription();
  useDawStore.getState().setCurrentTime(0);
};

// Rewind: go to start without stopping play state
export const rewind = () => {
  const { isPlaying, tracks, bpm } = useDawStore.getState();
  audioEngine.stop();
  useDawStore.getState().setCurrentTime(0);

  if (isPlaying) {
    audioEngine.play(tracks, bpm, 0);
  }
};

// Seek: jump to a specific time in seconds
export const seek = (timeInSeconds: number) => {
  const { isPlaying, tracks, bpm } = useDawStore.getState();
  audioEngine.stop();
  useDawStore.getState().setCurrentTime(timeInSeconds);

  if (isPlaying) {
    audioEngine.play(tracks, bpm, timeInSeconds);
  }
};

// Called when tracks/clips change during playback — reschedule
export const reschedule = () => {
  const { isPlaying, tracks, bpm, currentTime } = useDawStore.getState();
  if (isPlaying) {
    audioEngine.stop();
    audioEngine.play(tracks, bpm, currentTime);
  }
};

// Update BPM in real time
export const updateBpm = (newBpm: number) => {
  const { isPlaying, tracks, currentTime, bpm: oldBpm } = useDawStore.getState();

  if (isPlaying) {
    // Convert current position from seconds to beats (using old BPM),
    // then back to seconds using the new BPM
    const currentBeat = (currentTime / 60) * oldBpm;
    const newTimeInSeconds = (currentBeat / newBpm) * 60;

    // Stop, reschedule with new BPM from the correct position
    audioEngine.stop();
    useDawStore.getState().setCurrentTime(newTimeInSeconds);
    audioEngine.play(tracks, newBpm, newTimeInSeconds);
  } else {
    // Not playing — just convert the playhead position
    const currentBeat = (currentTime / 60) * oldBpm;
    const newTimeInSeconds = (currentBeat / newBpm) * 60;
    audioEngine.setBpm(newBpm);
    useDawStore.getState().setCurrentTime(newTimeInSeconds);
  }
};

// Preview note methods for piano roll interaction
export const previewNoteOn = (pitch: number, velocity?: number) => {
  audioEngine.previewNoteOn(pitch, velocity);
};

export const previewNoteChange = (pitch: number, velocity?: number) => {
  audioEngine.previewNoteChange(pitch, velocity);
};

export const previewNoteOff = () => {
  audioEngine.previewNoteOff();
};

export const previewNoteOffSingle = (pitch: number) => {
  audioEngine.previewNoteOffSingle(pitch);
};

export const setPreviewRelease = (seconds: number) => {
  audioEngine.setPreviewRelease(seconds);
};

export const rebuildPreviewSynth = (instrument: string) => {
  audioEngine.rebuildPreviewSynth(instrument);
};

export const updateEffects = (track: Track) => {
  audioEngine.updateEffects(track);
};

export const updateTrackParams = (track: Track) => {
  audioEngine.updateTrackParams(track);
};

// Rebuild a track's synth when instrument changes
export const rebuildTrackSynth = (track: Track) => {
  audioEngine.rebuildTrackSynth(track);
  // Reschedule if playing so the new sound is used
  const { isPlaying, tracks, bpm } = useDawStore.getState();
  if (isPlaying) {
    audioEngine.reschedule(tracks, bpm);
  }
};

// Clean up on unmount
export const dispose = () => {
  stopPlayheadSync();
  stopTrackSubscription();
  audioEngine.dispose();
};

// Sampler loading state
export const isTrackSamplerLoaded = (trackId: number): boolean => {
  return audioEngine.isTrackSamplerLoaded(trackId);
};

export const onSamplerLoad = (cb: () => void): (() => void) => {
  return audioEngine.onSamplerLoad(cb);
};