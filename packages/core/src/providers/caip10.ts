/**
 * CAIP-10 provider — always-available degraded fallback.
 *
 * Derives a chain-agnostic CAIP-10 account identifier from the raw wallet
 * address when no higher-priority identity (did:sns, SBT, attestation) is found.
 *
 * Output format: `caip10:<namespace>:<reference>:<address>`
 * Example:       `caip10:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:ABC123...`
 *
 * This supersedes the deprecated `did:pkh` provider. Unlike `did:pkh`, CAIP-10
 * is not a DID method — it is an honest representation of an unresolved chain
 * account. Resolvers that encounter a CAIP-10 identifier can look up a bound
 * did:sns via the SAS cross-chain binding registry (opt-in, user-controlled).
 *
 * CHAIN_PREFIXES maps internal chain names to CAIP-2 chain IDs:
 *   solana   → solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp  (mainnet)
 *   ethereum → eip155:1                                   (mainnet)
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from '../types'

const CHAIN_PREFIXES: Record<string, string> = {
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  ethereum: 'eip155:1',
}

export interface Caip10Options {
  /** Override the CAIP-2 chain ID prefix (default: auto-detect from chain) */
  chainId?: string
}

export function caip10(options: Caip10Options = {}): IdentityProvider {
  return {
    name: 'caip10',
    chains: ['*'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      const chainId = options.chainId ?? CHAIN_PREFIXES[ctx.chain] ?? ctx.chain
      const identifier = `caip10:${chainId}:${ctx.address}`

      return [
        {
          provider: 'caip10',
          did: null, // CAIP-10 is not a DID — resolvers must look up a bound did:sns
          label: `${ctx.address.slice(0, 6)}...${ctx.address.slice(-4)}`,
          type: 'address',
          meta: { chain: ctx.chain, chainId, caip10: identifier, derived: true },
        },
      ]
    },
  }
}
