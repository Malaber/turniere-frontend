import React from 'react';
import {Spinner} from 'reactstrap';
import {confetti} from '@tsparticles/confetti';
import {TeamName} from '../TeamName';
import {Timer} from '../Timer';
import {getTimerReasonLabel} from '../../utils/timerState';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import styles from './FinalView.module.css';


const FINAL_FIREWORK_BURSTS = 18;
const FINAL_FIREWORK_INTERVAL_MS = 170;


function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

function scoreFor(match, team) {
    const score = match.decider ?
        team.hiddenScore :
        team.score;
    return score === null || score === undefined ? '' : score;
}

function isThirdPlaceMatch(match) {
    return match && match.position === 2;
}

function isFinalFinished(match) {
    return match && (match.state === 'finished' || match.state === 'single_team');
}

function winnerTeam(match) {
    if (!isFinalFinished(match)) {
        return null;
    }
    if (match.winnerTeamId && match.team1 && match.team1.id === match.winnerTeamId) {
        return match.team1;
    }
    if (match.winnerTeamId && match.team2 && match.team2.id === match.winnerTeamId) {
        return match.team2;
    }

    const team1Score = Number(scoreFor(match, match.team1));
    const team2Score = Number(scoreFor(match, match.team2));
    if (!Number.isFinite(team1Score) || !Number.isFinite(team2Score) || team1Score === team2Score) {
        return null;
    }

    return team1Score > team2Score ? match.team1 : match.team2;
}

function emitFinalEvent(type, payload) {
    if (typeof window === 'undefined') return;

    const event = Object.assign({type, at: window.performance.now()}, payload || {});
    if (!window.__beamerFinalView) {
        window.__beamerFinalView = {events: []};
    }
    window.__beamerFinalView.events.push(event);
    window.dispatchEvent(new CustomEvent('beamer-final-view', {detail: event}));
}

function randomFireworkOrigin() {
    return {
        x: 0.08 + (Math.random() * 0.84),
        y: 0.1 + (Math.random() * 0.58)
    };
}

function fireFinalConfetti(origin, burstIndex) {
    emitFinalEvent('confetti', {
        burstIndex,
        style: 'firework',
        origin
    });

    Promise.resolve(confetti({
        particleCount: 90 + Math.floor(Math.random() * 50),
        spread: 360,
        startVelocity: 32 + (Math.random() * 24),
        decay: 0.91,
        gravity: 0.8,
        scalar: 1 + (Math.random() * 0.45),
        origin,
        zIndex: 2147483647
    })).catch(error => {
        emitFinalEvent('confetti-error', {message: error.message});
    });
}

function triggerFinalFireworks() {
    emitFinalEvent('confetti-scheduled', {bursts: FINAL_FIREWORK_BURSTS});

    for (let burstIndex = 0; burstIndex < FINAL_FIREWORK_BURSTS; burstIndex++) {
        const fire = () => fireFinalConfetti(randomFireworkOrigin(), burstIndex);
        if (burstIndex === 0) {
            fire();
            continue;
        }
        window.setTimeout(fire, burstIndex * FINAL_FIREWORK_INTERVAL_MS);
    }
}

function HeaderTimer({timerState}) {
    if (!timerState || !timerState.mode) return null;

    return (
        <div className={styles.timer} data-testid="final-timer">
            <span className={styles.timerReason}>
                {getTimerReasonLabel(timerState)}
            </span>
            <span className={styles.timerValue}>
                <Timer timerState={timerState}/>
            </span>
        </div>
    );
}

function MatchPanel({match, label, primary = false, testId}) {
    if (!match) {
        return (
            <div
                className={joinClasses(
                    styles.matchPanel,
                    primary ? styles.matchPanelPrimary : styles.matchPanelThird
                )}
                data-testid={testId}
            >
                <div className={styles.placeholder}>
                    Match noch nicht bereit
                </div>
            </div>
        );
    }

    const finalFinished = isFinalFinished(match);
    const matchWinner = winnerTeam(match);
    const rows = [
        {team: match.team1, winner: matchWinner && match.team1.id === matchWinner.id},
        {team: match.team2, winner: matchWinner && match.team2.id === matchWinner.id}
    ];

    return (
        <section
            className={joinClasses(
                styles.matchPanel,
                primary ? styles.matchPanelPrimary : styles.matchPanelThird,
                finalFinished ? styles.matchPanelFinished : ''
            )}
            data-testid={testId}
            data-match-id={match.id}
            data-match-state={match.state}
        >
            <div className={styles.matchLabel}>
                <span>{label}</span>
                <span className={styles.matchBadge}>#{match.position}</span>
            </div>
            <div className={styles.matchBody}>
                {rows.map(({team, winner}, index) => (
                    <div
                        key={(team.id || team.name) + '-' + index}
                        className={joinClasses(
                            styles.teamRow,
                            winner ? styles.teamRowWinner : ''
                        )}
                        data-testid={primary ? 'final-team-row' : 'third-place-team-row'}
                    >
                        <TeamName
                            name={team.name}
                            className={joinClasses(
                                styles.teamName,
                                primary ? '' : styles.thirdTeamName
                            )}
                            testId={primary ? 'final-team-name' : 'third-place-team-name'}
                        />
                        <span
                            className={joinClasses(
                                styles.score,
                                primary ? '' : styles.thirdScore
                            )}
                            data-testid={primary ? 'final-team-score' : 'third-place-team-score'}
                        >
                            {scoreFor(match, team)}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

function WinnerPanel({winner}) {
    if (!winner) return null;

    return (
        <section className={styles.winnerPanel} data-testid="final-winner-panel">
            <img
                className={styles.winnerMedal}
                src="/static/images/logo-questionmark.png"
                alt=""
                data-testid="final-winner-medal"
            />
            <div className={styles.winnerText}>
                <div className={styles.winnerLabel}>Turniersieger</div>
                <div className={styles.winnerName} data-testid="final-winner-name">
                    {winner.name}
                </div>
            </div>
        </section>
    );
}

function normalizeFinalMatches(matches) {
    if (!Array.isArray(matches)) {
        return null;
    }

    const sorted = matches.slice().sort(sortMatchesByPositionAscending());
    const finalMatch = sorted.find(match => !isThirdPlaceMatch(match)) || sorted[0] || null;
    const thirdPlaceMatch = sorted.find(isThirdPlaceMatch) || null;

    return {finalMatch, thirdPlaceMatch};
}

export function FinalView({tournamentMeta, matches, timerState, showThirdPlace = true}) {
    const finalMatches = normalizeFinalMatches(matches);
    const finalMatch = finalMatches ? finalMatches.finalMatch : null;
    const thirdPlaceMatch = finalMatches ? finalMatches.thirdPlaceMatch : null;
    const winner = winnerTeam(finalMatch);
    const firedKeyRef = React.useRef(null);
    const viewportHeightRef = React.useRef(null);
    const [viewportHeight, setViewportHeight] = React.useState(null);

    React.useEffect(() => {
        const update = () => setViewportHeight(window.innerHeight);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    React.useEffect(() => {
        if (!winner || !finalMatch) return;

        const key = finalMatch.id + ':' + winner.id + ':' + finalMatch.state;
        if (firedKeyRef.current === key) return;
        firedKeyRef.current = key;
        triggerFinalFireworks();
    }, [finalMatch, winner]);

    viewportHeightRef.current = viewportHeight;
    const rootStyle = viewportHeightRef.current ?
        {'--final-height': viewportHeightRef.current + 'px'} :
        undefined;

    if (matches == null) {
        return (
            <div className={styles.page} style={rootStyle} data-testid="final-view">
                <div className={styles.loading}>
                    <Spinner size="sm"/>
                    {' '}lade Finale
                </div>
                <GlobalFullscreenStyles/>
            </div>
        );
    }

    const showSide = showThirdPlace && thirdPlaceMatch;

    return (
        <div className={styles.page} style={rootStyle} data-testid="final-view">
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <div className={styles.eyebrow}>Finale</div>
                    <div className={styles.title} data-testid="final-title">
                        {tournamentMeta ? tournamentMeta.name : 'turnie.re'}
                    </div>
                </div>
                <HeaderTimer timerState={timerState}/>
            </header>

            <main
                className={joinClasses(
                    styles.stage,
                    showSide ? '' : styles.stageFinalOnly
                )}
            >
                <div className={styles.finalStack}>
                    <MatchPanel
                        match={finalMatch}
                        label="Finale"
                        primary
                        testId="final-match-card"
                    />
                    <WinnerPanel winner={winner}/>
                </div>

                {showSide && (
                    <aside className={styles.sideStack}>
                        <MatchPanel
                            match={thirdPlaceMatch}
                            label="Spiel um Platz 3"
                            testId="third-place-match-card"
                        />
                    </aside>
                )}
            </main>
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
