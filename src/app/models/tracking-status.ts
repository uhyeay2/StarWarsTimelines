export const TRACKING_STATUSES = ['In progress', 'Completed', 'Wish Listed'] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export function statusFromApiCode(code: number): TrackingStatus {
  const status = TRACKING_STATUSES[code];
  if (status === undefined) {
    throw new Error(`Unknown status code: ${code}`);
  }
  return status;
}

export function statusToApiCode(status: TrackingStatus): number {
  const code = TRACKING_STATUSES.indexOf(status);
  if (code < 0) {
    throw new Error(`Unknown status: ${status}`);
  }
  return code;
}
