import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {getTimerReasonLabel} from '../../utils/timerState';
import {Timer} from '../Timer';
import {FullscreenMatchCard} from './FullscreenMatchCard';
import styles from './NextMatchesView.module.css';


const MAX_MATCHES = 32;


function sortNextMatches(left, right) {
    const leftGroup = left.group ? left.group.number : null;
    const rightGroup = right.group ? right.group.number : null;
    if (leftGroup !== null || rightGroup !== null) {
        if (leftGroup === null) return 1;
        if (rightGroup === null) return -1;
        if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    }

    const leftStage = left.stageLevel === undefined ? -1 : left.stageLevel;
    const rightStage = right.stageLevel === undefined ? -1 : right.stageLevel;
    if (leftStage !== rightStage) {
        return rightStage - leftStage;
    }

    return sortMatchesByPositionAscending()(left, right);
}

export function visibleNextMatches(matches) {
    if (!Array.isArray(matches)) {
        return null;
    }

    return matches
        .slice()
        .sort(sortNextMatches)
        .slice(0, MAX_MATCHES);
}

function HeaderTimer({timerState}) {
    if (!timerState || !timerState.mode) return null;

    return (
        <div className={styles.headerTimer} data-testid="next-matches-timer">
            <span className={styles.timerReason}>
                {getTimerReasonLabel(timerState)}
            </span>
            <span className={styles.timerValue}>
                <Timer timerState={timerState}/>
            </span>
        </div>
    );
}

export function NextMatchesView({matches, timerState}) {
    const visibleMatches = visibleNextMatches(matches);

    if (visibleMatches === null) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <Spinner size="sm"/>
                    {' '}lade Daten
                </div>
                <GlobalFullscreenStyles/>
            </div>
        );
    }

    return (
        <div className={styles.page} data-testid="next-matches-view">
            <div className={styles.header}>
                <div className={styles.title} data-testid="next-matches-title">
                    &gt; Nächste Spiele
                </div>
                <HeaderTimer timerState={timerState}/>
            </div>

            {visibleMatches.length === 0 ? (
                <div className={styles.empty}>
                    keine Matches
                </div>
            ) : (
                <div className={styles.matchGrid} data-testid="next-matches-grid">
                    {visibleMatches.map((match, index) => (
                        <FullscreenMatchCard
                            key={match.id}
                            match={match}
                            index={index}
                            fillHeight
                            animateEntry={false}
                        />
                    ))}
                </div>
            )}
            <GlobalFullscreenStyles/>
        </div>
    );
}

function GlobalFullscreenStyles() {
    return (
        <style global jsx>{`
            html,
            body {
                background: #ffffff;
                height: 100%;
                margin: 0;
                min-height: 0 !important;
                overflow: hidden;
            }

            #__next,
            #__next > div {
                height: 100%;
                min-height: 0 !important;
                overflow: hidden;
            }
        `}</style>
    );
}
