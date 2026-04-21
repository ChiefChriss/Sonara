import { create } from 'zustand';
import { getApiBaseUrl } from '../utils/apiBase';

export interface PlayerTrack {
    id: number;
    type: 'track' | 'publication';
    title: string;
    artist: string;
    audioUrl: string;
    coverImage: string | null;
    artistHandle: string;
}

interface PlayOptions {
    queue?: PlayerTrack[];
}

interface PlayerState {
    currentTrack: PlayerTrack | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    queue: PlayerTrack[];
    currentIndex: number;
    isShuffleEnabled: boolean;
    isLooping: boolean;

    _audio: HTMLAudioElement | null;
    _playCountFired: Set<string>;

    play: (track: PlayerTrack, options?: PlayOptions) => void;
    togglePlayPause: () => void;
    pause: () => void;
    seek: (time: number) => void;
    setVolume: (vol: number) => void;
    stop: () => void;
    playNext: () => void;
    playPrevious: () => void;
    toggleShuffle: () => void;
    toggleLoop: () => void;
}

const API_BASE_URL = getApiBaseUrl();

const firePlayCount = (track: PlayerTrack) => {
    const endpoint = track.type === 'track'
        ? `${API_BASE_URL}/api/auth/tracks/${track.id}/play/`
        : `${API_BASE_URL}/api/auth/publications/${track.id}/play/`;
    fetch(endpoint, { method: 'POST' }).catch(() => { });
};

const trackKey = (track: PlayerTrack) => `${track.type}-${track.id}`;

const normalizeQueue = (track: PlayerTrack, queue?: PlayerTrack[]) => {
    const baseQueue = queue && queue.length > 0 ? queue : [track];
    const deduped = baseQueue.filter((item, index, arr) =>
        arr.findIndex((candidate) => trackKey(candidate) === trackKey(item)) === index
    );
    const currentIndex = deduped.findIndex((item) => trackKey(item) === trackKey(track));
    if (currentIndex >= 0) {
        return { queue: deduped, currentIndex };
    }
    return { queue: [track, ...deduped], currentIndex: 0 };
};

const startPlayback = (
    set: (partial: Partial<PlayerState>) => void,
    get: () => PlayerState,
    track: PlayerTrack,
    queue: PlayerTrack[],
    currentIndex: number
) => {
    const state = get();
    const key = trackKey(track);

    if (state._audio) {
        state._audio.pause();
        state._audio.src = '';
        state._audio.load();
    }

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = track.audioUrl;
    audio.volume = state.volume;

    audio.addEventListener('loadedmetadata', () => {
        if (get()._audio === audio) {
            set({ duration: audio.duration });
        }
    });

    audio.addEventListener('timeupdate', () => {
        if (get()._audio === audio) {
            set({ currentTime: audio.currentTime });
        }
    });

    audio.addEventListener('play', () => {
        if (get()._audio === audio) set({ isPlaying: true });
    });

    audio.addEventListener('pause', () => {
        if (get()._audio === audio) set({ isPlaying: false });
    });

    audio.addEventListener('ended', () => {
        if (get()._audio !== audio) return;
        const latest = get();

        if (latest.isLooping) {
            latest.seek(0);
            latest._audio?.play().catch(() => set({ isPlaying: false }));
            set({ isPlaying: true });
            return;
        }

        const hasNext = latest.isShuffleEnabled
            ? latest.queue.length > 1
            : latest.currentIndex >= 0 && latest.currentIndex < latest.queue.length - 1;
        if (hasNext) {
            latest.playNext();
        } else {
            set({ isPlaying: false, currentTime: 0 });
        }
    });

    audio.addEventListener('error', () => {
        if (get()._audio === audio) set({ isPlaying: false });
    });

    audio.play().catch(() => {
        if (get()._audio === audio) set({ isPlaying: false });
    });

    if (!state._playCountFired.has(key)) {
        firePlayCount(track);
        state._playCountFired.add(key);
    }

    set({
        currentTrack: track,
        queue,
        currentIndex,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        _audio: audio,
    });
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    queue: [],
    currentIndex: -1,
    isShuffleEnabled: false,
    isLooping: false,
    _audio: null,
    _playCountFired: new Set(),

    play: (track, options) => {
        const state = get();
        if (state.currentTrack && trackKey(state.currentTrack) === trackKey(track)) {
            const normalized = normalizeQueue(track, options?.queue || state.queue);
            set({ queue: normalized.queue, currentIndex: normalized.currentIndex });
            if (!state.isPlaying) {
                state._audio?.play().catch(() => set({ isPlaying: false }));
                set({ isPlaying: true });
            }
            return;
        }

        const normalized = normalizeQueue(track, options?.queue);
        startPlayback(set, get, track, normalized.queue, normalized.currentIndex);
    },

    togglePlayPause: () => {
        const { _audio, isPlaying } = get();
        if (!_audio) return;
        if (isPlaying) {
            _audio.pause();
        } else {
            _audio.play().catch(() => set({ isPlaying: false }));
            set({ isPlaying: true });
        }
    },

    pause: () => {
        const { _audio } = get();
        if (_audio) _audio.pause();
    },

    seek: (time) => {
        const { _audio } = get();
        if (_audio) {
            const nextTime = Math.max(0, Math.min(time, _audio.duration || time));
            _audio.currentTime = nextTime;
            set({ currentTime: nextTime });
        }
    },

    setVolume: (vol) => {
        const safeVolume = Math.max(0, Math.min(1, vol));
        const { _audio } = get();
        if (_audio) _audio.volume = safeVolume;
        set({ volume: safeVolume });
    },

    stop: () => {
        const { _audio } = get();
        if (_audio) {
            _audio.pause();
            _audio.src = '';
            _audio.load();
        }
        set({
            currentTrack: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            queue: [],
            currentIndex: -1,
            _audio: null,
        });
    },

    playNext: () => {
        const state = get();
        if (state.queue.length === 0 || !state.currentTrack) return;

        let nextIndex = state.currentIndex + 1;
        if (state.isShuffleEnabled) {
            const choices = state.queue
                .map((_, index) => index)
                .filter((index) => index !== state.currentIndex);
            if (choices.length === 0) return;
            nextIndex = choices[Math.floor(Math.random() * choices.length)];
        }

        if (nextIndex < 0 || nextIndex >= state.queue.length) return;
        startPlayback(set, get, state.queue[nextIndex], state.queue, nextIndex);
    },

    playPrevious: () => {
        const state = get();
        if (!state.currentTrack) return;

        if (state.currentTime > 3) {
            state.seek(0);
            return;
        }

        const previousIndex = state.currentIndex - 1;
        if (previousIndex < 0 || previousIndex >= state.queue.length) {
            state.seek(0);
            return;
        }

        startPlayback(set, get, state.queue[previousIndex], state.queue, previousIndex);
    },

    toggleShuffle: () => {
        set((state) => ({ isShuffleEnabled: !state.isShuffleEnabled }));
    },

    toggleLoop: () => {
        set((state) => ({ isLooping: !state.isLooping }));
    },
}));
