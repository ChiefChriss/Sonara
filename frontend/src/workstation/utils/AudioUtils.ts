// Shared audio file decode + waveform peak generation

export interface AudioFileData {
  name: string;
  url: string;
  durationBeats: number;
  peaks: number[];
}

export async function decodeAudioFile(file: File, bpm: number): Promise<AudioFileData> {
  const url = URL.createObjectURL(file);

  const arrayBuffer = await file.arrayBuffer();

  let decoded: AudioBuffer;
  try {
    // Try OfflineAudioContext first (doesn't need user gesture)
    const offlineCtx = new OfflineAudioContext(2, 44100, 44100);
    decoded = await offlineCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    // Fallback to regular AudioContext
    const audioCtx = new AudioContext();
    await audioCtx.resume();
    decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    audioCtx.close();
  }

  const durationBeats = (decoded.duration * bpm) / 60;

  // Generate waveform peaks (high resolution for zoom)
  const channelData = decoded.getChannelData(0);
  const numPeaks = 500;
  const samplesPerPeak = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    let max = 0;
    for (let j = 0; j < samplesPerPeak; j++) {
      const abs = Math.abs(channelData[i * samplesPerPeak + j] || 0);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  const name = file.name.replace(/\.[^.]+$/, '');

  return { name, url, durationBeats, peaks };
}