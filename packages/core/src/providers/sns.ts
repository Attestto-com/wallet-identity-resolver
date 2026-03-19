/**
 * did:sns provider — SNS (Solana Name Service) reverse resolution.
 *
 * Resolves SNS .sol domains for a Solana address via the Bonfida
 * SNS SDK proxy API, with optional favourite domain detection.
 *
 * No heavy dependencies — uses fetch only.
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from '../types'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SnsOptions {
  /**
   * SNS API base URL.
   * Default: https://sns-sdk-proxy.bonfida.workers.dev
   */
  apiUrl?: string
  /** DID resolver endpoint for verifying DID Documents */
  resolverUrl?: string
  /** Only return domains that have a DID Document attached (default false) */
  requireDidDocument?: boolean
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

export function sns(options: SnsOptions = {}): IdentityProvider {
  const {
    apiUrl = 'https://sns-sdk-proxy.bonfida.workers.dev',
    resolverUrl,
    requireDidDocument = false,
  } = options

  return {
    name: 'sns',
    chains: ['solana'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      // 1. Reverse-lookup all domains owned by this address
      const domains = await reverseLookup(ctx.address, apiUrl, ctx.signal)
      if (domains.length === 0) return []

      // 2. Try to detect the favourite (primary) domain
      const favourite = await getFavouriteDomain(ctx.address, apiUrl, ctx.signal)

      // 3. Sort: favourite first, then by domain length (shorter = more personal)
      const sorted = sortDomains(domains, favourite)

      // 4. Optionally filter to only domains with DID Documents
      const results: ResolvedIdentity[] = []

      for (const entry of sorted) {
        const domain = entry.domain.endsWith('.sol')
          ? entry.domain
          : `${entry.domain}.sol`

        if (requireDidDocument && resolverUrl) {
          const hasDid = await checkDidDocument(domain, resolverUrl, ctx.signal)
          if (!hasDid) continue
        }

        results.push({
          provider: 'sns',
          did: `did:sns:${domain}`,
          label: domain,
          type: 'domain',
          meta: {
            domain,
            key: entry.key,
            isFavourite: entry.domain === favourite,
            hasDidDocument: requireDidDocument,
          },
        })
      }

      return results
    },
  }
}

// ---------------------------------------------------------------------------
// Bonfida API helpers
// ---------------------------------------------------------------------------

interface SnsDomainEntry {
  key: string
  domain: string
}

async function reverseLookup(
  address: string,
  apiUrl: string,
  signal?: AbortSignal,
): Promise<SnsDomainEntry[]> {
  try {
    const res = await fetch(`${apiUrl}/domains/${address}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []

    const data = (await res.json()) as { s: string; result: SnsDomainEntry[] }
    if (data.s !== 'ok' || !Array.isArray(data.result)) return []

    return data.result
  } catch {
    return []
  }
}

async function getFavouriteDomain(
  address: string,
  apiUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/favorite-domain/${address}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null

    const data = (await res.json()) as { s: string; result: string | { domain: string; reverse: string } }
    if (data.s !== 'ok' || !data.result) return null

    if (typeof data.result === 'string') return data.result
    // API returns { domain: accountKey, reverse: domainName }
    return data.result.reverse || data.result.domain
  } catch {
    return null
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

function sortDomains(
  domains: SnsDomainEntry[],
  favourite: string | null,
): SnsDomainEntry[] {
  return [...domains].sort((a, b) => {
    if (favourite) {
      if (a.domain === favourite) return -1
      if (b.domain === favourite) return 1
    }
    return a.domain.length - b.domain.length
  })
}
