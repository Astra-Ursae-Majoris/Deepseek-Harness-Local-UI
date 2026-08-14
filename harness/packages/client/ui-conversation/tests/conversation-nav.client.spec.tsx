// @vitest-environment jsdom
// ConversationNav: the docked outline rail — rows, jump/latest actions,
// collapse/expand, and the reply-label arms (text / running / tool-only /
// no-reply).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ConversationNav, type ConversationNavProps } from '../src/client/chat/ConversationNav.tsx'
import { outlineRowsFromTurns, type OutlineRow } from '../src/client/chat/conversation-summary.ts'
import { zh } from '../src/client/locales.ts'
import type { ChatViewSlotProps } from '../src/client/contract/slots.ts'

afterEach(() => { cleanup() })

const t: ChatViewSlotProps['t'] = makeTranslate(zh, commonZh)

const rows: readonly OutlineRow[] = outlineRowsFromTurns([
  { turn: 0, anchorSeq: 1, time: 1000, userText: '第一个问题', replyText: '第一个回答', status: 'closed', hasToolCalls: false },
  { turn: 1, anchorSeq: 4, time: 3000, userText: '第二个问题', replyText: '第二个回答', status: 'closed', hasToolCalls: false },
  { turn: 2, anchorSeq: 6, time: 5000, userText: '还在生成', replyText: '', status: 'open', hasToolCalls: false },
  { turn: 3, anchorSeq: 8, time: 7000, userText: '跑一下', replyText: '', status: 'closed', hasToolCalls: true },
  { turn: 4, anchorSeq: 10, time: 9000, userText: '空回复', replyText: '', status: 'closed', hasToolCalls: false },
])

function renderNav(overrides: Partial<Pick<ConversationNavProps, 'rows' | 'loading'>> = {}) {
  const onJump = vi.fn()
  const toLatest = vi.fn()
  render(
    <ConversationNav
      rows={overrides.rows ?? rows}
      loading={overrides.loading}
      onJump={onJump}
      toLatest={toLatest}
      t={t}
    />,
  )
  return { onJump, toLatest }
}

describe('ConversationNav', () => {
  it('lists one row per turn with labels and jumps on click', () => {
    const { onJump } = renderNav()
    expect(screen.getByText('第 1 条')).toBeTruthy()
    expect(screen.getByText('第 2 条')).toBeTruthy()
    expect(screen.getByText('第一个问题')).toBeTruthy()
    expect(screen.getByText('第一个回答')).toBeTruthy()
    fireEvent.click(screen.getByText('第 2 条'))
    expect(onJump).toHaveBeenCalledWith(4)
  })

  it('collapses into a slim strip and expands back', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '收起导航' }))
    expect(screen.queryByText('第 1 条')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '对话导航' }))
    expect(screen.getByText('第 1 条')).toBeTruthy()
  })

  it('jumps to latest', () => {
    const { toLatest } = renderNav()
    fireEvent.click(screen.getByRole('button', { name: '回到最新' }))
    expect(toLatest).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state without turns and the loading hint while fetching', () => {
    renderNav({ rows: [] })
    expect(screen.getByText('还没有可导航的对话')).toBeTruthy()
    cleanup()
    renderNav({ rows: [], loading: true })
    expect(screen.getByText('正在加载目录…')).toBeTruthy()
  })

  it('labels running, tool-only, and no-reply turns', () => {
    renderNav()
    expect(screen.getByText('（生成中…）')).toBeTruthy()
    expect(screen.getByText('（工具操作）')).toBeTruthy()
    expect(screen.getByText('（无文字回复）')).toBeTruthy()
  })
})
