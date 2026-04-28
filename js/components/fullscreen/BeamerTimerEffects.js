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
const AUDIO_PERMISSION_PROBE_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';


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
            audioPermissionStatus: 'unknown',
            soundBlocked: false
        };
        this.activeSounds = [];
        this.firedCueKeys = {};
        this.pendingCue = null;
        this.pendingAudio = null;
        this.playbackAttemptId = 0;
        this.audioPermissionStatus = 'unknown';
        this.previousSecondsRemaining = null;
        this.timerSessionKey = null;
        this.finishedTriggered = false;
        this.unlockInProgress = false;
        this.lastUnlockAt = 0;

        this.checkAudioPermission = this.checkAudioPermission.bind(this);
        this.attemptAudioPlayback = this.attemptAudioPlayback.bind(this);
        this.tick = this.tick.bind(this);
        this.manualUnlock = this.manualUnlock.bind(this);
        this.retryPendingCue = this.retryPendingCue.bind(this);
    }

    componentDidMount() {
        this.checkAudioPermission('page-load').catch(() => {});
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
            this.pendingAudio = null;
            this.setState({soundBlocked: false});
            return;
        }

        emitDebugEvent('sound-retry', {
            cue: cue.key,
            elapsedSeconds,
            reason,
            src: cue.src
        });

        if (this.pendingAudio) {
            try {
                this.pendingAudio.currentTime = elapsedSeconds;
            } catch (error) {
                emitDebugEvent('sound-seek-error', {
                    cue: cue.key,
                    message: error.message,
                    reason
                });
            }
            this.attemptAudioPlayback(
                this.pendingAudio,
                cue,
                reason,
                this.playbackAttemptId
            );
            return;
        }

        this.playCue(cue, elapsedSeconds);
    }

    manualUnlock(event) {
        if (event) {
            event.preventDefault();
        }

        const now = Date.now();
        if (this.unlockInProgress || now - this.lastUnlockAt < 750) return;

        this.lastUnlockAt = now;
        this.unlockInProgress = true;

        const hadPendingCue = Boolean(this.pendingCue);
        this.retryPendingCue('manual-unlock');
        const permissionCheck = hadPendingCue ?
            Promise.resolve() :
            this.checkAudioPermission('manual-unlock')
                .then(() => this.retryPendingCue('manual-unlock'));

        permissionCheck
            .catch(() => {})
            .then(() => {
                this.unlockInProgress = false;
            });
    }

    checkAudioPermission(reason) {
        if (typeof window === 'undefined' || typeof Audio === 'undefined') {
            return Promise.resolve();
        }

        this.audioPermissionStatus = 'checking';
        this.setState({audioPermissionStatus: 'checking'});

        const audio = new Audio(AUDIO_PERMISSION_PROBE_SRC);
        audio.preload = 'auto';
        audio.muted = false;
        audio.volume = 1;

        emitDebugEvent('audio-permission-check', {reason});

        try {
            const playResult = audio.play();
            if (!playResult || !playResult.catch) {
                audio.pause();
                audio.currentTime = 0;
                this.audioPermissionStatus = 'allowed';
                this.setState({
                    audioPermissionStatus: 'allowed',
                    soundBlocked: false
                }, () => this.retryPendingCue(reason));
                emitDebugEvent('audio-permission-allowed', {reason, sync: true});
                return Promise.resolve();
            }

            return playResult
                .then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    this.audioPermissionStatus = 'allowed';
                    this.setState({
                        audioPermissionStatus: 'allowed',
                        soundBlocked: false
                    }, () => this.retryPendingCue(reason));
                    emitDebugEvent('audio-permission-allowed', {reason});
                })
                .catch(error => {
                    this.audioPermissionStatus = 'blocked';
                    this.setState({
                        audioPermissionStatus: 'blocked',
                        soundBlocked: true
                    });
                    emitDebugEvent('audio-permission-blocked', {
                        message: error.message,
                        name: error.name,
                        reason
                    });
                    throw error;
                });
        } catch (error) {
            this.audioPermissionStatus = 'blocked';
            this.setState({
                audioPermissionStatus: 'blocked',
                soundBlocked: true
            });
            emitDebugEvent('audio-permission-blocked', {
                message: error.message,
                name: error.name,
                reason
            });
            return Promise.reject(error);
        }
    }

    attemptAudioPlayback(audio, cue, source, attemptId) {
        const markStarted = () => {
            if (attemptId !== this.playbackAttemptId) return;
            this.pendingCue = null;
            this.pendingAudio = null;
            this.audioPermissionStatus = 'allowed';
            this.setState({
                audioPermissionStatus: 'allowed',
                soundBlocked: false
            });
            if (source === 'manual-unlock') {
                emitDebugEvent('audio-permission-allowed', {reason: source});
            }
            emitDebugEvent('sound-started', {cue: cue.key, source, src: cue.src});
        };
        const markBlocked = error => {
            if (attemptId !== this.playbackAttemptId) return;
            this.pendingCue = cue;
            this.pendingAudio = audio;
            this.audioPermissionStatus = 'blocked';
            emitDebugEvent('sound-unavailable', {
                reason: 'play-blocked',
                message: error.message,
                cue: cue.key,
                source,
                src: cue.src
            });
            this.setState({
                audioPermissionStatus: 'blocked',
                soundBlocked: true
            });
        };

        try {
            const playResult = audio.play();
            if (playResult && playResult.catch) {
                playResult
                    .then(markStarted)
                    .catch(markBlocked);
            } else {
                markStarted();
            }
        } catch (error) {
            if (attemptId !== this.playbackAttemptId) return;
            this.pendingCue = cue;
            this.pendingAudio = audio;
            emitDebugEvent('sound-unavailable', {
                reason: 'play-error',
                message: error.message,
                cue: cue.key,
                source,
                src: cue.src
            });
            this.setState({
                audioPermissionStatus: 'blocked',
                soundBlocked: true
            });
        }
    }

    playCue(cue, elapsedSeconds) {
        if (typeof window === 'undefined' || typeof Audio === 'undefined') {
            emitDebugEvent('sound-unavailable', {reason: 'no-audio-element'});
            return;
        }

        this.stopActiveSounds('next-cue');
        const attemptId = ++this.playbackAttemptId;
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
        this.pendingAudio = audio;

        const removeAudio = () => {
            this.activeSounds = this.activeSounds.filter(activeAudio => activeAudio !== audio);
            if (this.pendingAudio === audio) {
                this.pendingAudio = null;
            }
            emitDebugEvent('sound-ended', {cue: cue.key, src: cue.src});
        };

        audio.addEventListener('ended', removeAudio, {once: true});

        const startPlayback = () => {
            if (this.audioPermissionStatus !== 'allowed') {
                emitDebugEvent('sound-waiting-for-permission', {
                    cue: cue.key,
                    status: this.audioPermissionStatus,
                    src: cue.src
                });
                if (this.audioPermissionStatus === 'blocked') {
                    this.setState({soundBlocked: true});
                }
                return;
            }
            this.attemptAudioPlayback(audio, cue, 'normal', attemptId);
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
        this.playbackAttemptId++;
        this.pendingAudio = null;
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
                aria-label="Audio aktivieren"
                onClick={this.manualUnlock}
                onPointerDown={this.manualUnlock}
                onPointerUp={this.manualUnlock}
                onTouchStart={this.manualUnlock}
                onTouchEnd={this.manualUnlock}
                style={{
                    position: 'fixed',
                    right: '1rem',
                    bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
                    zIndex: 2147483647,
                    border: '2px solid #f59e0b',
                    borderRadius: '6px',
                    background: '#111827',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 700,
                    maxWidth: 'calc(100vw - 2rem)',
                    minHeight: '44px',
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    touchAction: 'manipulation',
                    whiteSpace: 'normal',
                    WebkitTapHighlightColor: 'transparent'
                }}
            >
                Audio blockiert - klicken zum Aktivieren
            </button>
        );
    }
}
