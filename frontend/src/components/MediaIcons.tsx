import type { CSSProperties } from 'react';

type GlyphProps = {
  size?: number;
  fill?: string;
  style?: CSSProperties;
  title?: string;
};

/** Triangle play — same geometry as PlayerBar (not a system emoji). */
export function PlayGlyph({ size = 18, fill = 'currentColor', style, title }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="none"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

/** Pause bars — same geometry as PlayerBar. */
export function PauseGlyph({ size = 18, fill = 'currentColor', style, title }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="none"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

/** Inline play + label for gradient buttons (e.g. featured card). */
export function PlayPauseLabel({
  playing,
  labelPlaying = 'Pause',
  labelIdle = 'Play',
  iconSize = 18,
  iconFill = '#fff',
}: {
  playing: boolean;
  labelPlaying?: string;
  labelIdle?: string;
  iconSize?: number;
  iconFill?: string;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {playing ? (
        <PauseGlyph size={iconSize} fill={iconFill} />
      ) : (
        <PlayGlyph size={iconSize} fill={iconFill} />
      )}
      {playing ? labelPlaying : labelIdle}
    </span>
  );
}
