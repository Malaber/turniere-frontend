import React from 'react';
import {MatchPositionBadge} from '../MatchPositionBadge';
import {TeamName} from '../TeamName';
import styles from './FullscreenMatchCard.module.css';


function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

function stateClass(matchState) {
    switch (matchState) {
    case 'in_progress':
        return styles.stateInProgress;
    case 'finished':
        return styles.stateFinished;
    case 'single_team':
        return styles.stateSingleTeam;
    case 'not_ready':
        return styles.stateNotReady;
    case 'not_started':
    default:
        return styles.stateNotStarted;
    }
}

function scoreFor(match, team) {
    return match.decider ?
        team.hiddenScore :
        team.score;
}

export function FullscreenMatchCard({
    match,
    index,
    showScores = false,
    fillHeight = false,
    animateEntry = true,
    isActive = true,
    animationDelayStep = 0.06
}) {
    const team1 = match.team1;
    const team2 = match.team2;
    const finished = match.state === 'finished';
    const t1Win = finished && match.winnerTeamId === team1.id;
    const t2Win = finished && match.winnerTeamId === team2.id;
    const t1Cls = t1Win ? styles.teamNameWinner : styles.teamName;
    const t2Cls = t2Win ? styles.teamNameWinner : styles.teamName;
    const delay = (index * animationDelayStep) + 's';

    return (
        <div
            className={joinClasses(
                styles.matchCard,
                animateEntry ? styles.matchCardEnter : '',
                fillHeight ? styles.matchCardFill : styles.matchCardAspect,
                stateClass(match.state)
            )}
            style={{animationDelay: delay}}
            data-testid={isActive ? 'fullscreen-match-card' : 'fullscreen-match-card-inactive'}
            data-match-id={match.id}
            data-match-state={match.state}
        >
            <div className={styles.matchContent}>
                <div className={styles.matchTeamRow}>
                    <TeamName
                        name={team1.name}
                        className={t1Cls}
                        testId={isActive ? 'fullscreen-team-name' : 'fullscreen-team-name-inactive'}
                    />
                    {showScores && (
                        <span className={styles.teamScore}>{scoreFor(match, team1)}</span>
                    )}
                </div>
                <div className={styles.matchTeamRow}>
                    <TeamName
                        name={team2.name}
                        className={t2Cls}
                        testId={isActive ? 'fullscreen-team-name' : 'fullscreen-team-name-inactive'}
                    />
                    {showScores && (
                        <span className={styles.teamScore}>{scoreFor(match, team2)}</span>
                    )}
                </div>
            </div>
            <MatchPositionBadge
                match={match}
                as="div"
                className={styles.matchBadge}
                testId={isActive ? 'fullscreen-match-badge' : 'fullscreen-match-badge-inactive'}
                mode="group-for-group-matches"
            />
        </div>
    );
}
