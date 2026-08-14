/** Minimal DSH carrier client for the desktop app's main process. */
import { randomUUID } from 'node:crypto'

export interface RpcOk<T> {
  ok: true
  value: T
}

export interface RpcFail {
  ok: false
  error: { code: string; message: string; details: Record<string, unknown> }
}

export type RpcResult<T> = RpcOk<T> | RpcFail

/** Call one unary RPC on the local DSH server. */
export async function callRpc<T>(
  baseUrl: string,
  method: string,
  payload: unknown,
  timeoutMs = 15000,
): Promise<RpcResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', method, rpcId: randomUUID(), payload }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const envelope = await response.json() as { result?: unknown }
    const result = envelope.result as RpcResult<T> | undefined
    if (result === undefined || typeof result.ok !== 'boolean') throw new Error('malformed response')
    return result
  } catch (error) {
    return {
      ok: false,
      error: { code: 'transport', message: error instanceof Error ? error.message : String(error), details: {} },
    }
  } finally {
    clearTimeout(timer)
  }
}
