// Lightweight MIDI file parser
// Extracts tracks with note-on/note-off events from Standard MIDI Files (Format 0 and 1)

export interface MidiFileNote {
  pitch: number;      // 0-127
  startTick: number;  // absolute tick position
  durationTick: number;
  velocity: number;   // 1-127
  channel: number;    // 0-15
}

export interface MidiTrackData {
  name: string;
  notes: MidiFileNote[];
  channel: number; // dominant channel
}

export interface ParsedMidi {
  format: number;     // 0 or 1
  ticksPerBeat: number;
  tempos: { tick: number; bpm: number }[];
  tracks: MidiTrackData[];
}

class MidiReader {
  private data: DataView;
  private pos = 0;

  constructor(buffer: ArrayBuffer) {
    this.data = new DataView(buffer);
  }

  readUint8(): number {
    return this.data.getUint8(this.pos++);
  }

  readUint16(): number {
    const v = this.data.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  readUint32(): number {
    const v = this.data.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  readBytes(n: number): Uint8Array {
    const arr = new Uint8Array(this.data.buffer, this.pos, n);
    this.pos += n;
    return arr;
  }

  readString(n: number): string {
    const bytes = this.readBytes(n);
    return Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  }

  readVarInt(): number {
    let value = 0;
    let byte: number;
    do {
      byte = this.readUint8();
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return value;
  }

  get position(): number { return this.pos; }
  set position(p: number) { this.pos = p; }
  get length(): number { return this.data.byteLength; }
}

export function parseMidiFile(buffer: ArrayBuffer): ParsedMidi {
  const reader = new MidiReader(buffer);

  // Header chunk
  const headerChunk = reader.readString(4);
  if (headerChunk !== 'MThd') throw new Error('Not a valid MIDI file');
  const headerLength = reader.readUint32();
  const format = reader.readUint16();
  const numTracks = reader.readUint16();
  const timeDivision = reader.readUint16();

  // Skip any extra header bytes
  if (headerLength > 6) {
    reader.readBytes(headerLength - 6);
  }

  // Only support ticks-per-beat (not SMPTE)
  if (timeDivision & 0x8000) {
    throw new Error('SMPTE time division not supported');
  }
  const ticksPerBeat = timeDivision;

  const tempos: { tick: number; bpm: number }[] = [];
  const tracks: MidiTrackData[] = [];

  for (let t = 0; t < numTracks; t++) {
    // Track chunk header
    const trackChunk = reader.readString(4);
    if (trackChunk !== 'MTrk') {
      // Try to skip to next valid chunk
      const len = reader.readUint32();
      reader.readBytes(len);
      continue;
    }
    const trackLength = reader.readUint32();
    const trackEnd = reader.position + trackLength;

    let trackName = '';
    let absoluteTick = 0;
    let runningStatus = 0;

    // Collect note-on events, match with note-off
    const activeNotes = new Map<string, { tick: number; velocity: number; channel: number }>();
    const notes: MidiFileNote[] = [];
    const channelCounts = new Int32Array(16);

    while (reader.position < trackEnd) {
      const delta = reader.readVarInt();
      absoluteTick += delta;

      let status = reader.readUint8();

      // Running status
      if (status < 0x80) {
        reader.position--;
        status = runningStatus;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (type === 0x80) {
        // Note Off
        const pitch = reader.readUint8();
        reader.readUint8(); // velocity (ignored)
        const key = `${channel}-${pitch}`;
        const active = activeNotes.get(key);
        if (active) {
          notes.push({
            pitch,
            startTick: active.tick,
            durationTick: Math.max(1, absoluteTick - active.tick),
            velocity: active.velocity,
            channel: active.channel,
          });
          activeNotes.delete(key);
        }
      } else if (type === 0x90) {
        // Note On
        const pitch = reader.readUint8();
        const velocity = reader.readUint8();
        const key = `${channel}-${pitch}`;
        if (velocity === 0) {
          // Note On with velocity 0 = Note Off
          const active = activeNotes.get(key);
          if (active) {
            notes.push({
              pitch,
              startTick: active.tick,
              durationTick: Math.max(1, absoluteTick - active.tick),
              velocity: active.velocity,
              channel: active.channel,
            });
            activeNotes.delete(key);
          }
        } else {
          // Close any existing note on same pitch/channel
          const existing = activeNotes.get(key);
          if (existing) {
            notes.push({
              pitch,
              startTick: existing.tick,
              durationTick: Math.max(1, absoluteTick - existing.tick),
              velocity: existing.velocity,
              channel: existing.channel,
            });
          }
          activeNotes.set(key, { tick: absoluteTick, velocity, channel });
          channelCounts[channel]++;
        }
      } else if (type === 0xa0) {
        // Aftertouch
        reader.readUint8(); reader.readUint8();
      } else if (type === 0xb0) {
        // Control Change
        reader.readUint8(); reader.readUint8();
      } else if (type === 0xc0) {
        // Program Change
        reader.readUint8();
      } else if (type === 0xd0) {
        // Channel Pressure
        reader.readUint8();
      } else if (type === 0xe0) {
        // Pitch Bend
        reader.readUint8(); reader.readUint8();
      } else if (status === 0xff) {
        // Meta event
        const metaType = reader.readUint8();
        const metaLen = reader.readVarInt();
        const metaStart = reader.position;

        if (metaType === 0x03) {
          // Track Name
          trackName = reader.readString(metaLen);
        } else if (metaType === 0x51) {
          // Tempo
          const b1 = reader.readUint8();
          const b2 = reader.readUint8();
          const b3 = reader.readUint8();
          const microsecondsPerBeat = (b1 << 16) | (b2 << 8) | b3;
          const bpm = Math.round(60000000 / microsecondsPerBeat);
          tempos.push({ tick: absoluteTick, bpm });
        } else {
          reader.readBytes(metaLen);
        }

        // Ensure we consumed exactly metaLen bytes
        reader.position = metaStart + metaLen;
        runningStatus = 0;
      } else if (status === 0xf0 || status === 0xf7) {
        // SysEx
        const sysLen = reader.readVarInt();
        reader.readBytes(sysLen);
        runningStatus = 0;
      }
    }

    // Close any still-open notes
    for (const [, active] of activeNotes) {
      notes.push({
        pitch: 0,
        startTick: active.tick,
        durationTick: ticksPerBeat, // default 1 beat
        velocity: active.velocity,
        channel: active.channel,
      });
    }

    // Find dominant channel
    let dominantChannel = 0;
    let maxCount = 0;
    for (let c = 0; c < 16; c++) {
      if (channelCounts[c] > maxCount) {
        maxCount = channelCounts[c];
        dominantChannel = c;
      }
    }

    if (notes.length > 0) {
      tracks.push({
        name: trackName || `Track ${tracks.length + 1}`,
        notes,
        channel: dominantChannel,
      });
    }

    reader.position = trackEnd;
  }

  // Default tempo if none found
  if (tempos.length === 0) {
    tempos.push({ tick: 0, bpm: 120 });
  }

  return { format, ticksPerBeat, tempos, tracks };
}

// Convert parsed MIDI to our DAW's note format
export function midiToClipNotes(
  track: MidiTrackData,
  ticksPerBeat: number,
  startBeatOffset: number = 0,
): { notes: { pitch: number; startBeat: number; duration: number; velocity: number }[]; durationBeats: number } {
  const notes = track.notes.map((n) => ({
    pitch: n.pitch,
    startBeat: n.startTick / ticksPerBeat,
    duration: Math.max(0.0625, n.durationTick / ticksPerBeat), // min 1/16 beat
    velocity: Math.max(1, Math.min(127, n.velocity)),
  }));

  // Normalize to start at 0 if there's a gap
  if (notes.length > 0) {
    const minStart = Math.min(...notes.map((n) => n.startBeat));
    if (minStart > 0) {
      for (const n of notes) n.startBeat -= minStart;
    }
  }

  const durationBeats = notes.length > 0
    ? Math.ceil(Math.max(...notes.map((n) => n.startBeat + n.duration)))
    : 4;

  return { notes, durationBeats };
}