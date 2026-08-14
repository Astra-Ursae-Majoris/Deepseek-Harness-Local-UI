// @vitest-environment jsdom
// conversation-summary: pure outline derivation over the chat snapshot.

import { describe, expect, it } from 'vitest'
import type {
  AssistantMessageNode, UserMessageNode,
} from '@deepseek-ai/dsh-client-runtime/client'
import { chatSnapshotFixture } from './chat-snapshot-fixture.client.ts'
import {
  buildTurnSummaries, firstSentence, oneLineSummary, stripMarkdown, truncate, userMessageText,
} from '../src/client/chat/conversation-summary.ts'

// Fixture user nodes need a top-level turn so the fixture assigns them a turn
// location (the real location index derives it from the event stream).
const user = (seq: number, text: string, turn?: number): UserMessageNode & { turn?: number } => ({
  kind: 'user', seq, time: seq * 1000, content: [{ type: 'text', text }] as never, source: null,
  ...(turn === undefined ? {} : { turn }),
})
const assistant = (seq: number, text: string, turn: number): AssistantMessageNode => ({
  kind: 'assistant', seq, time: seq * 1000, turn, step: 1, blocks: [{ kind: 'text', text }],
})
const toolCall = (seq: number, turn: number): never => ({
  kind: 'tool-call', id: String(seq), callId: 'call-' + seq, toolName: 'bash',
  args: {}, argsText: '', state: 'completed', seq, time: seq * 1000, turn, step: 0,
  output: undefined,
} as never)

describe('userMessageText', () => {
  it('joins text blocks and ignores non-text blocks', () => {
    expect(userMessageText([{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }])).toBe('ab')
  })
  it('returns empty for no text blocks', () => {
    expect(userMessageText([{ type: 'image' }])).toBe('')
  })
})

describe('stripMarkdown', () => {
  it('strips fences, inline code, links, images, headings, and emphasis', () => {
    expect(stripMarkdown('# 标题 **加粗** [链接](http://x) \`code\` ![图](http://y)')).toBe('标题 加粗 链接 code')
  })
  it('collapses whitespace runs', () => {
    expect(stripMarkdown('a   b\n\n c')).toBe('a b c')
  })
  it('keeps plain text unchanged', () => {
    expect(stripMarkdown('你好，世界')).toBe('你好，世界')
  })
})

describe('firstSentence', () => {
  it('cuts at sentence-ending punctuation', () => {
    expect(firstSentence('第一句。第二句')).toBe('第一句。')
    expect(firstSentence('你好！再见')).toBe('你好！')
    expect(firstSentence('问了吗？没问')).toBe('问了吗？')
    expect(firstSentence('换行\n第二行')).toBe('换行')
  })
  it('keeps a sentence without trailing punctuation', () => {
    expect(firstSentence('没有标点的一句话')).toBe('没有标点的一句话')
  })
})

describe('oneLineSummary', () => {
  it('takes the first sentence and appends an ellipsis when more follows', () => {
    expect(oneLineSummary('**第一句**。后面还有很长很长的内容', 40)).toBe('第一句。…')
    expect(oneLineSummary('第一句超级长超出了四十个字符限制所以会被截断并且加省略号。', 12)).toBe('第一句超级长超出了四十个…')
    expect(oneLineSummary('只有一句', 40)).toBe('只有一句')
  })
})

describe('truncate', () => {
  it('keeps short text', () => {
    expect(truncate('abc', 5)).toBe('abc')
  })
  it('cuts long text with an ellipsis', () => {
    expect(truncate('abcdef', 3)).toBe('abc…')
  })
})

describe('buildTurnSummaries', () => {
  it('derives one row per turn with text summaries and numbering', () => {
    const snapshot = chatSnapshotFixture({
      nodes: [
        user(1, '帮我写一个 **脚本**', 0),
        assistant(2, '好的，\`echo hi\` 完成了', 0),
        user(3, '再优化一下', 1),
        assistant(4, '已优化', 1),
      ],
      turnEnds: new Map([[0, 2], [1, 4]]),
    })
    const rows = buildTurnSummaries(snapshot)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ index: 1, turn: 0, userText: '帮我写一个 脚本' })
    expect(rows[0]?.replyText).toBe('好的，echo hi 完成了')
    expect(rows[1]).toMatchObject({ index: 2, turn: 1, userText: '再优化一下' })
    expect(rows[1]?.replyText).toBe('已优化')
    expect(rows[0]?.anchorKey).toBe('fixture:user:1')
    expect(rows[0]?.status).toBe('closed')
    expect(rows[0]?.hasToolCalls).toBe(false)
  })

  it('uses the synthesized turn-tail closing text of the last assistant step', () => {
    const snapshot = chatSnapshotFixture({
      nodes: [
        user(1, '问题', 0),
        assistant(2, '第一版', 0),
        assistant(3, '第二版', 0),
      ],
      turnEnds: new Map([[0, 3]]),
    })
    const rows = buildTurnSummaries(snapshot)
    expect(rows[0]?.replyText).toBe('第二版')
  })

  it('falls back to assistant-step text while a turn is still open', () => {
    const snapshot = chatSnapshotFixture({
      nodes: [
        user(1, '追问', 1),
        assistant(2, '流式回复', 1),
      ],
      turnTimings: new Map([[1, { startTime: 1000 }]]),
    })
    const rows = buildTurnSummaries(snapshot)
    expect(rows[0]).toMatchObject({ turn: 1, status: 'open', replyText: '流式回复' })
  })

  it('marks tool-only turns and text-less open turns', () => {
    const snapshot = chatSnapshotFixture({
      nodes: [user(1, '跑一下', 0), toolCall(2, 0) as never, user(3, '正在生成…', 1)],
      turnEnds: new Map([[0, 2]]),
      turnTimings: new Map([[1, { startTime: 3000 }]]),
    })
    const rows = buildTurnSummaries(snapshot)
    expect(rows[0]).toMatchObject({ turn: 0, hasToolCalls: true, status: 'closed', replyText: '' })
    expect(rows[1]).toMatchObject({ turn: 1, status: 'open', replyText: '' })
  })

  it('truncates long user and assistant text', () => {
    const long = 'x'.repeat(60)
    const snapshot = chatSnapshotFixture({
      nodes: [user(1, long, 0), assistant(2, long, 0)],
      turnEnds: new Map([[0, 2]]),
    })
    const rows = buildTurnSummaries(snapshot)
    expect(rows[0]?.userText).toBe('x'.repeat(30) + '…')
    expect(rows[0]?.replyText).toBe('x'.repeat(40) + '…')
  })

  it('skips turns without materialized nodes', () => {
    const snapshot = chatSnapshotFixture({
      nodes: [user(1, '仅有一轮', 0)],
      turnEnds: new Map([[0, 1]]),
    })
    // Simulate a window boundary turn listed in the timeline but with no
    // materialized nodes in the store.
    ;(snapshot.locations as unknown as { replace(next: ReadonlyMap<number, readonly string[]>): void })
      .replace(new Map([[0, ['ghost-key']]]))
    expect(buildTurnSummaries(snapshot)).toHaveLength(0)
  })
})
