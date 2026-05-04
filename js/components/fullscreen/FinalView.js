import React from 'react';
import {Spinner} from 'reactstrap';
import {confetti} from '@tsparticles/confetti';
import {Timer} from '../Timer';
import {getTimerReasonLabel} from '../../utils/timerState';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {FullscreenMatchCard} from './FullscreenMatchCard';
import styles from './FinalView.module.css';


const FINAL_FIREWORK_INTERVAL_MS = 900;


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
        x: 0.1 + (Math.random() * 0.8),
        y: 0.08 + (Math.random() * 0.58)
    };
}

function fireFinalConfetti(burstIndex) {
    const origin = randomFireworkOrigin();
    emitFinalEvent('confetti', {
        burstIndex,
        style: 'firework',
        origin
    });

    Promise.resolve(confetti({
        particleCount: 90,
        spread: 360,
        startVelocity: 34,
        decay: 0.91,
        gravity: 0.8,
        scalar: 1.05,
        origin,
        zIndex: 2147483647
    })).catch(error => {
        emitFinalEvent('confetti-error', {message: error.message});
    });
}

function useSteadyFireworks(active, sessionKey) {
    React.useEffect(() => {
        if (!active || typeof window === 'undefined') {
            return undefined;
        }

        let burstIndex = 0;
        emitFinalEvent('confetti-started', {
            intervalMs: FINAL_FIREWORK_INTERVAL_MS,
            sessionKey
        });
        fireFinalConfetti(burstIndex);
        burstIndex += 1;

        const intervalId = window.setInterval(() => {
            fireFinalConfetti(burstIndex);
            burstIndex += 1;
        }, FINAL_FIREWORK_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [active, sessionKey]);
}

function HeaderTimer({timerState}) {
    if (!timerState || !timerState.mode) return null;

    return (
        <div className={styles.headerTimer} data-testid="final-timer">
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
            <section
                className={joinClasses(
                    styles.matchPanel,
                    primary ? styles.matchPanelPrimary : styles.matchPanelSecondary
                )}
                data-testid={testId}
            >
                <div className={styles.panelTitle}>{label}</div>
                <div className={styles.placeholder}>
                    Match noch nicht bereit
                </div>
            </section>
        );
    }

    return (
        <section
            className={joinClasses(
                styles.matchPanel,
                primary ? styles.matchPanelPrimary : styles.matchPanelSecondary
            )}
            data-testid={testId}
            data-match-id={match.id}
            data-match-state={match.state}
        >
            <div className={styles.panelTitle}>{label}</div>
            <div className={styles.matchFrame}>
                <FullscreenMatchCard
                    match={match}
                    index={0}
                    fillHeight
                    showScores
                    animateEntry={false}
                />
            </div>
        </section>
    );
}

function WinnerCelebration({winner, sessionKey}) {
    useSteadyFireworks(Boolean(winner), sessionKey);
    if (!winner) return null;

    return (
        <section className={styles.winnerPanel} data-testid="final-winner-panel">
            <img
                className={styles.winnerMedal}
                src="/static/images/logo-questionmark.png"
                alt=""
                data-testid="final-winner-medal"
            />
            <div className={styles.winnerLabel}>Turniersieger</div>
            <div className={styles.winnerName} data-testid="final-winner-name">
                {winner.name}
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
    const [viewportHeight, setViewportHeight] = React.useState(null);

    React.useEffect(() => {
        const update = () => setViewportHeight(window.innerHeight);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const rootStyle = viewportHeight ?
        {'--final-height': viewportHeight + 'px'} :
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

    if (winner) {
        return (
            <div className={styles.page} style={rootStyle} data-testid="final-view">
                <WinnerCelebration
                    winner={winner}
                    sessionKey={finalMatch.id + ':' + winner.id + ':' + finalMatch.state}
                />
                <GlobalFullscreenStyles/>
            </div>
        );
    }

    const showSide = showThirdPlace && thirdPlaceMatch;

    return (
        <div className={styles.page} style={rootStyle} data-testid="final-view">
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <div className={styles.title} data-testid="final-title">
                        &gt; Finale
                    </div>
                    {tournamentMeta && (
                        <div className={styles.subtitle} data-testid="final-subtitle">
                            {tournamentMeta.name}
                        </div>
                    )}
                </div>
                <HeaderTimer timerState={timerState}/>
            </header>

            <main
                className={joinClasses(
                    styles.stage,
                    showSide ? '' : styles.stageFinalOnly
                )}
            >
                <MatchPanel
                    match={finalMatch}
                    label="Finale"
                    primary
                    testId="final-match-card"
                />

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
