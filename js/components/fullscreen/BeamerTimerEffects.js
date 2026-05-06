import React from 'react';
import {confetti} from '@tsparticles/confetti';
import {beamerSoundEffectForKey} from '../../utils/soundEffects';
import {getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../../utils/timerState';
import {isBrowserTabActive} from '../../utils/browserVisibility';


const TIMER_EFFECT_CUES = [
    Object.assign({}, beamerSoundEffectForKey('start-countdown'), {
        secondsRemaining: 20 * 60,
        startOffsetSeconds: 8.5
    }),
    Object.assign({}, beamerSoundEffectForKey('mid-game-warning'), {
        secondsRemaining: 10 * 60,
        startOffsetSeconds: 0
    }),
    Object.assign({}, beamerSoundEffectForKey('end-countdown'), {
        secondsRemaining: 10,
        startOffsetSeconds: 6
    })
];

const TICK_MS = 250;
const AUDIO_PERMISSION_PROBE_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const CONFETTI_FINISH_DELAY_MS = 1000;
const CONFETTI_FIREWORK_BURSTS = 14;
const CONFETTI_FIREWORK_INTERVAL_MS = 180;


function emitDebugEvent(type, payload) {
    if (typeof window === 'undefined') return;

    const event = Object.assign({type, at: window.performance.now()}, payload || {});
    if (!window.__beamerTimerEffects) {
        window.__beamerTimerEffects = {events: []};
    }
    window.__beamerTimerEffects.events.push(event);
    window.dispatchEvent(new CustomEvent('beamer-timer-effect', {detail: event}));
}

function soundEffectCommandId(command) {
    if (!command || typeof command !== 'object') return null;
    return command.id || command.request_id || null;
}


function randomFireworkOrigin() {
    return {
        x: 0.12 + (Math.random() * 0.76),
        y: 0.12 + (Math.random() * 0.58)
    };
}

function triggerConfettiBurst(origin, burstIndex) {
    if (!isBrowserTabActive()) {
        emitDebugEvent('confetti-skipped', {
            burstIndex,
            reason: 'tab-hidden'
        });
        return;
    }

    emitDebugEvent('confetti', {
        burstIndex,
        style: 'firework',
        origin
    });

    Promise.resolve(confetti({
        particleCount: 70 + Math.floor(Math.random() * 45),
        spread: 360,
        startVelocity: 28 + (Math.random() * 22),
        decay: 0.92,
        gravity: 0.85,
        scalar: 0.9 + (Math.random() * 0.4),
        origin,
        zIndex: 2147483647
    }))
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
        this.pendingElapsedSeconds = null;
        this.pendingPriority = null;
        this.playbackAttemptId = 0;
        this.audioPermissionStatus = 'unknown';
        this.lastSoundEffectCommandId = null;
        this.previousMsRemaining = null;
        this.timerSessionKey = null;
        this.finishedTriggered = false;
        this.finishConfettiTimeoutId = null;
        this.confettiTimeouts = [];
        this.unlockInProgress = false;

        this.checkAudioPermission = this.checkAudioPermission.bind(this);
        this.attemptAudioPlayback = this.attemptAudioPlayback.bind(this);
        this.tick = this.tick.bind(this);
        this.manualUnlock = this.manualUnlock.bind(this);
        this.retryPendingCue = this.retryPendingCue.bind(this);
        this.handleSoundEffectCommand = this.handleSoundEffectCommand.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    componentDidMount() {
        this.lastSoundEffectCommandId = soundEffectCommandId(this.props.soundEffectCommand);
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }
        this.checkAudioPermission('page-load').catch(() => {});
        this.tick();
        this.intervalId = setInterval(this.tick, TICK_MS);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.timerState !== this.props.timerState) {
            this.tick();
        }
        if (soundEffectCommandId(prevProps.soundEffectCommand) !==
            soundEffectCommandId(this.props.soundEffectCommand)) {
            this.handleSoundEffectCommand(this.props.soundEffectCommand);
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
        if (typeof document !== 'undefined' && document.removeEventListener) {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        this.clearConfettiTimeouts();
        this.stopActiveSounds('unmount');
    }

    handleVisibilityChange() {
        if (isBrowserTabActive()) return;

        this.clearConfettiTimeouts();
        emitDebugEvent('confetti-skipped', {reason: 'tab-hidden'});
    }

    clearConfettiTimeouts() {
        if (this.finishConfettiTimeoutId) {
            clearTimeout(this.finishConfettiTimeoutId);
            this.finishConfettiTimeoutId = null;
        }
        this.confettiTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.confettiTimeouts = [];
    }

    scheduleConfettiFireworks() {
        this.clearConfettiTimeouts();
        if (!isBrowserTabActive()) {
            emitDebugEvent('confetti-skipped', {
                delayMs: CONFETTI_FINISH_DELAY_MS,
                reason: 'tab-hidden'
            });
            return;
        }

        emitDebugEvent('confetti-scheduled', {
            delayMs: CONFETTI_FINISH_DELAY_MS
        });
        this.finishConfettiTimeoutId = setTimeout(() => {
            this.finishConfettiTimeoutId = null;
            this.startConfettiFireworks();
        }, CONFETTI_FINISH_DELAY_MS);
    }

    startConfettiFireworks() {
        this.clearConfettiTimeouts();
        if (!isBrowserTabActive()) {
            emitDebugEvent('confetti-skipped', {reason: 'tab-hidden'});
            return;
        }

        for (let burstIndex = 0; burstIndex < CONFETTI_FIREWORK_BURSTS; burstIndex++) {
            const fire = () => {
                triggerConfettiBurst(randomFireworkOrigin(), burstIndex);
            };

            if (burstIndex === 0) {
                fire();
                continue;
            }

            const timeoutId = setTimeout(fire, burstIndex * CONFETTI_FIREWORK_INTERVAL_MS);
            this.confettiTimeouts.push(timeoutId);
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
        this.pendingElapsedSeconds = null;
        this.pendingPriority = null;
        this.previousMsRemaining = null;
        this.finishedTriggered = false;
        this.clearConfettiTimeouts();
        this.stopTimerSounds('timer-changed');
    }

    tick() {
        const {timerState} = this.props;
        this.resetSessionIfNeeded(timerState);

        const display = getTimerDisplay(timerState, Date.now());
        if (!display.active || display.mode !== TIMER_MODE_COUNTDOWN) {
            this.previousMsRemaining = null;
            this.finishedTriggered = false;
            this.stopTimerSounds('timer-inactive');
            return;
        }

        if (display.ms === 0) {
            const crossedFinish = this.previousMsRemaining !== null &&
                this.previousMsRemaining > 0;
            if (crossedFinish && !this.finishedTriggered) {
                this.finishedTriggered = true;
                this.scheduleConfettiFireworks();
            }
            this.previousMsRemaining = display.ms;
            return;
        }

        TIMER_EFFECT_CUES.forEach(cue => {
            if (this.firedCueKeys[cue.key]) return;

            const cueStartMs = this.getCueStartMs(cue);
            const elapsedSeconds = Math.max(0, (cueStartMs - display.ms) / 1000);
            const canSyncFromElapsed = elapsedSeconds < cue.durationSeconds;
            const crossedCue = this.previousMsRemaining !== null &&
                this.previousMsRemaining > cueStartMs &&
                display.ms <= cueStartMs;
            const loadedDuringCue = this.previousMsRemaining === null &&
                display.ms <= cueStartMs &&
                canSyncFromElapsed;

            if (crossedCue || loadedDuringCue || display.ms === cueStartMs) {
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

        this.previousMsRemaining = display.ms;
    }

    getCueStartSeconds(cue) {
        return cue.secondsRemaining + cue.startOffsetSeconds;
    }

    getCueStartMs(cue) {
        return this.getCueStartSeconds(cue) * 1000;
    }

    getElapsedSeconds(cue) {
        const display = getTimerDisplay(this.props.timerState, Date.now());
        if (!display.active || display.mode !== TIMER_MODE_COUNTDOWN) return null;

        const cueStartMs = this.getCueStartMs(cue);
        const elapsedSeconds = Math.max(0, (cueStartMs - display.ms) / 1000);
        if (elapsedSeconds >= cue.durationSeconds) return null;

        return elapsedSeconds;
    }

    retryPendingCue(reason) {
        const cue = this.pendingCue;
        if (!cue) return;

        const priority = this.pendingPriority || 'timer';
        const elapsedSeconds = priority === 'timer' ?
            this.getElapsedSeconds(cue) :
            (this.pendingElapsedSeconds || 0);
        if (elapsedSeconds === null) {
            this.pendingCue = null;
            this.pendingAudio = null;
            this.pendingElapsedSeconds = null;
            this.pendingPriority = null;
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
                this.playbackAttemptId,
                priority
            );
            return;
        }

        this.playCue(cue, elapsedSeconds, {priority, source: reason});
    }

    manualUnlock(event) {
        if (
            this.unlockInProgress ||
            (this.audioPermissionStatus === 'allowed' && !this.pendingCue)
        ) {
            return;
        }

        this.unlockInProgress = true;

        this.retryPendingCue('manual-unlock');
        const needsPermissionCheck =
            this.audioPermissionStatus !== 'allowed' &&
            !this.pendingCue;
        const permissionCheck = needsPermissionCheck ?
            this.checkAudioPermission('manual-unlock')
                .then(() => this.retryPendingCue('manual-unlock')) :
            Promise.resolve();

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

    attemptAudioPlayback(audio, cue, source, attemptId, priority) {
        const markStarted = () => {
            if (attemptId !== this.playbackAttemptId) return;
            this.pendingCue = null;
            this.pendingAudio = null;
            this.pendingElapsedSeconds = null;
            this.pendingPriority = null;
            this.audioPermissionStatus = 'allowed';
            this.setState({
                audioPermissionStatus: 'allowed',
                soundBlocked: false
            });
            if (source === 'manual-unlock') {
                emitDebugEvent('audio-permission-allowed', {reason: source});
            }
            emitDebugEvent('sound-started', {cue: cue.key, priority, source, src: cue.src});
        };
        const markBlocked = error => {
            if (attemptId !== this.playbackAttemptId) return;
            this.pendingCue = cue;
            this.pendingAudio = audio;
            this.pendingPriority = priority;
            this.audioPermissionStatus = 'blocked';
            emitDebugEvent('sound-unavailable', {
                reason: 'play-blocked',
                message: error.message,
                cue: cue.key,
                priority,
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
            this.pendingPriority = priority;
            emitDebugEvent('sound-unavailable', {
                reason: 'play-error',
                message: error.message,
                cue: cue.key,
                priority,
                source,
                src: cue.src
            });
            this.setState({
                audioPermissionStatus: 'blocked',
                soundBlocked: true
            });
        }
    }

    hasTimerSoundInFlight() {
        return this.pendingPriority === 'timer' ||
            this.activeSounds.some(audio => audio.__beamerSoundPriority === 'timer');
    }

    handleSoundEffectCommand(command) {
        const commandId = soundEffectCommandId(command);
        if (!commandId || commandId === this.lastSoundEffectCommandId) {
            return;
        }
        this.lastSoundEffectCommandId = commandId;

        if (command.action === 'stop') {
            this.stopSoundEffects('soundboard-stop');
            return;
        }

        if (command.action !== 'play') {
            emitDebugEvent('sound-effect-skip', {reason: 'unknown-action', action: command.action});
            return;
        }

        const cue = beamerSoundEffectForKey(command.sound_key || command.soundKey);
        if (!cue) {
            emitDebugEvent('sound-effect-skip', {
                reason: 'unknown-sound',
                soundKey: command.sound_key || command.soundKey
            });
            return;
        }

        if (this.hasTimerSoundInFlight()) {
            emitDebugEvent('sound-effect-skip', {
                cue: cue.key,
                reason: 'timer-sound-active',
                src: cue.src
            });
            return;
        }

        this.playCue(cue, 0, {priority: 'soundboard', source: 'soundboard'});
    }

    playCue(cue, elapsedSeconds, options = {}) {
        if (typeof window === 'undefined' || typeof Audio === 'undefined') {
            emitDebugEvent('sound-unavailable', {reason: 'no-audio-element'});
            return;
        }

        const priority = options.priority || 'timer';
        const source = options.source || 'normal';

        if (priority !== 'timer' && this.hasTimerSoundInFlight()) {
            emitDebugEvent('sound-effect-skip', {
                cue: cue.key,
                reason: 'timer-sound-active',
                src: cue.src
            });
            return;
        }

        this.stopActiveSounds(priority === 'timer' ? 'next-cue' : 'sound-effect-next');
        const attemptId = ++this.playbackAttemptId;
        this.pendingCue = cue;
        this.pendingElapsedSeconds = elapsedSeconds;
        this.pendingPriority = priority;
        emitDebugEvent(priority === 'timer' ? 'sound' : 'sound-effect', {
            cue: cue.key,
            elapsedSeconds,
            priority,
            source,
            src: cue.src,
            startOffsetSeconds: cue.startOffsetSeconds
        });

        const audio = new Audio(cue.src);
        audio.preload = 'auto';
        audio.volume = cue.volume;
        audio.muted = false;
        audio.__beamerCueKey = cue.key;
        audio.__beamerSoundPriority = priority;
        this.activeSounds.push(audio);
        this.pendingAudio = audio;

        const removeAudio = () => {
            this.activeSounds = this.activeSounds.filter(activeAudio => activeAudio !== audio);
            if (this.pendingAudio === audio) {
                this.pendingAudio = null;
                this.pendingElapsedSeconds = null;
                this.pendingPriority = null;
            }
            emitDebugEvent('sound-ended', {cue: cue.key, priority, src: cue.src});
        };

        audio.addEventListener('ended', removeAudio, {once: true});

        const startPlayback = () => {
            if (this.audioPermissionStatus !== 'allowed') {
                emitDebugEvent('sound-waiting-for-permission', {
                    cue: cue.key,
                    priority,
                    status: this.audioPermissionStatus,
                    src: cue.src
                });
                if (this.audioPermissionStatus === 'blocked') {
                    this.setState({soundBlocked: true});
                }
                return;
            }
            this.attemptAudioPlayback(audio, cue, source, attemptId, priority);
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
        this.pendingCue = null;
        this.pendingElapsedSeconds = null;
        this.pendingPriority = null;
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

    stopTimerSounds(reason) {
        let stopped = false;

        if (this.pendingPriority === 'timer') {
            this.pendingCue = null;
            this.pendingAudio = null;
            this.pendingElapsedSeconds = null;
            this.pendingPriority = null;
            stopped = true;
        }

        const remainingSounds = [];
        this.activeSounds.forEach(audio => {
            if (audio.__beamerSoundPriority !== 'timer') {
                remainingSounds.push(audio);
                return;
            }

            stopped = true;
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                // Stopping detached media can throw. Safe to ignore.
            }
            if (this.pendingAudio === audio) {
                this.pendingCue = null;
                this.pendingAudio = null;
                this.pendingElapsedSeconds = null;
                this.pendingPriority = null;
            }
        });

        this.activeSounds = remainingSounds;
        if (!stopped) return;

        this.playbackAttemptId++;
        emitDebugEvent('sound-stop', {reason, scope: 'timer', stopped});
    }

    stopSoundEffects(reason) {
        let stopped = false;

        if (this.pendingPriority === 'soundboard') {
            this.pendingCue = null;
            this.pendingAudio = null;
            this.pendingElapsedSeconds = null;
            this.pendingPriority = null;
            stopped = true;
        }

        const remainingSounds = [];
        this.activeSounds.forEach(audio => {
            if (audio.__beamerSoundPriority !== 'soundboard') {
                remainingSounds.push(audio);
                return;
            }

            stopped = true;
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                // Stopping detached media can throw. Safe to ignore.
            }
            if (this.pendingAudio === audio) {
                this.pendingCue = null;
                this.pendingAudio = null;
                this.pendingElapsedSeconds = null;
                this.pendingPriority = null;
            }
        });

        this.activeSounds = remainingSounds;
        if (stopped) {
            this.playbackAttemptId++;
        }
        emitDebugEvent('sound-stop', {reason, scope: 'soundboard', stopped});
    }

    render() {
        if (!this.state.soundBlocked) return null;

        return (
            <button
                type="button"
                data-testid="beamer-sound-unlock"
                aria-label="Audio aktivieren"
                onClick={this.manualUnlock}
                onPointerUp={this.manualUnlock}
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
