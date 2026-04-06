/** Loop-arrow repost mark — use parent `color` (lavender default, teal when active). */

type RepostIconProps = {
    size?: number;
    /** Teal accent + soft circular fill */
    active?: boolean;
    className?: string;
};

const RepostIcon = ({ size = 18, active = false, className }: RepostIconProps) => {
    const color = active ? '#5eead4' : '#c4b5fd';
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{ color, flexShrink: 0 }}
        >
            {active && (
                <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.14} stroke="none" />
            )}
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 2 21 6 17 10" />
                <path d="M3 12V10a4 4 0 0 1 4-4h14" />
                <polyline points="7 22 3 18 7 14" />
                <path d="M21 12v2a4 4 0 0 1-4 4H5" />
            </g>
        </svg>
    );
};

export default RepostIcon;
