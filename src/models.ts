/** Model-provider API key management over the DSH host RPCs. */
import { callRpc, type RpcResult } from './rpc.js'

/** Wire shape of llm.providers rows. */
interface ConfigurableProviderView {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: string[]
  active: boolean
}

/** One provider's key-management row. */
export interface ProviderKeyInfo {
  provider: string
  displayName: string
  active: boolean
  keyRef: string
  configured: boolean
  source?: string
  writable: boolean
}

/** Derive the conventional credential reference for a provider route (mirrors the web client). */
export function deriveKeyRef(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/** Read a value at a settings path (empty path = the root). */
export function getPath(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

type Caller = typeof callRpc

/** List every configurable provider with its API-key reference and state. */
export async function listProviderKeys(
  baseUrl: string,
  call: Caller = callRpc,
): Promise<RpcResult<{ providers: ProviderKeyInfo[] }>> {
  const providers = await call<{ providers: ConfigurableProviderView[] }>(baseUrl, 'llm.providers', {})
  if (!providers.ok) return providers
  const settings = await call<{ writable: boolean; namespaces: { ns: string; value: unknown }[] }>(
    baseUrl,
    'settings.describe',
    {},
  )
  const refs = new Map<string, string>()
  for (const provider of providers.value.providers) {
    const namespace = settings.ok
      ? settings.value.namespaces.find(candidate => candidate.ns === provider.settingsNs)
      : undefined
    const profile = getPath(namespace?.value, provider.settingsPath)
    const named = typeof profile === 'object' && profile !== null
      ? (profile as { apiKeyEnv?: unknown }).apiKeyEnv
      : undefined
    refs.set(provider.provider, typeof named === 'string' && named.length > 0 ? named : deriveKeyRef(provider.provider))
  }
  const credentials = await call<{ credentials: Record<string, { configured: boolean; source?: string; writable: boolean }> }>(
    baseUrl,
    'credentials.describe',
    { refs: [...refs.values()] },
  )
  return {
    ok: true,
    value: {
      providers: providers.value.providers.map(provider => {
        const ref = refs.get(provider.provider) ?? deriveKeyRef(provider.provider)
        const view = credentials.ok ? credentials.value.credentials[ref] : undefined
        return {
          provider: provider.provider,
          displayName: provider.displayName,
          active: provider.active,
          keyRef: ref,
          configured: view?.configured ?? false,
          source: view?.source,
          writable: view?.writable ?? true,
        }
      }),
    },
  }
}

/** Store one provider key under its reference. */
export async function setProviderKey(
  baseUrl: string,
  ref: string,
  value: string,
  call: Caller = callRpc,
): Promise<RpcResult<{}>> {
  return call<{}>(baseUrl, 'credentials.set', { ref, value })
}

/** Remove one provider key. */
export async function unsetProviderKey(
  baseUrl: string,
  ref: string,
  call: Caller = callRpc,
): Promise<RpcResult<{}>> {
  return call<{}>(baseUrl, 'credentials.unset', { ref })
}
