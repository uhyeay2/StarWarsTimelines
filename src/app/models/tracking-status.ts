export const TRACKING_STATUSES = ['In progress', 'Completed', 'Wish Listed'] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];
