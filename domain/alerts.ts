import { alertDedupeKey } from './dedupe.ts';

export type AlertType =
  | 'new_match'
  | 'procurement_changed'
  | 'deadline_near'
  | 'item_reclassified';

export type AlertPreferences = {
  email: boolean;
  enabledTypes: AlertType[];
};

export type AlertCandidate = {
  organizationId: string;
  procurementId: string;
  type: AlertType;
  version?: string;
};

export type AlertDecision =
  | { send: true; dedupeKey: string; reason: 'enabled' }
  | { send: false; reason: 'email_opted_out' | 'type_disabled' };

export function decideAlert(
  candidate: AlertCandidate,
  preferences: AlertPreferences,
): AlertDecision {
  if (!preferences.email) return { send: false, reason: 'email_opted_out' };
  if (!preferences.enabledTypes.includes(candidate.type))
    return { send: false, reason: 'type_disabled' };
  return {
    send: true,
    reason: 'enabled',
    dedupeKey: alertDedupeKey(
      candidate.organizationId,
      candidate.procurementId,
      candidate.type,
      candidate.version,
    ),
  };
}

export function isWithinDeadline(deadline: Date, now: Date, hours = 48) {
  const remaining = deadline.getTime() - now.getTime();
  return remaining >= 0 && remaining <= hours * 60 * 60 * 1000;
}
