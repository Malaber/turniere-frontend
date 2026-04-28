export const TIMER_MODE_COUNTDOWN = 'countdown';
export const TIMER_MODE_COUNTUP = 'countup';

export const inactiveTimerState = {
    mode: null,
    timestampIso: null
};

export function normalizeTimerState(timerPayload) {
    const mode = timerPayload && timerPayload.timer_mode ?
        timerPayload.timer_mode :
        null;
    const timestampIso = timerPayload && timerPayload.timestamp ?
        timerPayload.timestamp :
        null;

    if (!mode || !timestampIso) {
        return inactiveTimerState;
    }

    if (mode !== TIMER_MODE_COUNTDOWN && mode !== TIMER_MODE_COUNTUP) {
        return inactiveTimerState;
    }

    return {mode, timestampIso};
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

export function formatTimerMs(ms, {labelHours = false} = {}) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const formattedSeconds = String(seconds).padStart(2, '0');
    const formattedMinutes = hours > 0 ?
        String(minutes).padStart(2, '0') :
        String(minutes);

    if (hours > 0) {
        const hourSeparator = labelHours ? 'h ' : ':';
        return hours + hourSeparator + formattedMinutes + ':' + formattedSeconds;
    }

    return formattedMinutes + ':' + formattedSeconds;
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
            timestampIso: apiTournament.timer_end
        };
    }

    return inactiveTimerState;
}
