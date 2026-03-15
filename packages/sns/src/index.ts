/**
 * @attestto/wir-sns — SNS (Solana Name Service) provider
 *
 * Reverse-resolves SNS domains for a Solana public key, then optionally
 * verifies a DID Document is attached (only Attestto-enabled domains have one).
 *
 * No hardcoded endpoints — consumer must provide all URLs.
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from 'wallet-identity-resolver'

export interface SnsOptions {
  /** SNS reverse lookup API endpoint (required) */
  apiUrl: string
  /** DID resolver endpoint for verifying DID Documents (required if requireDidDocument is true) */
  resolverUrl?: string
  /** Only return domains that have a DID Document attached (default true) */
  requireDidDocument?: boolean
}

export function sns(options: SnsOptions): IdentityProvider {
  const { apiUrl, resolverUrl, requireDidDocument = true } = options

  return {
    name: 'sns',
    chains: ['solana'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      if (!apiUrl) return []

      const domains = await reverseLookup(ctx.address, apiUrl, ctx.signal)
      if (domains.length === 0) return []

      const results: ResolvedIdentity[] = []

      for (const domain of domains) {
        if (requireDidDocument) {
          if (!resolverUrl) return []
          const hasDid = await checkDidDocument(domain, resolverUrl, ctx.signal)
          if (!hasDid) continue
        }

        results.push({
          provider: 'sns',
          did: `did:sns:${domain}`,
          label: domain,
          type: 'domain',
          meta: { domain, hasDidDocument: requireDidDocument },
        })
      }

      return results
    },
  }
}

async function reverseLookup(
  address: string,
  apiUrl: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(`${apiUrl}/reverse/${address}`, { signal })
    if (!res.ok) return []
    const data = await res.json() as { result?: string[] }
    if (Array.isArray(data.result)) return data.result
    return []
  } catch {
    return []
  }
}

async function checkDidDocument(
  domain: string,
  resolverUrl: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const cleanDomain = domain.replace(/\.sol$/, '')
    const res = await fetch(
      `${resolverUrl}/1.0/identifiers/did:sns:${cleanDomain}`,
      { signal },
    )
    return res.ok
  } catch {
    return false
  }
}
