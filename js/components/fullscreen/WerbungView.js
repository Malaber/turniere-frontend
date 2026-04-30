import React from 'react';
import {getTimerReasonLabel} from '../../utils/timerState';
import {AnimatedTimer} from './DuringGameView';
import styles from './WerbungView.module.css';


function imageSignature(images) {
    return images.map(image => image.key).join('|');
}

export function WerbungView(props) {
    const images = Array.isArray(props.images) ? props.images : [];
    const [imageIndex, setImageIndex] = React.useState(0);
    const signature = imageSignature(images);
    const rotationMs = props.rotationMs || 10000;
    const hasTimer = props.timerState && props.timerState.mode;
    const activeImage = images.length > 0 ? images[imageIndex % images.length] : null;

    React.useEffect(() => {
        setImageIndex(0);
    }, [signature]);

    React.useEffect(() => {
        if (images.length <= 1) {
            return undefined;
        }

        const intervalId = setInterval(() => {
            setImageIndex(currentIndex => (currentIndex + 1) % images.length);
        }, rotationMs);

        return () => clearInterval(intervalId);
    }, [signature, images.length, rotationMs]);

    return (
        <div className={styles.werbungRoot} data-testid="beamer-werbung-view">
            <main className={styles.werbungStage} data-testid="beamer-werbung-stage">
                {activeImage ? (
                    <img
                        key={activeImage.key}
                        className={styles.werbungImage}
                        src={activeImage.src}
                        alt=""
                        data-testid="beamer-werbung-image"
                    />
                ) : (
                    <div className={styles.werbungEmpty} data-testid="beamer-werbung-empty">
                        Keine Werbebilder ausgewählt
                    </div>
                )}
            </main>

            <footer className={styles.werbungTimerBar} data-testid="beamer-werbung-timer-bar">
                {hasTimer ? (
                    <React.Fragment>
                        <div className={styles.werbungReason} data-testid="beamer-werbung-reason">
                            {getTimerReasonLabel(props.timerState)}
                        </div>
                        <AnimatedTimer
                            timerState={props.timerState}
                            className={styles.werbungTimer}
                            testId="beamer-werbung-timer"
                        />
                    </React.Fragment>
                ) : (
                    <div className={styles.werbungNoTimer} data-testid="beamer-werbung-no-timer">
                        Kein Timer gesetzt
                    </div>
                )}
            </footer>

            <style global jsx>{`
                body {
                    background: #07121f;
                }
            `}</style>
        </div>
    );
}
