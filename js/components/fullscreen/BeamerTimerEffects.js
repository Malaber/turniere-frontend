import React from 'react';
import {confetti} from '@tsparticles/confetti';
import {getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../../utils/timerState';


const TIMER_EFFECT_CUES = [
    {
        key: 'start-countdown',
        secondsRemaining: 20 * 60 + 10,
        pattern: [
            {frequency: 440, durationMs: 260},
            {frequency: 660, durationMs: 260},
            {frequency: 880, durationMs: 420}
        ]
    },
    {
        key: 'mid-game-warning',
        secondsRemaining: 10 * 60 + 10,
        pattern: [
            {frequency: 660, durationMs: 220},
            {frequency: 660, durationMs: 220},
            {frequency: 520, durationMs: 480}
        ]
    },
    {
        key: 'end-countdown',
        secondsRemaining: 10,
        pattern: [
            {frequency: 880, durationMs: 180},
            {frequency: 740, durationMs: 180},
            {frequency: 880, durationMs: 180},
            {frequency: 740, durationMs: 180},
            {frequency: 988, durationMs: 700}
        ]
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
        this.audioContext = null;
        this.activeNodes = [];
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

            const crossedCue = this.previousSecondsRemaining !== null &&
                this.previousSecondsRemaining > cue.secondsRemaining &&
                secondsRemaining <= cue.secondsRemaining;

            if (crossedCue || secondsRemaining === cue.secondsRemaining) {
                this.firedCueKeys[cue.key] = true;
                this.playCue(cue);
            }
        });

        this.previousSecondsRemaining = secondsRemaining;
    }

    getAudioContext() {
        if (typeof window === 'undefined') return null;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            emitDebugEvent('sound-unavailable', {reason: 'no-audio-context'});
            return null;
        }

        if (!this.audioContext) {
            this.audioContext = new AudioContextClass();
        }

        if (this.audioContext.state === 'suspended' && this.audioContext.resume) {
            this.audioContext.resume().catch(() => {
                emitDebugEvent('sound-unavailable', {reason: 'resume-blocked'});
            });
        }

        return this.audioContext;
    }

    playCue(cue) {
        this.stopActiveSounds('next-cue');
        emitDebugEvent('sound', {cue: cue.key});

        const audioContext = this.getAudioContext();
        if (!audioContext) return;

        let offsetMs = 0;
        cue.pattern.forEach(note => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const startAt = audioContext.currentTime + (offsetMs / 1000);
            const endAt = startAt + (note.durationMs / 1000);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(note.frequency, startAt);
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(startAt);
            oscillator.stop(endAt + 0.05);

            this.activeNodes.push({oscillator, gain});
            offsetMs += note.durationMs + 70;
        });
    }

    stopActiveSounds(reason) {
        if (this.activeNodes.length === 0) return;

        this.activeNodes.forEach(({oscillator, gain}) => {
            try {
                if (gain && gain.gain && this.audioContext) {
                    gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                    gain.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
                }
                oscillator.stop();
            } catch (error) {
                // Already stopped nodes throw in WebAudio. Safe to ignore.
            }
        });
        this.activeNodes = [];
        emitDebugEvent('sound-stop', {reason});
    }

    render() {
        return null;
    }
}
