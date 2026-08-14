/**
 * Conversation outline projections: pure snapshot-to-summary derivation for
 * the navigation panel, plus the shared user-message text extractor backing
 * the rewind/regenerate actions.
 */
import type { ChatSnapshot, OutlineTurn } from '@deepseek-ai/dsh-client-runtime/client'

import { assistantText } from './turn-assistant.ts'

/** One outline row: the user message that opened the turn and the reply summary. */
export interface TurnSummary {
  /** Stable key of the turn's first chat node (the scroll target). */
  readonly anchorKey: string
  /** Anchor seq of the turn's first chat node (jump target across window boundaries). */
  readonly anchorSeq: number
  /** 1-based position of the turn in the current window. */
  readonly index: number
  /** Timeline turn id. */
  readonly turn: number
  /** Turn wall-clock start, when inside the window. */
  readonly time: number | undefined
  /** User message text (joined text blocks, Markdown stripped, truncated). */
  readonly userText: string
  /** Assistant reply text; empty while the turn produced no text yet. */
  readonly replyText: string
  /** Whether the turn is still running. */
  readonly status: 'open' | 'closed'
  /** Whether the turn contains a tool-call node (drives the tool-only label). */
  readonly hasToolCalls: boolean
}

/** Join the text blocks of a user message node. */
export function userMessageText(content: readonly unknown[]): string {
  let out = ''
  for (const block of content) {
    const b = block as { type?: unknown; text?: unknown }
    if (b.type === 'text' && typeof b.text === 'string') out += b.text
  }
  return out
}

/** Strip the common Markdown markers a summary does not need. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Truncate to at most `limit` characters, appending an ellipsis when cut. */
export function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit) + '…'
}

/** Last non-empty assistant-side text of one turn (tail closing first, then assistant steps). */
function turnAssistantText(turnKeys: readonly string[], nodes: ChatSnapshot['nodes']): string {
  for (let i = turnKeys.length - 1; i >= 0; i--) {
    const node = nodes.get(turnKeys[i] ?? '')
    if (node === undefined) continue
    if (node.kind === 'turn-tail') {
      const closing = (node.data as { closing?: { blocks: readonly unknown[] } | null }).closing
      if (closing !== null && closing !== undefined) {
        const text = assistantText(closing.blocks as never)
        if (text !== '') return text
      }
      continue
    }
    if (node.kind === 'assistant-step') {
      const blocks = (node.data as { blocks?: readonly unknown[] }).blocks
      if (blocks !== undefined) {
        const text = assistantText(blocks as never)
        if (text !== '') return text
      }
    }
  }
  return ''
}

/** Derive the navigation rows from a chat snapshot. */
export function buildTurnSummaries(snapshot: ChatSnapshot): TurnSummary[] {
  const { nodes, locations, timeline } = snapshot
  const rows: TurnSummary[] = []
  let index = 0
  for (const turn of timeline.turnOrder) {
    const keys = locations.getTurn(turn)
    const first = keys[0]
    if (first === undefined) continue
    const firstNode = nodes.get(first)
    if (firstNode === undefined) continue
    index += 1
    const userText = firstNode.kind === 'user' || firstNode.kind === 'steering'
      ? userMessageText((firstNode.data as { content: readonly unknown[] }).content)
      : ''
    const replyText = turnAssistantText(keys, nodes)
    if (userText === '' && replyText === '') continue
    let hasToolCalls = false
    for (const key of keys) {
      const candidate = nodes.get(key)
      if (candidate?.kind === 'tool-call') {
        hasToolCalls = true
        break
      }
    }
    const start = timeline.turns.get(turn)?.start?.time
    rows.push({
      anchorKey: first,
      anchorSeq: firstNode.anchorSeq,
      index,
      turn,
      time: start,
      userText: truncate(stripMarkdown(userText), 30),
      replyText: truncate(stripMarkdown(replyText), 40),
      // 'unknown' (turn/start not yet observed) reads as open: nothing is closed yet.
      status: timeline.turns.get(turn)?.status === 'closed' ? 'closed' : 'open',
      hasToolCalls,
    })
  }
  return rows
}

/** One navigation-row projection shared by the server outline and the loaded-window fallback. */
export interface OutlineRow {
  /** 1-based position of the turn. */
  readonly index: number
  /** Anchor seq of the turn's first user message (jump target). */
  readonly anchorSeq: number
  /** Turn wall-clock start, when inside the window. */
  readonly time: number | undefined
  /** User message text (already stripped/truncated). */
  readonly userText: string
  /** Assistant reply text; empty while the turn produced no text yet. */
  readonly replyText: string
  /** Whether the turn is still running. */
  readonly status: 'open' | 'closed'
  /** Whether the turn contains a tool call. */
  readonly hasToolCalls: boolean
}

/** First sentence of a text: cut at the first sentence-ending punctuation or line break. */
export function firstSentence(text: string): string {
  const match = /^[^。！？!?\n]+[。！？!?]?/.exec(text.trim())
  return match === null ? '' : match[0].trim()
}

/** One-line summary: first sentence, then an ellipsis when more text follows. */
export function oneLineSummary(text: string, limit: number): string {
  const plain = stripMarkdown(text)
  const sentence = firstSentence(plain)
  if (sentence.length > limit) return sentence.slice(0, limit) + '…'
  return plain.length > sentence.length ? sentence + '…' : sentence
}

/** Number and project the Host's whole-log turns into navigation rows. */
export function outlineRowsFromTurns(turns: readonly OutlineTurn[]): OutlineRow[] {
  return turns.map((turn, index) => ({
    index: index + 1,
    anchorSeq: turn.anchorSeq,
    time: turn.time,
    userText: oneLineSummary(turn.userText, 40),
    replyText: oneLineSummary(turn.replyText, 50),
    status: turn.status,
    hasToolCalls: turn.hasToolCalls,
  }))
}

/** Project the loaded-window summaries into navigation rows (outline fetch fallback). */
export function outlineRowsFromWindow(summaries: readonly TurnSummary[]): OutlineRow[] {
  return summaries.map(summary => ({
    index: summary.index,
    anchorSeq: summary.anchorSeq,
    time: summary.time,
    userText: summary.userText,
    replyText: summary.replyText,
    status: summary.status,
    hasToolCalls: summary.hasToolCalls,
  }))
}
