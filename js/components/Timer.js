import React from 'react';
import {formatTimerMs, getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../utils/timerState';

export function Timer({timerState}) {
    const [display, setDisplay] = React.useState(
        getTimerDisplay(timerState, Date.now())
    );

    React.useEffect(() => {
        if (!timerState || !timerState.mode) {
            setDisplay(getTimerDisplay(timerState, Date.now()));
            return undefined;
        }

        const tick = () => setDisplay(getTimerDisplay(timerState, Date.now()));
        tick();
        const intervalId = setInterval(tick, 1000);
        return () => clearInterval(intervalId);
    }, [timerState]);

    const formatTimeLeft = nextDisplay => {
        if (!nextDisplay.active) return '';
        if (
            nextDisplay.mode === TIMER_MODE_COUNTDOWN &&
            nextDisplay.ms === 0
        ) {
            return 'Spiel vorbei!';
        }

        return formatTimerMs(nextDisplay.ms, {labelHours: true});
    };

    return <span>{formatTimeLeft(display)}</span>;
}
