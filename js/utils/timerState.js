export const TIMER_MODE_COUNTDOWN = 'countdown';
export const TIMER_MODE_COUNTUP = 'countup';
export const TIMER_REASON_TOURNAMENT_START = 'tournament_start';
export const TIMER_REASON_PLAYOFF_START = 'playoff_start';
export const TIMER_REASON_MATCH_END = 'match_end';
export const TIMER_REASON_CUSTOM = 'custom';

export const TIMER_REASON_OPTIONS = [
    {value: TIMER_REASON_TOURNAMENT_START, label: 'Turnierstart'},
    {value: TIMER_REASON_PLAYOFF_START, label: 'Playoff-Start'},
    {value: TIMER_REASON_MATCH_END, label: 'Spielende'},
    {value: TIMER_REASON_CUSTOM, label: 'Eigener Text'}
];

const TIMER_REASON_LABELS = TIMER_REASON_OPTIONS.reduce((labels, option) => {
    labels[option.value] = option.label;
    return labels;
}, {});

export const inactiveTimerState = {
    mode: null,
    timestampIso: null,
    reason: null,
    reasonText: null
};

export function normalizeTimerState(timerPayload) {
    const mode = timerPayload && timerPayload.timer_mode ?
        timerPayload.timer_mode :
        null;
    const timestampIso = timerPayload && timerPayload.timestamp ?
        timerPayload.timestamp :
        null;
    const reason = timerPayload && timerPayload.timer_reason ?
        timerPayload.timer_reason :
        null;
    const reasonText = timerPayload && timerPayload.timer_reason_text ?
        String(timerPayload.timer_reason_text).trim() :
        null;

    if (!mode || !timestampIso) {
        return inactiveTimerState;
    }

    if (mode !== TIMER_MODE_COUNTDOWN && mode !== TIMER_MODE_COUNTUP) {
        return inactiveTimerState;
    }

    return {
        mode,
        timestampIso,
        reason,
        reasonText: reasonText || null
    };
}

export function getTimerReasonLabel(timerState) {
    if (!timerState || !timerState.mode) {
        return 'Timer';
    }

    if (timerState.reason === TIMER_REASON_CUSTOM && timerState.reasonText) {
        return timerState.reasonText;
    }

    if (timerState.reason && TIMER_REASON_LABELS[timerState.reason]) {
        return TIMER_REASON_LABELS[timerState.reason];
    }

    return TIMER_REASON_LABELS[TIMER_REASON_MATCH_END];
}

export function getTimerDisplay(timerState, nowMs) {
    if (!timerState || !timerState.mode || !timerState.timestampIso) {
        return {active: false, ms: 0, mode: null};
    }

    const timestampMs = new Date(timerState.timestampIso).getTime();
    if (!Number.isFinite(timestampMs)) {
        return {active: false, ms: 0, mode: null};
    }

    if (timerState.mode === TIMER_MODE_COUNTDOWN) {
        return {
            active: true,
            ms: Math.max(0, timestampMs - nowMs),
            mode: TIMER_MODE_COUNTDOWN
        };
    }

    return {
        active: true,
        ms: Math.max(0, nowMs - timestampMs),
        mode: TIMER_MODE_COUNTUP
    };
}

// Compatibility for older backend payloads. Remove once all callers use
// timestamp + timer_mode only.
export function normalizeTournamentTimerState(apiTournament) {
    if (apiTournament && (
        Object.prototype.hasOwnProperty.call(apiTournament, 'timestamp') ||
        Object.prototype.hasOwnProperty.call(apiTournament, 'timer_mode')
    )) {
        return normalizeTimerState(apiTournament);
    }

    if (apiTournament && apiTournament.timer_end) {
        return {
            mode: TIMER_MODE_COUNTDOWN,
            timestampIso: apiTournament.timer_end,
            reason: null,
            reasonText: null
        };
    }

    return inactiveTimerState;
}
