import { create } from 'zustand';

export interface PlayerTrack {
    id: number;
    type: 'track' | 'publication';
    title: string;
    artist: string;
    audioUrl: string;
    coverImage: string | null;
    artistHandle: string;
}

interface PlayerState {
    // Current track
    currentTrack: PlayerTrack | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;

    // Internal
    _audio: HTMLAudioElement | null;
    _playCountFired: Set<string>;

    // Actions
    play: (track: PlayerTrack) => void;
    togglePlayPause: () => void;
    pause: () => void;
    seek: (time: number) => void;
    setVolume: (vol: number) => void;
    stop: () => void;
}

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:8000';

const firePlayCount = (track: PlayerTrack) => {
    const endpoint = track.type === 'track'
        ? `${API_BASE_URL}/api/auth/tracks/${track.id}/play/`
        : `${API_BASE_URL}/api/auth/publications/${track.id}/play/`;
    fetch(endpoint, { method: 'POST' }).catch(() => { });
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    _audio: null,
    _playCountFired: new Set(),

    play: (track) => {
        const state = get();
        const key = `${track.type}-${track.id}`;

        // If same track is already loaded, just resume
        if (state.currentTrack && state.currentTrack.id === track.id && state.currentTrack.type === track.type) {
            if (!state.isPlaying) {
                state._audio?.play();
                set({ isPlaying: true });
            }
            return;
        }

        // Stop current audio
        if (state._audio) {
            state._audio.pause();
            state._audio.src = '';
            state._audio.load();
        }

        const audio = new Audio(track.audioUrl);
        audio.volume = state.volume;

        audio.addEventListener('loadedmetadata', () => {
            set({ duration: audio.duration });
        });

        audio.addEventListener('timeupdate', () => {
            set({ currentTime: audio.currentTime });
        });

        audio.addEventListener('play', () => {
            if (get()._audio === audio) set({ isPlaying: true });
        });

        audio.addEventListener('pause', () => {
            if (get()._audio === audio) set({ isPlaying: false });
        });

        audio.addEventListener('ended', () => {
            if (get()._audio === audio) set({ isPlaying: false, currentTime: 0 });
        });

        audio.addEventListener('error', () => {
            if (get()._audio === audio) set({ isPlaying: false });
        });

        audio.play().catch(() => {
            if (get()._audio === audio) set({ isPlaying: false });
        });

        // Fire play count (once per session per track)
        if (!state._playCountFired.has(key)) {
            firePlayCount(track);
            state._playCountFired.add(key);
        }

        set({
            currentTrack: track,
            isPlaying: true, // Optimistically true, corrected by events if needed
            currentTime: 0,
            duration: 0,
            _audio: audio,
        });
    },

    togglePlayPause: () => {
        const { _audio, isPlaying } = get();
        if (!_audio) return;
        if (isPlaying) {
            _audio.pause(); // Event listener will set isPlaying to false
        } else {
            _audio.play().catch(() => { set({ isPlaying: false }); });
            set({ isPlaying: true }); // Optimistic, corrected by events
        }
    },

    pause: () => {
        const { _audio } = get();
        if (_audio) _audio.pause();
    },

    seek: (time) => {
        const { _audio } = get();
        if (_audio) {
            _audio.currentTime = time;
            set({ currentTime: time });
        }
    },

    setVolume: (vol) => {
        const { _audio } = get();
        if (_audio) _audio.volume = vol;
        set({ volume: vol });
    },

    stop: () => {
        const { _audio } = get();
        if (_audio) {
            _audio.pause();
            _audio.src = '';
            _audio.load();
        }
        set({ currentTrack: null, isPlaying: false, currentTime: 0, duration: 0, _audio: null });
    },
}));
