import React from 'react';
import {AnimatedTimer} from './DuringGameView';
import styles from './TimerOnlyView.module.css';


export function TimerOnlyView(props) {
    const hasTimer = props.timerState && props.timerState.mode;

    return (
        <div className={styles.timerOnlyRoot} data-testid="timer-only-view">
            <main className={styles.timerOnlyStage}>
                {hasTimer ? (
                    <AnimatedTimer
                        timerState={props.timerState}
                        forceUrgent
                        className={styles.timerOnlyTimer}
                        testId="timer-only-timer"
                    />
                ) : (
                    <div className={styles.noTimer}>
                        Kein Timer gesetzt
                    </div>
                )}
            </main>

            <style global jsx>{`
                body {
                    background: #ffffff;
                }
            `}</style>
        </div>
    );
}
