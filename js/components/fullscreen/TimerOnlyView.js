import React from 'react';
import {AnimatedTimer} from './DuringGameView';
import {getTimerReasonLabel} from '../../utils/timerState';
import styles from './TimerOnlyView.module.css';


export function TimerOnlyView(props) {
    const hasTimer = props.timerState && props.timerState.mode;
    const showReason = props.showReason !== false;

    return (
        <div className={styles.timerOnlyRoot} data-testid="timer-only-view">
            <main className={styles.timerOnlyStage}>
                {hasTimer ? (
                    <div className={styles.timerOnlyContent}>
                        {showReason &&
                            <div className={styles.timerOnlyReason} data-testid="timer-only-reason">
                                {getTimerReasonLabel(props.timerState)}
                            </div>}
                        <AnimatedTimer
                            timerState={props.timerState}
                            forceUrgent
                            className={styles.timerOnlyTimer}
                            testId="timer-only-timer"
                        />
                    </div>
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
