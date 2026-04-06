import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { computeWaveformPeaks } from '../audio/computeWaveformPeaks';
import { drawMirroredWaveform, SONARA_TRACK_WAVEFORM_PALETTE } from './playerWaveformCanvas';

type Props = {
    audioUrl: string;
    /** True when this page’s track is the one loaded in the global player */
    isActive: boolean;
    /** Pixel height of the waveform strip (taller = more “SoundCloud” hero) */
    waveHeight?: number;
    /** Hero layout: stronger frame + border to match track page card */
    variant?: 'default' | 'hero';
};

const DEFAULT_H = 88;

/**
 * Mirrored waveform for track/publication detail. Blue→purple gradient when playing.
 */
const TrackPageWaveform = ({ audioUrl, isActive, waveHeight = DEFAULT_H, variant = 'default' }: Props) => {
    const visibilityRef = useRef<HTMLDivElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastProgressRef = useRef(0);
    const scrubTimeRef = useRef<number | null>(null);
    const scrubbingRef = useRef(false);

    const [peaks, setPeaks] = useState<number[] | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [scrubTime, setScrubTime] = useState<number | null>(null);

    const duration = usePlayerStore((s) => (isActive ? s.duration : 0));
    const isPlaying = usePlayerStore((s) => (isActive ? s.isPlaying : false));
    const seek = usePlayerStore((s) => s.seek);
    // Only read currentTime when paused to avoid re-renders every frame during playback
    const storeTime = usePlayerStore((s) => (isActive && !s.isPlaying ? s.currentTime : 0));

    const hostStyle = useMemo((): CSSProperties => {
        const base: CSSProperties = {
            width: '100%',
            height: waveHeight,
            boxSizing: 'border-box',
            borderRadius: variant === 'hero' ? 12 : 6,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'stretch',
        };
        if (variant === 'hero') {
            return {
                ...base,
                background: 'linear-gradient(180deg, rgba(30,27,58,0.75) 0%, rgba(15,15,26,0.92) 100%)',
                border: '1px solid rgba(167, 139, 250, 0.28)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 40px rgba(0,0,0,0.35)',
            };
        }
        return {
            ...base,
            background: 'rgba(0,0,0,0.35)',
        };
    }, [waveHeight, variant]);

    useEffect(() => {
        scrubTimeRef.current = scrubTime;
    }, [scrubTime]);

    const runDraw = useCallback(
        (progress: number) => {
            const canvas = canvasRef.current;
            const host = hostRef.current;
            if (!canvas || !host || !peaks?.length) return;
            const rect = host.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return;
            const p = Math.min(1, Math.max(0, progress));
            lastProgressRef.current = p;
            drawMirroredWaveform(canvas, rect.width, rect.height, peaks, p, SONARA_TRACK_WAVEFORM_PALETTE, {
                showPlayhead: isActive && duration > 0,
            });
        },
        [peaks, isActive, duration],
    );

    // Only decode audio when visible on screen
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const el = visibilityRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
            { rootMargin: '200px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        const ac = new AbortController();
        setLoadError(false);
        setPeaks(null);
        computeWaveformPeaks(audioUrl, undefined, ac.signal)
            .then(setPeaks)
            .catch(() => {
                if (!ac.signal.aborted) setLoadError(true);
            });
        return () => ac.abort();
    }, [audioUrl, isVisible]);

    const progressFromStore = duration > 0 ? storeTime / duration : 0;

    useLayoutEffect(() => {
        if (!peaks?.length) return;
        if (!isActive) {
            runDraw(0);
            return;
        }
        if (isPlaying) return;
        const t = duration > 0 ? (scrubTime ?? storeTime) / duration : 0;
        runDraw(t);
    }, [peaks, isActive, isPlaying, duration, scrubTime, storeTime, runDraw]);

    useEffect(() => {
        if (!peaks?.length || !isPlaying || !isActive) return;
        let cancelled = false;
        const rafRef = { id: 0 };
        const tick = () => {
            if (cancelled) return;
            const audio = usePlayerStore.getState()._audio;
            const d = duration;
            let prog = 0;
            if (scrubbingRef.current && scrubTimeRef.current != null && d > 0) {
                prog = scrubTimeRef.current / d;
            } else if (audio && d > 0 && !audio.paused) {
                prog = audio.currentTime / d;
            } else {
                prog = lastProgressRef.current;
            }
            runDraw(prog);
            rafRef.id = requestAnimationFrame(tick);
        };
        rafRef.id = requestAnimationFrame(tick);
        return () => {
            cancelled = true;
            cancelAnimationFrame(rafRef.id);
        };
    }, [peaks, isPlaying, isActive, duration, runDraw]);

    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el || !peaks?.length) return;
        const ro = new ResizeObserver(() => runDraw(lastProgressRef.current));
        ro.observe(el);
        return () => ro.disconnect();
    }, [peaks, runDraw]);

    const seekFromClientX = useCallback(
        (clientX: number) => {
            if (!isActive || !duration) return;
            const el = hostRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const t = pct * duration;
            seek(t);
            setScrubTime(t);
            scrubTimeRef.current = t;
            runDraw(pct);
        },
        [isActive, duration, seek, runDraw],
    );

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (!isActive || !duration) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            scrubbingRef.current = true;
            seekFromClientX(e.clientX);
        },
        [isActive, duration, seekFromClientX],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!scrubbingRef.current) return;
            seekFromClientX(e.clientX);
        },
        [seekFromClientX],
    );

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (scrubbingRef.current) {
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
        }
        scrubbingRef.current = false;
        setScrubTime(null);
        scrubTimeRef.current = null;
    }, []);

    if (loadError) {
        return (
            <div ref={visibilityRef} style={{ ...styles.placeholder, height: waveHeight, borderRadius: variant === 'hero' ? 12 : 6 }}>
                <div style={styles.placeholderInner} />
            </div>
        );
    }

    if (!peaks) {
        return (
            <div
                ref={visibilityRef}
                style={{
                    ...styles.skeletonHost,
                    height: waveHeight,
                    borderRadius: variant === 'hero' ? 12 : 6,
                    background: variant === 'hero' ? 'rgba(19,19,31,0.6)' : 'rgba(0,0,0,0.25)',
                    border: variant === 'hero' ? '1px solid rgba(167, 139, 250, 0.15)' : undefined,
                }}
            >
                {Array.from({ length: 100 }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            ...styles.skeletonBar,
                            height: `${30 + (i % 7) * 8}%`,
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            ref={hostRef}
            role={isActive && duration ? 'slider' : undefined}
            aria-valuenow={isActive && duration ? Math.round(progressFromStore * 100) : undefined}
            aria-hidden={!isActive || !duration}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
                ...hostStyle,
                cursor: isActive && duration ? 'pointer' : 'default',
                touchAction: isActive && duration ? 'none' : undefined,
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', flex: 1, minHeight: 0 }} />
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    skeletonHost: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'stretch',
        gap: 2,
        width: '100%',
        padding: '0 6px',
        boxSizing: 'border-box' as const,
    },
    skeletonBar: {
        flex: 1,
        minWidth: 2,
        maxWidth: 4,
        background: 'rgba(167, 139, 250, 0.15)',
        borderRadius: 2,
        opacity: 0.7,
    },
    placeholder: {
        borderRadius: 6,
        background: 'rgba(19,19,31,0.5)',
        display: 'flex',
        alignItems: 'center',
        border: '1px solid rgba(167, 139, 250, 0.12)',
    },
    placeholderInner: {
        width: '100%',
        height: 4,
        margin: '0 12px',
        borderRadius: 2,
        background: 'rgba(255,255,255,0.08)',
    },
};

export default TrackPageWaveform;
