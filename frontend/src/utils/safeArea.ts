import type { CSSProperties } from 'react';

/**
 * Insets for full-viewport pages (no global TopBar) so content clears notches,
 * status bar, home indicator, and rounded corners. Requires viewport-fit=cover.
 */
export const fullBleedSafeArea: CSSProperties = {
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
  boxSizing: 'border-box',
};
