export function playoffStageName(level) {
    const parsed = Number(level);
    if (!Number.isFinite(parsed)) {
        return '';
    }

    const names = ['Finale', 'Halbfinale', 'Viertelfinale', 'Achtelfinale'];
    if (parsed >= 0 && parsed < names.length) {
        return names[parsed];
    }

    return Math.pow(2, parsed) + 'tel Finale';
}

export function groupRoundStageName(position) {
    const parsed = Number(position);
    if (!Number.isFinite(parsed)) {
        return '';
    }

    return 'Gruppe - Runde ' + (parsed + 1);
}
