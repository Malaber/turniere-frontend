import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {getTimerReasonLabel} from '../../utils/timerState';
import {Timer} from '../Timer';
import {FullscreenMatchCard} from './FullscreenMatchCard';
import styles from './NextMatchesView.module.css';


const MAX_MATCHES = 32;


function hasTwoTeams(match) {
    return match && match.team1 && match.team2 &&
        match.team1.name && match.team2.name &&
        match.team1.name !== 'TBD' && match.team2.name !== 'TBD';
}

function nextGroupStageMatches(tournament) {
    const groups = tournament && tournament.groupStage && tournament.groupStage.state !== 'finished' ?
        tournament.groupStage.groups :
        [];

    return (groups || [])
        .flatMap(group => (group.matches || []).map(match => ({
            ...match,
            group: match.group || {id: group.id, number: group.number}
        })));
}

function nextPlayoffMatches(tournament) {
    return (tournament && tournament.playoffStages ? tournament.playoffStages : [])
        .flatMap(stage => (stage.matches || []).map(match => ({
            ...match,
            stageLevel: stage.level
        })));
}

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

export function nextMatchesForTournament(tournament) {
    if (!tournament) {
        return null;
    }

    const groupMatches = nextGroupStageMatches(tournament);
    const sourceMatches = groupMatches.length > 0 ?
        groupMatches :
        nextPlayoffMatches(tournament);

    return sourceMatches
        .filter(match => match.state === 'not_started' && hasTwoTeams(match))
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

export function NextMatchesView({tournament, timerState}) {
    const matches = nextMatchesForTournament(tournament);

    if (matches === null) {
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

            {matches.length === 0 ? (
                <div className={styles.empty}>
                    keine Matches
                </div>
            ) : (
                <div className={styles.matchGrid} data-testid="next-matches-grid">
                    {matches.map((match, index) => (
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
