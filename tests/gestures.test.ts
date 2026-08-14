import { describe, expect, it } from 'vitest'
import { classifyGesture, gestureHint } from '../src/gestures.ts'

describe('classifyGesture', () => {
  it('returns null below the threshold', () => {
    expect(classifyGesture(20, 0)).toBeNull()
    expect(classifyGesture(-39, 0)).toBeNull()
  })
  it('requires horizontal dominance over vertical travel', () => {
    expect(classifyGesture(50, 60)).toBeNull()
    expect(classifyGesture(-50, -55)).toBeNull()
  })
  it('classifies left and right drags', () => {
    expect(classifyGesture(80, 10)).toBe('right')
    expect(classifyGesture(-80, 10)).toBe('left')
  })
  it('accepts a custom threshold', () => {
    expect(classifyGesture(30, 5, 40)).toBeNull()
    expect(classifyGesture(50, 5, 40)).toBe('right')
  })
})

describe('gestureHint', () => {
  it('maps directions to Chinese hint text', () => {
    expect(gestureHint('left')).toBe('← 收起侧边栏')
    expect(gestureHint('right')).toBe('→ 展开侧边栏')
    expect(gestureHint(null)).toBeNull()
  })
})
