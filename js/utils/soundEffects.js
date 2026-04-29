export const BEAMER_SOUND_EFFECTS = [
    {
        key: 'start-countdown',
        label: 'Start-Countdown',
        src: '/static/sounds/start_countdown.mp3',
        volume: 1,
        durationSeconds: 27.214
    },
    {
        key: 'mid-game-warning',
        label: '10-Minuten-Warnung',
        src: '/static/sounds/10_minute_warning.mp3',
        volume: 1,
        durationSeconds: 7.601
    },
    {
        key: 'end-countdown',
        label: 'End-Countdown',
        src: '/static/sounds/end_countdown.mp3',
        volume: 1,
        durationSeconds: 18.107
    }
];

export function beamerSoundEffectForKey(key) {
    return BEAMER_SOUND_EFFECTS.find(effect => effect.key === key) || null;
}
