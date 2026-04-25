import React from 'react';
import {confetti} from '@tsparticles/confetti';
import {getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../../utils/timerState';


const TIMER_EFFECT_CUES = [
    {
        key: 'start-countdown',
        secondsRemaining: 20 * 60 + 10,
        startOffsetSeconds: 0,
        durationSeconds: 27.214,
        volume: 1,
        src: '/static/sounds/start_countdown.mp3'
    },
    {
        key: 'mid-game-warning',
        secondsRemaining: 10 * 60 + 10,
        startOffsetSeconds: 0,
        durationSeconds: 7.601,
        volume: 1,
        src: '/static/sounds/10_minute_warning.mp3'
    },
    {
        key: 'end-countdown',
        secondsRemaining: 10,
        startOffsetSeconds: 0,
        durationSeconds: 18.107,
        volume: 1,
        src: '/static/sounds/end_countdown.mp3'
    }
];

const TICK_MS = 250;


function emitDebugEvent(type, payload) {
    if (typeof window === 'undefined') return;

    const event = Object.assign({type, at: window.performance.now()}, payload || {});
    if (!window.__beamerTimerEffects) {
        window.__beamerTimerEffects = {events: []};
    }
    window.__beamerTimerEffects.events.push(event);
    window.dispatchEvent(new CustomEvent('beamer-timer-effect', {detail: event}));
}


function triggerConfetti() {
    emitDebugEvent('confetti');

    confetti({
        particleCount: 180,
        spread: 90,
        startVelocity: 45,
        decay: 0.92,
        gravity: 0.9,
        origin: {x: 0.5, y: 0.5},
        zIndex: 2147483647
    })
        .catch(error => {
            emitDebugEvent('confetti-error', {message: error.message});
        });
}


export class BeamerTimerEffects extends React.Component {
    constructor(props) {
        super(props);
        this.activeSounds = [];
        this.firedCueKeys = {};
        this.previousSecondsRemaining = null;
        this.timerSessionKey = null;
        this.finishedTriggered = false;

        this.tick = this.tick.bind(this);
    }

    componentDidMount() {
        this.tick();
        this.intervalId = setInterval(this.tick, TICK_MS);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.timerState !== this.props.timerState) {
            this.tick();
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
        this.stopActiveSounds('unmount');
    }

    resetSessionIfNeeded(timerState) {
        const nextKey = timerState && timerState.mode && timerState.timestampIso ?
            timerState.mode + ':' + timerState.timestampIso :
            null;

        if (nextKey === this.timerSessionKey) return;

        this.timerSessionKey = nextKey;
        this.firedCueKeys = {};
        this.previousSecondsRemaining = null;
        this.finishedTriggered = false;
        this.stopActiveSounds('timer-changed');
    }

    tick() {
        const {timerState} = this.props;
        this.resetSessionIfNeeded(timerState);

        const display = getTimerDisplay(timerState, Date.now());
        if (!display.active || display.mode !== TIMER_MODE_COUNTDOWN) {
            this.previousSecondsRemaining = null;
            this.finishedTriggered = false;
            this.stopActiveSounds('timer-inactive');
            return;
        }

        const secondsRemaining = Math.floor(display.ms / 1000);
        if (secondsRemaining <= 0) {
            this.stopActiveSounds('timer-finished');
            if (!this.finishedTriggered) {
                this.finishedTriggered = true;
                triggerConfetti();
            }
            this.previousSecondsRemaining = secondsRemaining;
            return;
        }

        TIMER_EFFECT_CUES.forEach(cue => {
            if (this.firedCueKeys[cue.key]) return;

            const cueStartSeconds = this.getCueStartSeconds(cue);
            const elapsedSeconds = Math.max(0, cueStartSeconds - secondsRemaining);
            const canSyncFromElapsed = elapsedSeconds < cue.durationSeconds;
            const crossedCue = this.previousSecondsRemaining !== null &&
                this.previousSecondsRemaining > cueStartSeconds &&
                secondsRemaining <= cueStartSeconds;
            const loadedDuringCue = this.previousSecondsRemaining === null &&
                secondsRemaining <= cueStartSeconds &&
                canSyncFromElapsed;

            if (crossedCue || loadedDuringCue || secondsRemaining === cueStartSeconds) {
                this.firedCueKeys[cue.key] = true;
                if (canSyncFromElapsed) {
                    this.playCue(cue, elapsedSeconds);
                } else {
                    emitDebugEvent('sound-skip', {
                        cue: cue.key,
                        elapsedSeconds,
                        src: cue.src
                    });
                }
            }
        });

        this.previousSecondsRemaining = secondsRemaining;
    }

    getCueStartSeconds(cue) {
        return cue.secondsRemaining + cue.startOffsetSeconds;
    }

    playCue(cue, elapsedSeconds) {
        if (typeof window === 'undefined' || typeof Audio === 'undefined') {
            emitDebugEvent('sound-unavailable', {reason: 'no-audio-element'});
            return;
        }

        this.stopActiveSounds('next-cue');
        emitDebugEvent('sound', {
            cue: cue.key,
            elapsedSeconds,
            src: cue.src,
            startOffsetSeconds: cue.startOffsetSeconds
        });

        const audio = new Audio(cue.src);
        audio.preload = 'auto';
        audio.volume = cue.volume;
        this.activeSounds.push(audio);

        const startPlayback = () => {
            try {
                audio.currentTime = elapsedSeconds;
                const playResult = audio.play();
                if (playResult && playResult.catch) {
                    playResult.catch(error => {
                        emitDebugEvent('sound-unavailable', {
                            reason: 'play-blocked',
                            message: error.message
                        });
                    });
                }
            } catch (error) {
                emitDebugEvent('sound-unavailable', {
                    reason: 'play-error',
                    message: error.message
                });
            }
        };

        if (audio.readyState >= 1) {
            startPlayback();
        } else {
            audio.addEventListener('loadedmetadata', startPlayback, {once: true});
            audio.load();
        }
    }

    stopActiveSounds(reason) {
        if (this.activeSounds.length === 0) return;

        this.activeSounds.forEach(audio => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                // Stopping detached media can throw. Safe to ignore.
            }
        });
        this.activeSounds = [];
        emitDebugEvent('sound-stop', {reason});
    }

    render() {
        return null;
    }
}
