/** Right-drag gesture classification (pure math, unit-tested). */

export type GestureDirection = 'left' | 'right' | null

/**
 * Classify a horizontal right-button drag.
 * Returns null unless the horizontal travel passes the threshold AND
 * dominates the vertical travel (a vertical drag is a scroll gesture).
 */
export function classifyGesture(dx: number, dy: number, threshold = 40): GestureDirection {
  if (Math.abs(dx) < threshold) return null
  if (Math.abs(dx) <= Math.abs(dy)) return null
  return dx < 0 ? 'left' : 'right'
}

/** Screen-space hint label shown while a gesture resolves. */
export function gestureHint(direction: GestureDirection): string | null {
  if (direction === 'left') return '← 收起侧边栏'
  if (direction === 'right') return '→ 展开侧边栏'
  return null
}
