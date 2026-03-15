/**
 * @attestto/wir-ens — ENS (Ethereum Name Service) provider
 *
 * Reverse-resolves ENS names for an Ethereum address, optionally checking
 * whether the domain has a DID Document attached (did:ens).
 *
 * No hardcoded endpoints — consumer must provide all URLs.
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from 'wallet-identity-resolver'

export interface EnsOptions {
  /** DID resolver endpoint for ENS reverse resolution and DID Document checks (required) */
  resolverUrl: string
  /** Only return domains that have a DID Document attached (default false) */
  requireDidDocument?: boolean
}

export function ens(options: EnsOptions): IdentityProvider {
  const { resolverUrl, requireDidDocument = false } = options

  return {
    name: 'ens',
    chains: ['ethereum'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      if (!resolverUrl) return []

      const name = await reverseResolve(ctx.address, resolverUrl, ctx.signal)
      if (!name) return []

      if (requireDidDocument) {
        const hasDid = await checkDidDocument(name, resolverUrl, ctx.signal)
        if (!hasDid) return []
      }

      return [{
        provider: 'ens',
        did: `did:ens:${name}`,
        label: name,
        type: 'domain',
        meta: { domain: name, hasDidDocument: requireDidDocument },
      }]
    },
  }
}

async function reverseResolve(
  address: string,
  resolverUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${resolverUrl}/1.0/identifiers/did:ens:${address}`,
      { signal },
    )
    if (!res.ok) return null
    const data = await res.json() as { didDocument?: { id?: string; alsoKnownAs?: string[] } }
    const did = data?.didDocument?.id
    if (did?.startsWith('did:ens:')) {
      const name = did.replace('did:ens:', '')
      if (name.endsWith('.eth')) return name
    }
    return null
  } catch {
    return null
  }
}

async function checkDidDocument(
  name: string,
  resolverUrl: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${resolverUrl}/1.0/identifiers/did:ens:${name}`,
      { signal },
    )
    return res.ok
  } catch {
    return false
  }
}
