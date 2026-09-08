/**
 * Distinguishes a pending Organization/Distributor signup from a Customer.
 *
 * The backend has NO Customer role — both are `UserType.OrganizationUser (2)`
 * with no `companyId` until an admin approves the distributor application.
 * So when this browser registered via the Organization path we persist a
 * marker (email-keyed, localStorage so it survives tabs). Guards treat a
 * marker-matching no-company user as "pending approval" and everyone else
 * as a Customer (buyer, no company needed).
 *
 * The marker is self-healing: it clears as soon as the user carries a
 * `companyId` (approved → Provider/Distributor).
 */

const STORAGE_KEY = 'welco-pending-org'

const normalize = (email?: string | null): string => (email ?? '').trim().toLowerCase()

export function setPendingOrg(email: string): void {
  try {
    const v = normalize(email)
    if (v) localStorage.setItem(STORAGE_KEY, v)
  } catch {
    /* storage unavailable — guards fall back to Customer */
  }
}

export function isPendingOrg(email?: string | null): boolean {
  try {
    const v = normalize(email)
    return !!v && localStorage.getItem(STORAGE_KEY) === v
  } catch {
    return false
  }
}

export function clearPendingOrg(email?: string | null): void {
  try {
    if (!email || normalize(localStorage.getItem(STORAGE_KEY)) === normalize(email)) {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

/** Call whenever the signed-in user changes: approval (companyId set) clears the marker. */
export function syncPendingOrgMarker(user?: { email?: string | null; companyId?: string | null } | null): void {
  if (!user) return
  if (user.companyId) clearPendingOrg(user.email)
}
