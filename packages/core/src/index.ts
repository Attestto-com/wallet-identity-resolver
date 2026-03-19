export { resolveIdentities } from './resolve'
export type {
  Chain,
  ResolvedIdentity,
  IdentityType,
  ResolveContext,
  IdentityProvider,
  ResolveOptions,
} from './types'

// Built-in providers (zero dependencies, always available)
export { pkh, sns } from './providers'
