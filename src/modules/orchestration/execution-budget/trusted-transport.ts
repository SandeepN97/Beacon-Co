/**
 * Fixes B3 (independent security review of PR #83, candidate
 * e895f60e72f912221b7bf9d001d8aa49bdd993eb): `executeBudgetedProviderCall` used
 * to trust whatever `transport.executionBudgetContract(provider)` claimed about
 * itself. `ProviderTransport` is a structural TypeScript interface -- any object
 * with the right method names satisfies it at compile time, so an arbitrary or
 * malicious implementation could simply return the "single-generation" shape
 * live execution requires and cross straight into the enforcement boundary.
 * Self-attestation is not certification.
 *
 * This module is a minimal, non-exported-mutable sealing primitive: a
 * module-private `WeakSet` that only this file can write to, and that a
 * transport implementation's own constructor calls into to register itself.
 * A plain object literal, a hand-built mock, or a subclass built without going
 * through the real constructor is never a member of the set no matter what
 * methods it exposes. Combined with an exact-prototype check at the call site
 * (see live-adapter-support.ts), this also rejects a subclass that overrides
 * `invoke`/`executionBudgetContract` while still passing `instanceof`.
 *
 * Deliberately generic and dependency-free: it knows nothing about
 * HttpProviderTransport or CodexCliTransport specifically, so certifying a
 * transport and trusting a transport stay separate, composable steps instead
 * of one large tangled module.
 */

const certifiedTransportInstances = new WeakSet<object>();

/** Called only from within a trusted transport's own constructor. */
export function certifyTransportInstance(instance: object): void {
  certifiedTransportInstances.add(instance);
}

export function isCertifiedTransportInstance(instance: object): boolean {
  return certifiedTransportInstances.has(instance);
}
