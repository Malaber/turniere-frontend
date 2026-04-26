import React from 'react';
import {confetti} from '@tsparticles/confetti';
import {getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../../utils/timerState';


const TIMER_EFFECT_CUES = [
    {
        key: 'start-countdown',
        secondsRemaining: 20 * 60,
        startOffsetSeconds: 8.5,
        durationSeconds: 27.214,
        volume: 1,
        src: '/static/sounds/start_countdown.mp3'
    },
    {
        key: 'mid-game-warning',
        secondsRemaining: 10 * 60,
        startOffsetSeconds: 2,
        durationSeconds: 7.601,
        volume: 1,
        src: '/static/sounds/10_minute_warning.mp3'
    },
    {
        key: 'end-countdown',
        secondsRemaining: 10,
        startOffsetSeconds: 6,
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
        this.state = {
            soundBlocked: false
        };
        this.activeSounds = [];
        this.firedCueKeys = {};
        this.pendingCue = null;
        this.previousSecondsRemaining = null;
        this.timerSessionKey = null;
        this.finishedTriggered = false;

        this.tick = this.tick.bind(this);
        this.unlockAndRetry = this.unlockAndRetry.bind(this);
    }

    componentDidMount() {
        this.addUnlockListeners();
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
        this.removeUnlockListeners();
        this.stopActiveSounds('unmount');
    }

    addUnlockListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('pointerdown', this.unlockAndRetry, true);
        window.addEventListener('touchend', this.unlockAndRetry, true);
        window.addEventListener('keydown', this.unlockAndRetry, true);
    }

    removeUnlockListeners() {
        if (typeof window === 'undefined') return;

        window.removeEventListener('pointerdown', this.unlockAndRetry, true);
        window.removeEventListener('touchend', this.unlockAndRetry, true);
        window.removeEventListener('keydown', this.unlockAndRetry, true);
    }

    resetSessionIfNeeded(timerState) {
        const nextKey = timerState && timerState.mode && timerState.timestampIso ?
            timerState.mode + ':' + timerState.timestampIso :
            null;

        if (nextKey === this.timerSessionKey) return;

        this.timerSessionKey = nextKey;
        this.firedCueKeys = {};
        this.pendingCue = null;
        this.previousSecondsRemaining = null;
        this.finishedTriggered = false;
        this.setState({soundBlocked: false});
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

    getElapsedSeconds(cue) {
        const display = getTimerDisplay(this.props.timerState, Date.now());
        if (!display.active || display.mode !== TIMER_MODE_COUNTDOWN) return null;

        const secondsRemaining = Math.floor(display.ms / 1000);
        const cueStartSeconds = this.getCueStartSeconds(cue);
        const elapsedSeconds = Math.max(0, cueStartSeconds - secondsRemaining);
        if (elapsedSeconds >= cue.durationSeconds) return null;

        return elapsedSeconds;
    }

    unlockAndRetry(event) {
        if (event && event.type === 'keydown' && event.key === 'Tab') return;
        if (!this.pendingCue) return;

        const elapsedSeconds = this.getElapsedSeconds(this.pendingCue);
        if (elapsedSeconds === null) {
            this.pendingCue = null;
            this.setState({soundBlocked: false});
            return;
        }

        emitDebugEvent('sound-retry', {
            cue: this.pendingCue.key,
            elapsedSeconds,
            src: this.pendingCue.src
        });
        this.playCue(this.pendingCue, elapsedSeconds);
    }

    playCue(cue, elapsedSeconds) {
        if (typeof window === 'undefined' || typeof Audio === 'undefined') {
            emitDebugEvent('sound-unavailable', {reason: 'no-audio-element'});
            return;
        }

        this.stopActiveSounds('next-cue');
        this.pendingCue = cue;
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

        const removeAudio = () => {
            this.activeSounds = this.activeSounds.filter(activeAudio => activeAudio !== audio);
            emitDebugEvent('sound-ended', {cue: cue.key, src: cue.src});
        };

        audio.addEventListener('ended', removeAudio, {once: true});

        const startPlayback = () => {
            try {
                const playResult = audio.play();
                if (playResult && playResult.catch) {
                    playResult
                        .then(() => {
                            this.pendingCue = null;
                            this.setState({soundBlocked: false});
                            emitDebugEvent('sound-started', {cue: cue.key, src: cue.src});
                        })
                        .catch(error => {
                            this.pendingCue = cue;
                            this.setState({soundBlocked: true});
                            emitDebugEvent('sound-unavailable', {
                                reason: 'play-blocked',
                                message: error.message,
                                cue: cue.key,
                                src: cue.src
                            });
                        });
                } else {
                    this.pendingCue = null;
                    this.setState({soundBlocked: false});
                    emitDebugEvent('sound-started', {cue: cue.key, src: cue.src});
                }
            } catch (error) {
                this.pendingCue = cue;
                this.setState({soundBlocked: true});
                emitDebugEvent('sound-unavailable', {
                    reason: 'play-error',
                    message: error.message,
                    cue: cue.key,
                    src: cue.src
                });
            }
        };

        const seekThenPlay = () => {
            let fallbackId = null;
            let didStart = false;
            const playOnce = () => {
                if (didStart) return;
                didStart = true;
                if (fallbackId) {
                    clearTimeout(fallbackId);
                    fallbackId = null;
                }
                startPlayback();
            };

            try {
                audio.currentTime = elapsedSeconds;
            } catch (error) {
                emitDebugEvent('sound-seek-error', {
                    cue: cue.key,
                    message: error.message
                });
                startPlayback();
                return;
            }

            audio.addEventListener('seeked', playOnce, {once: true});
            audio.addEventListener('canplay', playOnce, {once: true});
            fallbackId = setTimeout(playOnce, 500);
        };

        if (audio.readyState >= 1) {
            seekThenPlay();
        } else {
            audio.addEventListener('loadedmetadata', seekThenPlay, {once: true});
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
        if (!this.state.soundBlocked) return null;

        return (
            <button
                type="button"
                data-testid="beamer-sound-unlock"
                onClick={this.unlockAndRetry}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2147483647,
                    border: 0,
                    background: 'rgba(0, 0, 0, 0.72)',
                    color: '#ffffff',
                    fontSize: 'clamp(2rem, 6vw, 6rem)',
                    fontWeight: 800,
                    cursor: 'pointer'
                }}
            >
                Ton aktivieren
            </button>
        );
    }
}
