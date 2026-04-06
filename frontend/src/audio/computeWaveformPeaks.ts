/**
 * Decode audio from URL and build normalized peak samples (SoundCloud-style bars).
 * Results are cached per URL to avoid re-decoding when reopening the same track.
 */

const DEFAULT_BAR_COUNT = 360;

const cache = new Map<string, number[]>();

let sharedCtx: AudioContext | null = null;

// Serialize decoding so only one track decodes at a time (prevents main-thread jank)
let decodeQueue: Promise<void> = Promise.resolve();

function getDecodeContext(): AudioContext {
    if (!sharedCtx || sharedCtx.state === 'closed') {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        sharedCtx = new AC();
    }
    return sharedCtx;
}

export function clearWaveformCache(audioUrl?: string): void {
    if (audioUrl) cache.delete(audioUrl);
    else cache.clear();
}

export function computeWaveformPeaks(
    audioUrl: string,
    barCount: number = DEFAULT_BAR_COUNT,
    signal?: AbortSignal,
): Promise<number[]> {
    const cached = cache.get(audioUrl);
    if (cached) return Promise.resolve(cached);

    // Queue decoding so only one runs at a time
    const job = decodeQueue.then(async () => {
        // Check cache again (may have been decoded while queued)
        const cached2 = cache.get(audioUrl);
        if (cached2) return cached2;
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const res = await fetch(audioUrl, {
            mode: 'cors',
            credentials: 'omit',
            signal,
        });
        if (!res.ok) throw new Error(`Waveform fetch failed: ${res.status}`);

        const arrayBuffer = await res.arrayBuffer();
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const ctx = getDecodeContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

        const channels = audioBuffer.numberOfChannels;
        const len = audioBuffer.length;
        const merged = new Float32Array(len);
        for (let c = 0; c < channels; c++) {
            const data = audioBuffer.getChannelData(c);
            for (let i = 0; i < len; i++) merged[i] += data[i];
        }
        const inv = 1 / channels;
        for (let i = 0; i < len; i++) merged[i] *= inv;

        const samplesPerBar = Math.max(1, Math.floor(len / barCount));
        const peaks: number[] = [];
        let maxPeak = 0;

        for (let b = 0; b < barCount; b++) {
            const start = b * samplesPerBar;
            const end = Math.min(start + samplesPerBar, len);
            let peak = 0;
            for (let i = start; i < end; i++) {
                const v = Math.abs(merged[i]);
                if (v > peak) peak = v;
            }
            peaks.push(peak);
            if (peak > maxPeak) maxPeak = peak;
        }

        if (maxPeak > 0) {
            for (let i = 0; i < peaks.length; i++) peaks[i] /= maxPeak;
        }

        cache.set(audioUrl, peaks);
        return peaks;
    });

    // Keep the queue moving even if one job fails
    decodeQueue = job.catch(() => {});
    return job;
}
