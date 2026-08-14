import { describe, expect, it } from 'vitest'
import { deriveKeyRef, getPath, listProviderKeys, setProviderKey, unsetProviderKey } from '../src/models.ts'
import type { RpcResult } from '../src/rpc.ts'

function ok<T>(value: T): RpcResult<T> { return { ok: true, value } }
function fail(): RpcResult<never> { return { ok: false, error: { code: 'x', message: 'boom', details: {} } } }

describe('deriveKeyRef', () => {
  it('derives the conventional reference', () => {
    expect(deriveKeyRef('deepseek-official')).toBe('DEEPSEEK_OFFICIAL_API_KEY')
    expect(deriveKeyRef('minimax-cn')).toBe('MINIMAX_CN_API_KEY')
    expect(deriveKeyRef('openai')).toBe('OPENAI_API_KEY')
  })
})

describe('getPath', () => {
  it('walks nested trees', () => {
    const tree = { a: { b: { c: 1 } } }
    expect(getPath(tree, ['a', 'b', 'c'])).toBe(1)
    expect(getPath(tree, ['a'])).toEqual({ b: { c: 1 } })
    expect(getPath(tree, [])).toEqual(tree)
    expect(getPath(tree, ['a', 'x'])).toBeUndefined()
    expect(getPath('not-object', ['a'])).toBeUndefined()
  })
})

describe('listProviderKeys', () => {
  it('merges provider directory, settings refs, and credential state', async () => {
    const calls: { method: string; payload: unknown }[] = []
    const fakeCall = async <T>(_base: string, method: string, payload: unknown): Promise<RpcResult<T>> => {
      calls.push({ method, payload })
      if (method === 'llm.providers') {
        return ok({
          providers: [
            { provider: 'deepseek-official', displayName: 'DeepSeek', settingsNs: 'llm-deepseek', settingsPath: [], active: true },
            { provider: 'openai', displayName: 'OpenAI', settingsNs: 'llm-pi-ai', settingsPath: ['openai'], active: false },
          ],
        }) as RpcResult<T>
      }
      if (method === 'settings.describe') {
        return ok({
          writable: true,
          namespaces: [
            { ns: 'llm-deepseek', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' } },
            { ns: 'llm-pi-ai', value: { openai: { apiKeyEnv: 'OPENAI_API_KEY' } } },
          ],
        }) as RpcResult<T>
      }
      if (method === 'credentials.describe') {
        const refs = (payload as { refs: string[] }).refs
        const credentials: Record<string, { configured: boolean; source?: string; writable: boolean }> = {}
        for (const ref of refs) {
          credentials[ref] = ref === 'DEEPSEEK_API_KEY'
            ? { configured: true, source: 'file', writable: true }
            : { configured: false, writable: true }
        }
        return ok({ credentials }) as RpcResult<T>
      }
      return fail() as RpcResult<T>
    }

    const result = await listProviderKeys('http://x', fakeCall as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.providers).toHaveLength(2)
    expect(result.value.providers[0]).toMatchObject({
      provider: 'deepseek-official',
      keyRef: 'DEEPSEEK_API_KEY',
      configured: true,
      source: 'file',
      writable: true,
    })
    expect(result.value.providers[1]).toMatchObject({
      provider: 'openai',
      keyRef: 'OPENAI_API_KEY',
      configured: false,
    })
    // The credential describe batch used the resolved refs.
    const credCall = calls.find(c => c.method === 'credentials.describe')
    expect(credCall?.payload).toEqual({ refs: ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY'] })
  })

  it('falls back to the derived ref when the profile has no apiKeyEnv', async () => {
    const fakeCall = async <T>(_base: string, method: string): Promise<RpcResult<T>> => {
      if (method === 'llm.providers') {
        return ok({ providers: [{ provider: 'openai', displayName: 'OpenAI', settingsNs: 'llm-pi-ai', settingsPath: ['openai'], active: true }] }) as RpcResult<T>
      }
      if (method === 'settings.describe') return ok({ writable: true, namespaces: [{ ns: 'llm-pi-ai', value: {} }] }) as RpcResult<T>
      if (method === 'credentials.describe') return ok({ credentials: {} }) as RpcResult<T>
      return fail() as RpcResult<T>
    }
    const result = await listProviderKeys('http://x', fakeCall as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.providers[0]?.keyRef).toBe('OPENAI_API_KEY')
  })
})

describe('key writes', () => {
  it('set and unset forward the ref and value', async () => {
    const seen: unknown[] = []
    const fakeCall = async <T>(_base: string, method: string, payload: unknown): Promise<RpcResult<T>> => {
      seen.push({ method, payload })
      return ok({}) as RpcResult<T>
    }
    await setProviderKey('http://x', 'OPENAI_API_KEY', 'sk-123', fakeCall as never)
    await unsetProviderKey('http://x', 'OPENAI_API_KEY', fakeCall as never)
    expect(seen).toEqual([
      { method: 'credentials.set', payload: { ref: 'OPENAI_API_KEY', value: 'sk-123' } },
      { method: 'credentials.unset', payload: { ref: 'OPENAI_API_KEY' } },
    ])
  })
})
