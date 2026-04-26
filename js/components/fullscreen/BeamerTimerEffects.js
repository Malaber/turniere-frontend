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
const PLAYBACK_RETRY_MS = 750;


function emitDebugEvent(type, payload) {
    if (typeof window === 'undefined') return;

    const event = Object.assign({type, at: window.performance.now()}, payload || {});
    if (!window.__beamerTimerEffects) {
        window.__beamerTimerEffects = {events: []};
    }
    window.__beamerTimerEffects.events.push(event);
    window.dispatchEvent(new CustomEvent('beamer-timer-effect', {detail: event}));

    if (window.__beamerTimerAudioLogging !== false && window.console) {
        const logFn = type === 'sound-unavailable' || type === 'sound-seek-error' ?
            'warn' :
            'info';
        window.console[logFn]('[beamer-audio]', type, event);
    }
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
        this.pendingCue = null;
        this.playbackRetryTimeout = null;
        this.previousSecondsRemaining = null;
        this.timerSessionKey = null;
        this.finishedTriggered = false;

        this.tick = this.tick.bind(this);
        this.retryPendingCue = this.retryPendingCue.bind(this);
        this.testCue = this.testCue.bind(this);
    }

    componentDidMount() {
        this.installDebugApi();
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
        this.uninstallDebugApi();
        this.stopActiveSounds('unmount');
    }

    installDebugApi() {
        if (typeof window === 'undefined') return;

        window.__beamerTimerAudio = {
            clear: () => {
                if (window.__beamerTimerEffects) {
                    window.__beamerTimerEffects.events = [];
                }
            },
            cues: TIMER_EFFECT_CUES,
            events: () => (window.__beamerTimerEffects && window.__beamerTimerEffects.events) || [],
            help: () => ({
                clear: '__beamerTimerAudio.clear()',
                disableLogs: 'window.__beamerTimerAudioLogging = false',
                enableLogs: 'window.__beamerTimerAudioLogging = true',
                events: '__beamerTimerAudio.events().slice(-20)',
                policy: '__beamerTimerAudio.policy()',
                retry: '__beamerTimerAudio.retry()',
                state: '__beamerTimerAudio.state()',
                testCue: '__beamerTimerAudio.testCue("start-countdown", 5)'
            }),
            policy: () => {
                if (!navigator.getAutoplayPolicy) {
                    return {
                        audioContext: 'unsupported',
                        mediaElement: 'unsupported'
                    };
                }
                try {
                    return {
                        audioContext: navigator.getAutoplayPolicy('audiocontext'),
                        mediaElement: navigator.getAutoplayPolicy('mediaelement')
                    };
                } catch (error) {
                    return {error: error.message};
                }
            },
            retry: () => this.retryPendingCue('manual-debug'),
            state: () => ({
                activeSounds: this.activeSounds.map(audio => ({
                    currentTime: audio.currentTime,
                    muted: audio.muted,
                    paused: audio.paused,
                    readyState: audio.readyState,
                    src: audio.currentSrc || audio.src,
                    volume: audio.volume
                })),
                pendingCue: this.pendingCue && this.pendingCue.key,
                policy: window.__beamerTimerAudio.policy(),
                timerSessionKey: this.timerSessionKey,
                userActivation: navigator.userActivation ? {
                    hasBeenActive: navigator.userActivation.hasBeenActive,
                    isActive: navigator.userActivation.isActive
                } : 'unsupported'
            }),
            testCue: this.testCue
        };
    }

    uninstallDebugApi() {
        if (typeof window === 'undefined') return;
        if (window.__beamerTimerAudio && window.__beamerTimerAudio.testCue === this.testCue) {
            delete window.__beamerTimerAudio;
        }
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

    retryPendingCue(reason) {
        const cue = this.pendingCue;
        if (!cue) return;

        const elapsedSeconds = this.getElapsedSeconds(cue);
        if (elapsedSeconds === null) {
            this.pendingCue = null;
            return;
        }

        emitDebugEvent('sound-retry', {
            cue: cue.key,
            elapsedSeconds,
            reason,
            src: cue.src
        });
        this.playCue(cue, elapsedSeconds);
    }

    testCue(key, elapsedSeconds) {
        const cue = TIMER_EFFECT_CUES.find(candidate => candidate.key === key) || TIMER_EFFECT_CUES[0];
        const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
        this.playCue(cue, elapsed);
    }

    schedulePlaybackRetry(cue, reason) {
        this.pendingCue = cue;
        clearTimeout(this.playbackRetryTimeout);
        this.playbackRetryTimeout = setTimeout(() => {
            this.playbackRetryTimeout = null;
            this.retryPendingCue(reason);
        }, PLAYBACK_RETRY_MS);
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
        audio.muted = false;
        this.activeSounds.push(audio);

        const removeAudio = () => {
            this.activeSounds = this.activeSounds.filter(activeAudio => activeAudio !== audio);
            emitDebugEvent('sound-ended', {cue: cue.key, src: cue.src});
        };

        audio.addEventListener('ended', removeAudio, {once: true});

        const startPlayback = () => {
            const markStarted = source => {
                this.pendingCue = null;
                clearTimeout(this.playbackRetryTimeout);
                emitDebugEvent('sound-started', {cue: cue.key, source, src: cue.src});
            };
            const markBlocked = (error, source) => {
                emitDebugEvent('sound-unavailable', {
                    reason: 'play-blocked',
                    message: error.message,
                    cue: cue.key,
                    source,
                    src: cue.src
                });
                this.schedulePlaybackRetry(cue, 'play-blocked');
            };

            try {
                const playResult = audio.play();
                if (playResult && playResult.catch) {
                    playResult
                        .then(() => markStarted('normal'))
                        .catch(error => {
                            this.tryMutedBootstrap(audio, cue, markStarted, markBlocked, error);
                        });
                } else {
                    markStarted('normal');
                }
            } catch (error) {
                emitDebugEvent('sound-unavailable', {
                    reason: 'play-error',
                    message: error.message,
                    cue: cue.key,
                    src: cue.src
                });
                this.schedulePlaybackRetry(cue, 'play-error');
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

    tryMutedBootstrap(audio, cue, markStarted, markBlocked, originalError) {
        try {
            audio.muted = true;
            const mutedPlayResult = audio.play();
            if (!mutedPlayResult || !mutedPlayResult.catch) {
                audio.muted = false;
                markStarted('muted-bootstrap');
                return;
            }

            mutedPlayResult
                .then(() => {
                    setTimeout(() => {
                        audio.muted = false;
                        emitDebugEvent('sound-unmuted', {cue: cue.key, src: cue.src});
                    }, 50);
                    markStarted('muted-bootstrap');
                })
                .catch(error => {
                    audio.muted = false;
                    markBlocked(error || originalError, 'muted-bootstrap');
                });
        } catch (error) {
            audio.muted = false;
            markBlocked(error || originalError, 'muted-bootstrap');
        }
    }

    stopActiveSounds(reason) {
        clearTimeout(this.playbackRetryTimeout);
        this.playbackRetryTimeout = null;
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
