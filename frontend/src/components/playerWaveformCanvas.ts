/**
 * Mirrored pill-bar waveform (SoundCloud-style). Progress fill and playhead share one X (clip edge).
 */

export type WaveformPalette = {
    unplayed: string;
    /** Gradient bottom (darker) */
    playedLo: string;
    /** Optional mid stop for a richer vertical gradient */
    playedMid?: string;
    /** Gradient top (brighter) */
    playedHi: string;
    playhead: string;
};

/** Track page: soft violet unplayed bars; played = cyan/blue → indigo → violet (Sonara accent) */
export const SONARA_TRACK_WAVEFORM_PALETTE: WaveformPalette = {
    unplayed: 'rgba(196, 181, 253, 0.32)',
    playedLo: '#0ea5e9',
    playedMid: '#6366f1',
    playedHi: '#c084fc',
    playhead: 'rgba(15, 15, 26, 0.92)',
};

function fillPillBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    bw: number,
    ph: number,
) {
    if (ph < 0.5) return;
    const rr = Math.min(bw * 0.5, ph * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, bw, ph, rr);
    } else {
        ctx.rect(x, y, bw, ph);
    }
    ctx.fill();
}

export function drawMirroredWaveform(
    canvas: HTMLCanvasElement,
    cssWidth: number,
    cssHeight: number,
    peaks: number[],
    progress: number,
    palette: WaveformPalette,
    options?: { showPlayhead?: boolean },
) {
    const showPlayhead = options?.showPlayhead !== false;
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const w = Math.max(1, Math.floor(cssWidth * dpr));
    const h = Math.max(1, Math.floor(cssHeight * dpr));

    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx || peaks.length === 0) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const n = peaks.length;
    const playheadX = Math.min(w, Math.max(0, progress * w));
    const gapPx = Math.max(dpr * 0.65, 0.65);
    const slotW = (w - gapPx * Math.max(0, n - 1)) / n;

    const cy = h * 0.5;
    const minHalfCss = 2;
    const maxHalfCss = Math.max(minHalfCss + 2, cssHeight * 0.5 - 3);

    const halfHeightAt = (peak: number) => (minHalfCss + peak * (maxHalfCss - minHalfCss)) * dpr;

    const drawAllBars = (paint: CanvasGradient | string) => {
        ctx.fillStyle = paint;
        for (let i = 0; i < n; i++) {
            const half = halfHeightAt(peaks[i]);
            const x = i * (slotW + gapPx);
            const bw = Math.max(dpr * 1.15, slotW);
            const ph = 2 * half;
            const y = cy - half;
            fillPillBar(ctx, x, y, bw, ph);
        }
    };

    drawAllBars(palette.unplayed);

    const p = Math.min(1, Math.max(0, progress));
    if (p > 0.0001) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, playheadX, h);
        ctx.clip();
        const g = ctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, palette.playedLo);
        if (palette.playedMid) {
            g.addColorStop(0.48, palette.playedMid);
            g.addColorStop(1, palette.playedHi);
        } else {
            g.addColorStop(0.55, palette.playedLo);
            g.addColorStop(1, palette.playedHi);
        }
        drawAllBars(g);
        ctx.restore();
    }

    if (showPlayhead && p > 0.0001) {
        const lineW = Math.max(1.25, dpr * 1.25);
        ctx.fillStyle = palette.playhead;
        ctx.fillRect(playheadX - lineW / 2, 0, lineW, h);
    }
}
