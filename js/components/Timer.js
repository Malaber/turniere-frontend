import React from 'react';

export function Timer({timerEnd}) {
    const [timeLeft, setTimeLeft] = React.useState(null);

    React.useEffect(() => {
        if (timerEnd) {
            const intervalId = setInterval(() => {
                const now = new Date();
                const timeLeft = timerEnd - now;
                setTimeLeft(timeLeft > 0 ? timeLeft : 0);
            }, 1000);
            return () => clearInterval(intervalId);
        }
    }, [timerEnd]);

    const formatTimeLeft = timeLeft => {
        if (timeLeft === 0) return 'Spiel vorbei!';
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

        let formattedTimeLeft = '';
        if (hours > 0) {
            formattedTimeLeft += hours + 'h ';
        }
        formattedTimeLeft += minutes + ':' + formattedSeconds;
        return formattedTimeLeft;
    };

    return <span>{formatTimeLeft(timeLeft)}</span>;
}
