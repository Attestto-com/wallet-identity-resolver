/**
 * @attestto/wir-attestto-creds — Attestto Creds provider
 *
 * Discovers all Attestto-issued on-chain credentials for a wallet:
 * - Identity SBTs (wallet → DID binding)
 * - KYC verification tokens
 * - Verifiable credential attestations (via SAS)
 * - Any future Attestto credential types
 *
 * No hardcoded endpoints — consumer must provide all URLs.
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from 'wallet-identity-resolver'

export interface AttesttoCredsOptions {
  /** Attestto credential program ID on Solana (required) */
  programId: string
  /** Solana RPC endpoint (required for on-chain lookup) */
  rpcUrl: string
  /** Attestto API endpoint (recommended — richer data than raw RPC) */
  apiUrl?: string
  /** Which credential types to scan for (default: all) */
  types?: AttesttoCredentialType[]
}

export type AttesttoCredentialType = 'identity' | 'kyc' | 'credential' | 'attestation'

export function attesttoCreds(options: AttesttoCredsOptions): IdentityProvider {
  const { programId, rpcUrl, apiUrl, types } = options

  return {
    name: 'attestto-creds',
    chains: ['solana'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      const rpc = ctx.rpcUrl ?? rpcUrl
      if (!rpc && !apiUrl) return []

      // Prefer API if available — returns structured credential data
      if (apiUrl) {
        const creds = await fetchFromApi(ctx.address, apiUrl, types, ctx.signal)
        if (creds.length > 0) return creds
      }

      // Fallback: scan on-chain program accounts
      if (!rpc) return []
      return scanOnChain(ctx.address, programId, rpc, ctx.signal)
    },
  }
}

interface AttesttoCredential {
  type: AttesttoCredentialType
  did: string | null
  label: string
  domain: string | null
  tier: number | null
  tokenAddress: string
  verified: boolean
  issuedAt: string
  expiresAt: string | null
  schema: string | null
}

async function fetchFromApi(
  address: string,
  apiUrl: string,
  types?: AttesttoCredentialType[],
  signal?: AbortSignal,
): Promise<ResolvedIdentity[]> {
  try {
    const params = new URLSearchParams({ address })
    if (types?.length) params.set('types', types.join(','))

    const res = await fetch(`${apiUrl}/credentials?${params}`, { signal })
    if (!res.ok) return []

    const data = await res.json() as { credentials?: AttesttoCredential[] }
    if (!data.credentials?.length) return []

    return data.credentials.map((cred) => ({
      provider: 'attestto-creds',
      did: cred.did,
      label: cred.label,
      type: mapCredType(cred.type),
      meta: {
        credentialType: cred.type,
        domain: cred.domain,
        tier: cred.tier,
        tokenAddress: cred.tokenAddress,
        verified: cred.verified,
        issuedAt: cred.issuedAt,
        expiresAt: cred.expiresAt,
        schema: cred.schema,
      },
    }))
  } catch {
    return []
  }
}

async function scanOnChain(
  address: string,
  programId: string,
  rpcUrl: string,
  signal?: AbortSignal,
): Promise<ResolvedIdentity[]> {
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
            filters: [
              { memcmp: { offset: 8, bytes: address } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return []

    const data = await res.json() as {
      result?: Array<{ pubkey: string; account: { data: unknown } }>
    }
    if (!data.result?.length) return []

    return data.result.map((account) => ({
      provider: 'attestto-creds',
      did: null,
      label: 'Attestto Credential',
      type: 'credential' as const,
      meta: {
        tokenAddress: account.pubkey,
        raw: account.account.data,
      },
    }))
  } catch {
    return []
  }
}

function mapCredType(type: AttesttoCredentialType): ResolvedIdentity['type'] {
  switch (type) {
    case 'identity': return 'sbt'
    case 'kyc': return 'sbt'
    case 'credential': return 'credential'
    case 'attestation': return 'attestation'
    default: return 'credential'
  }
}
