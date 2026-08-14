/** session.outline: whole-log per-turn summaries independent of the loaded window. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentHandle, CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { CallId } from '@deepseek-ai/dsh-llm/brand'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'

const sid = (id: string): SessionId => id as SessionId
const callId = (id: string): CallId => id as CallId

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`outline-${String(nextRpc++)}`), payload }
}

async function composed(workspaces: readonly Workspace[] = []): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  ctx.provide('workspaceRegistry', { list: () => workspaces } as never)
  ctx.agents.setFactory({
    createAgent: async (ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle> => {
      const session = ctx.sessions.create(options.sessionId, {
        ...options.seed === undefined ? {} : { seed: [...options.seed] },
        ...options.meta === undefined ? {} : { meta: options.meta },
      })
      const agent = {} as Agent
      const agentCtx = ownerCtx.extend({ agent })
      Object.assign(agent, { id: session.id, session, status: 'idle', ctx: agentCtx })
      await options.setup?.(agentCtx)
      ctx.agents.register(agent)
      return { agent, dispose: () => Promise.resolve() }
    },
    resume: () => Promise.reject(new Error('outline test sources are live')),
  })
  return ctx
}

function liveAgent(ctx: Context, id: string): Session {
  const session = ctx.sessions.create(sid(id), { meta: { cwd: '/proj' } })
  ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
  return session
}

const api = (ctx: Context) => createApiProxy(ctx, {
  defaultModelSelection: () => ({ provider: 'default-provider', model: 'default-model' }),
  cwd: '/tmp',
})

describe('sessions.outline', () => {
  it('lists one row per completed turn with first-line summaries and tool markers', async () => {
    const ctx = await composed()
    const session = liveAgent(ctx, 's-outline')
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'prompt 1' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId: callId('c1'), name: 'bash', arguments: '{}' })
    session.append('assistant/message', {
      turn: 1, step: 1,
      message: createAssistantMessage({
        content: [{ type: 'text', text: 'reply 1' }],
        source: { provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'prompt 2' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 2, step: 1,
      message: createAssistantMessage({
        content: [{ type: 'text', text: 'reply 2' }],
        source: { provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })

    const response = await api(ctx).sessions.outline(request({ sessionId: session.id }), new AbortController().signal)
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value.turns).toHaveLength(2)
    expect(response.result.value.turns[0]).toMatchObject({
      turn: 1,
      anchorSeq: 1,
      userText: 'prompt 1',
      replyText: 'reply 1',
      status: 'closed',
      hasToolCalls: true,
    })
    expect(response.result.value.turns[1]).toMatchObject({
      turn: 2,
      anchorSeq: 6,
      userText: 'prompt 2',
      replyText: 'reply 2',
      status: 'closed',
      hasToolCalls: false,
    })
  })

  it('marks a trailing turn open and keeps the first non-empty texts', async () => {
    const ctx = await composed()
    const session = liveAgent(ctx, 's-open')
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'first' }, { type: 'text', text: ' second' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1, step: 1,
      message: createAssistantMessage({
        content: [],
        source: { provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1, step: 2,
      message: createAssistantMessage({
        content: [{ type: 'text', text: 'final reply' }],
        source: { provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })

    const response = await api(ctx).sessions.outline(request({ sessionId: session.id }), new AbortController().signal)
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value.turns).toHaveLength(1)
    expect(response.result.value.turns[0]).toMatchObject({
      turn: 1,
      anchorSeq: 1,
      userText: 'first second',
      replyText: 'final reply',
      status: 'open',
      hasToolCalls: false,
    })
  })

  it('falls back to the turn/start seq when the turn has no user message', async () => {
    const ctx = await composed()
    const session = liveAgent(ctx, 's-notool-user')
    session.append('turn/start', { turn: 1 })
    session.append('tool/call', { turn: 1, step: 1, callId: callId('c1'), name: 'bash', arguments: '{}' })
    session.append('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } })

    const response = await api(ctx).sessions.outline(request({ sessionId: session.id }), new AbortController().signal)
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value.turns).toHaveLength(1)
    expect(response.result.value.turns[0]).toMatchObject({
      turn: 1,
      anchorSeq: 0,
      userText: '',
      replyText: '',
      status: 'closed',
      hasToolCalls: true,
    })
  })

  it('bounds overlong texts to the wire limit', async () => {
    const ctx = await composed()
    const session = liveAgent(ctx, 's-long')
    const long = 'x'.repeat(300)
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: long }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1, step: 1,
      message: createAssistantMessage({
        content: [{ type: 'text', text: long }],
        source: { provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })

    const response = await api(ctx).sessions.outline(request({ sessionId: session.id }), new AbortController().signal)
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value.turns[0]?.userText).toBe('x'.repeat(240))
    expect(response.result.value.turns[0]?.replyText).toBe('x'.repeat(240))
  })

  it('returns an empty list for a session without turns', async () => {
    const ctx = await composed()
    const session = liveAgent(ctx, 's-blank')
    const response = await api(ctx).sessions.outline(request({ sessionId: session.id }), new AbortController().signal)
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value.turns).toEqual([])
  })

  it('fails with session-not-found for unknown ids', async () => {
    const ctx = await composed()
    ctx.provide('sessionPersistence', {
      list: () => Promise.resolve([]),
      inspect: () => Promise.reject(new Error('must not inspect')),
    } as never)
    const response = await api(ctx).sessions.outline(request({ sessionId: sid('s-missing') }), new AbortController().signal)
    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error.code).toBe('session-not-found')
  })

  it('cancels when the signal is already aborted', async () => {
    const ctx = await composed()
    const session = liveAgent(ctx, 's-abort')
    const controller = new AbortController()
    controller.abort()
    const response = await api(ctx).sessions.outline(request({ sessionId: session.id }), controller.signal)
    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error.code).toBe('cancelled')
  })
})
