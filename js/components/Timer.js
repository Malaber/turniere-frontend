import React from 'react';
import {getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../utils/timerState';

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

        const hours = Math.floor(nextDisplay.ms / (1000 * 60 * 60));
        const minutes = Math.floor((nextDisplay.ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((nextDisplay.ms % (1000 * 60)) / 1000);
        const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

        let formattedTimeLeft = '';
        if (hours > 0) {
            formattedTimeLeft += hours + 'h ';
        }
        formattedTimeLeft += minutes + ':' + formattedSeconds;
        return formattedTimeLeft;
    };

    return <span>{formatTimeLeft(display)}</span>;
}
