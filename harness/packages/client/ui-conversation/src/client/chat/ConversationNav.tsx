/**
 * Conversation outline: a permanently docked right-hand rail listing every
 * turn of the session (whole-log rows supplied by the view). Clicking a row
 * asks the view to jump to that turn, paging history in as needed. The
 * header collapses the rail into a slim strip and back.
 */
import { useState } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutline14, IconChevronLeftOutline14, IconChevronRightOutline14, IconListPenOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import type { OutlineRow } from './conversation-summary.ts'
import { formatMessageClock } from './message-chrome.ts'
import { useCalendarDay } from './use-calendar-day.ts'
import css from './ConversationNav.module.css'

export interface ConversationNavProps {
  /** Whole-conversation navigation rows (server outline or window fallback). */
  rows: readonly OutlineRow[]
  /** Whether the Host outline is still being fetched (shows a light hint). */
  loading?: boolean | undefined
  /** Auto-collapse on narrow windows (ResizeObserver decision from the view). */
  forceCollapsed?: boolean | undefined
  /** Jump the transcript to the turn anchored at this seq (pages if needed). */
  onJump: (anchorSeq: number) => void
  /** Scroll to the newest content. */
  toLatest: () => void
  t: ChatViewSlotProps['t']
}

/** One-line reply label for a row: text, or a placeholder by turn state. */
function replyLabel(row: OutlineRow, t: ChatViewSlotProps['t']): string {
  if (row.replyText !== '') return row.replyText
  if (row.status === 'open') return t('nav.running')
  return row.hasToolCalls ? t('nav.toolOnly') : t('nav.noReply')
}

/** Docked right-hand outline rail with a collapse toggle. */
export function ConversationNav({ rows, loading = false, forceCollapsed = false, onJump, toLatest, t }: ConversationNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const day = useCalendarDay()
  const effectiveCollapsed = forceCollapsed || collapsed
  if (effectiveCollapsed) {
    return (
      <div className={clsx(css.rail, css.railCollapsed)}>
        <button
          type="button"
          className={css.stripButton}
          aria-label={t('nav.open')}
          onClick={() => { setCollapsed(false) }}
        >
          <IconChevronLeftOutline14 />
        </button>
      </div>
    )
  }
  return (
    <div className={css.panel} role="complementary" aria-label={t('nav.open')}>
      <div className={css.header}>
        <span className={css.title}><IconListPenOutline16 /> {t('nav.open')}</span>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('nav.close')}
          onClick={() => { setCollapsed(true) }}
        >
          <IconChevronRightOutline14 />
        </button>
      </div>
      <button type="button" className={css.latest} onClick={toLatest}>
        <IconChevronDownOutline14 />
        <span>{t('nav.latest')}</span>
      </button>
      {loading && <div className={css.loading}>{t('nav.loading')}</div>}
      <ul className={css.list}>
        {!loading && rows.length === 0 && <li className={css.empty}>{t('nav.empty')}</li>}
        {rows.map(row => (
          <li key={row.anchorSeq}>
            <button type="button" className={css.row} onClick={() => { onJump(row.anchorSeq) }}>
              <span className={css.rowHead}>
                <span className={css.rowIndex}>{t('nav.turn', { n: row.index })}</span>
                {row.time !== undefined && (
                  <span className={css.rowTime}>{formatMessageClock(row.time, t, day)}</span>
                )}
              </span>
              <span className={css.rowLine}>
                <span className={css.rowWho}>{t('nav.you')}</span>
                {row.userText}
              </span>
              <span className={css.rowLine}>
                <span className={css.rowWho}>{t('nav.me')}</span>
                {replyLabel(row, t)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
