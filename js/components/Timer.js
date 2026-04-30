import React from 'react';
import {formatTimerDisplay, getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../utils/timerState';


function timerDisplayKey(display) {
    if (!display.active) return 'inactive';
    if (
        display.mode === TIMER_MODE_COUNTDOWN &&
        display.ms === 0
    ) {
        return 'finished';
    }

    return display.mode + ':' + formatTimerDisplay(display, {labelHours: true});
}

export function Timer({timerState}) {
    const [display, setDisplay] = React.useState(
        getTimerDisplay(timerState, Date.now())
    );

    React.useEffect(() => {
        let active = true;
        let frameId = null;
        let timeoutId = null;
        let lastKey = null;

        const clearScheduledTick = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
            }
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        const scheduleTick = () => {
            if (!active || !timerState || !timerState.mode) return;
            if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                frameId = window.requestAnimationFrame(tick);
                return;
            }
            timeoutId = setTimeout(tick, 250);
        };

        const publishDisplay = nextDisplay => {
            const key = timerDisplayKey(nextDisplay);
            if (key === lastKey) return;

            lastKey = key;
            setDisplay(nextDisplay);
        };

        const tick = () => {
            clearScheduledTick();
            publishDisplay(getTimerDisplay(timerState, Date.now()));
            scheduleTick();
        };

        if (!timerState || !timerState.mode) {
            publishDisplay(getTimerDisplay(timerState, Date.now()));
            return () => {
                active = false;
                clearScheduledTick();
            };
        }

        tick();
        return () => {
            active = false;
            clearScheduledTick();
        };
    }, [timerState]);

    const formatTimeLeft = nextDisplay => {
        if (!nextDisplay.active) return '';
        if (
            nextDisplay.mode === TIMER_MODE_COUNTDOWN &&
            nextDisplay.ms === 0
        ) {
            return 'Spiel vorbei!';
        }

        return formatTimerDisplay(nextDisplay, {labelHours: true});
    };

    return <span>{formatTimeLeft(display)}</span>;
}
