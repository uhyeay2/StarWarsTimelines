export const CANON_TIMELINES = ['Canon', 'Legends'];
export const CANON_VIEWS = ['Canon', 'Legends', 'Canon & Legends'];
export function matchesCanonView(canon, view) {
    if (view === 'Canon & Legends') {
        return canon.includes('Canon') && canon.includes('Legends');
    }
    return canon.includes(view);
}
