/**
 * @attestto/wir-sas — Solana Attestation Service provider
 *
 * Discovers on-chain attestations for a wallet — vLEI, DID identity,
 * and custom attestation schemas.
 *
 * No hardcoded endpoints — consumer must provide all URLs.
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from 'wallet-identity-resolver'

export interface SasOptions {
  /** SAS program ID (required) */
  programId: string
  /** Solana RPC endpoint (required for on-chain lookup) */
  rpcUrl: string
  /** API endpoint for structured attestation data (optional, preferred over raw RPC) */
  apiUrl?: string
  /** Filter by specific schema IDs (empty = all schemas) */
  schemaIds?: string[]
}

export function sas(options: SasOptions): IdentityProvider {
  const { programId, rpcUrl, schemaIds = [], apiUrl } = options

  return {
    name: 'sas',
    chains: ['solana'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      const rpc = ctx.rpcUrl ?? rpcUrl
      if (!rpc && !apiUrl) return []

      const attestations = await findAttestations(
        ctx.address, programId, schemaIds, rpc, apiUrl, ctx.signal,
      )
      return attestations.map((att) => ({
        provider: 'sas',
        did: att.subjectDid,
        label: att.schemaName ?? 'SAS Attestation',
        type: 'attestation' as const,
        meta: {
          schemaId: att.schemaId,
          attester: att.attester,
          timestamp: att.timestamp,
          revoked: att.revoked,
        },
      }))
    },
  }
}

interface SasAttestation {
  schemaId: string
  schemaName: string | null
  subjectDid: string | null
  attester: string
  timestamp: string
  revoked: boolean
}

async function findAttestations(
  address: string,
  programId: string,
  schemaIds: string[],
  rpcUrl?: string,
  apiUrl?: string,
  signal?: AbortSignal,
): Promise<SasAttestation[]> {
  if (apiUrl) {
    try {
      const params = new URLSearchParams({ address })
      if (schemaIds.length) params.set('schemas', schemaIds.join(','))
      const res = await fetch(`${apiUrl}/attestations?${params}`, { signal })
      if (!res.ok) return []
      const data = await res.json() as { attestations?: SasAttestation[] }
      return data.attestations ?? []
    } catch {
      return []
    }
  }

  if (!rpcUrl) return []
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getProgramAccounts',
        params: [
          programId,
          {
            encoding: 'jsonParsed',
            filters: [{ memcmp: { offset: 8, bytes: address } }],
          },
        ],
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as {
      result?: Array<{ pubkey: string; account: { data: unknown } }>
    }
    if (!data.result?.length) return []

    return data.result.map((acc) => ({
      schemaId: 'unknown',
      schemaName: null,
      subjectDid: null,
      attester: acc.pubkey,
      timestamp: new Date().toISOString(),
      revoked: false,
    }))
  } catch {
    return []
  }
}
