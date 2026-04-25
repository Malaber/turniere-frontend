import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../../utils/timerState';
import styles from './DuringGameView.module.css';
import {TeamName} from '../TeamName';


const MATCHES_PER_PAGE = 16;
const PAGE_CYCLE_MS = 10000;
const COUNTDOWN_THRESHOLD_S = 10;
const FINISHED_DISPLAY_MS = 10000;


function AnimatedDigit({value}) {
    const offset = -(value * 10);
    return (
        <span className={styles.digitSlot}>
            <span
                className={styles.digitStrip}
                style={{transform: 'translateY(' + offset + '%)'}}
            >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
                    <span key={d} className={styles.digitValue}>
                        {d}
                    </span>
                )}
            </span>
        </span>
    );
}


class AnimatedTimer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {display: getTimerDisplay(props.timerState, Date.now())};
        this.timerRef = React.createRef();
        this.tick = this.tick.bind(this);
    }

    componentDidMount() {
        this.startInterval();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.timerState !== this.props.timerState) {
            clearInterval(this.intervalId);
            if (this.props.timerState && this.props.timerState.mode) {
                this.startInterval();
            } else {
                this.setState({
                    display: getTimerDisplay(this.props.timerState, Date.now())
                });
            }
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    startInterval() {
        if (!this.props.timerState || !this.props.timerState.mode) return;
        this.tick();
        this.intervalId = setInterval(this.tick, 1000);
    }

    tick() {
        const display = getTimerDisplay(this.props.timerState, Date.now());

        this.setState({display}, () => {
            const secs = Math.floor(display.ms / 1000);

            if (this.props.onPhaseChange) {
                if (!display.active || display.mode !== TIMER_MODE_COUNTDOWN) {
                    this.props.onPhaseChange('normal');
                } else if (display.ms === 0) {
                    this.props.onPhaseChange('finished');
                } else if (secs <= COUNTDOWN_THRESHOLD_S) {
                    this.props.onPhaseChange('countdown');
                } else {
                    this.props.onPhaseChange('normal');
                }
            }

            if (
                display.mode === TIMER_MODE_COUNTDOWN &&
                secs <= COUNTDOWN_THRESHOLD_S &&
                secs > 0 &&
                this.timerRef.current
            ) {
                const el = this.timerRef.current;
                el.style.animation = 'none';
                void el.offsetWidth;
                el.style.removeProperty('animation');
            }
        });
    }

    render() {
        const {display} = this.state;
        if (!display.active) return null;

        if (display.mode === TIMER_MODE_COUNTDOWN && display.ms === 0) {
            return (
                <div className={styles.timerFinished}>
                    Spiel vorbei!
                </div>
            );
        }

        const totalSeconds = Math.floor(display.ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const isUrgent = display.mode === TIMER_MODE_COUNTDOWN && totalSeconds <= 10;

        const chars = [];
        if (hours > 0) {
            String(hours).split('').forEach(c => chars.push(c));
            chars.push(':');
        }
        String(minutes).split('').forEach(c => chars.push(c));
        chars.push(':');
        String(seconds).padStart(2, '0').split('')
            .forEach(c => chars.push(c));

        const cls = styles.timer +
            (isUrgent ? ' ' + styles.timerUrgent : '');

        return (
            <div ref={this.timerRef} className={cls}>
                {chars.map((char, i) => {
                    if (char === ':') {
                        return (
                            <span
                                key={'s' + i}
                                className={styles.timerSeparator}
                            >:</span>
                        );
                    }
                    return (
                        <AnimatedDigit
                            key={'d' + i}
                            value={parseInt(char, 10)}
                        />
                    );
                })}
            </div>
        );
    }
}


function FullscreenMatchCard({match, index}) {
    const team1 = match.team1;
    const team2 = match.team2;
    const score1 = match.decider ?
        team1.hiddenScore : team1.score;
    const score2 = match.decider ?
        team2.hiddenScore : team2.score;

    const finished = match.state === 'finished';
    const t1Win = finished && match.winnerTeamId === team1.id;
    const t2Win = finished && match.winnerTeamId === team2.id;
    const t1Cls = t1Win ? styles.teamNameWinner : styles.teamName;
    const t2Cls = t2Win ? styles.teamNameWinner : styles.teamName;

    const delay = (index * 0.06) + 's';
    const badge = match.group ?
        match.group.number :
        match.position;

    return (
        <div
            className={styles.matchCard}
            style={{animationDelay: delay}}
            data-testid="fullscreen-match-card"
        >
            <div className={styles.matchContent}>
                <div className={styles.matchTeamRow}>
                    <TeamName name={team1.name} className={t1Cls} testId="fullscreen-team-name"/>
                    <span className={styles.teamScore}>{score1}</span>
                </div>
                <div className={styles.matchTeamRow}>
                    <TeamName name={team2.name} className={t2Cls} testId="fullscreen-team-name"/>
                    <span className={styles.teamScore}>{score2}</span>
                </div>
            </div>
            <div className={styles.matchBadge} data-testid="fullscreen-match-badge">
                {badge}
            </div>
        </div>
    );
}


export class DuringGameView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pageIndex: 0,
            timerPhase: 'normal' // 'normal' | 'countdown' | 'finished'
        };
        this.cyclePage = this.cyclePage.bind(this);
        this.onTimerPhaseChange = this.onTimerPhaseChange.bind(this);
        this._finishedTimeout = null;
    }

    componentDidMount() {
        this.intervalId = setInterval(
            this.cyclePage, PAGE_CYCLE_MS
        );
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
        clearTimeout(this._finishedTimeout);
    }

    onTimerPhaseChange(phase) {
        const prev = this.state.timerPhase;
        if (phase === prev) return;

        if (phase === 'finished' && prev !== 'normal') {
            this.setState({timerPhase: 'finished'});
            clearTimeout(this._finishedTimeout);
            this._finishedTimeout = setTimeout(() => {
                this.setState({timerPhase: 'normal'});
            }, FINISHED_DISPLAY_MS);
        } else if (phase === 'countdown') {
            this.setState({timerPhase: 'countdown'});
        } else if (phase === 'normal' && prev !== 'finished') {
            this.setState({timerPhase: 'normal'});
        }
    }

    cyclePage() {
        const {matches} = this.props;
        if (!matches || matches.length === 0) return;
        const total = Math.ceil(matches.length / MATCHES_PER_PAGE);
        if (total <= 1) return;
        this.setState(prev => ({
            pageIndex: (prev.pageIndex + 1) % total
        }));
    }

    render() {
        const {matches, timerState} = this.props;
        const {pageIndex, timerPhase} = this.state;
        const hasTimer = timerState && timerState.mode;
        const takeover = timerPhase === 'countdown' || timerPhase === 'finished';

        const sorted = matches ?
            [...matches].sort(sortMatchesByPositionAscending()) :
            [];
        const totalPages = Math.ceil(sorted.length / MATCHES_PER_PAGE);
        const start = pageIndex * MATCHES_PER_PAGE;
        const page = sorted.slice(start, start + MATCHES_PER_PAGE);

        // Choose grid columns: 4 cols for a full page, fewer when < 4 matches
        const cols = Math.min(4, page.length);
        let matchContent;
        if (matches == null) {
            matchContent = (
                <div className={styles.matchesLoading}>
                    <Spinner size="sm"/>
                    {' '}lade Matches
                </div>
            );
        } else if (page.length === 0) {
            matchContent = (
                <div className={styles.matchesEmpty}>
                    keine laufenden Matches
                </div>
            );
        } else {
            matchContent = (
                <div
                    className={styles.matchGrid}
                    key={pageIndex}
                    style={{
                        gridTemplateColumns: 'repeat(' + cols + ', 1fr)'
                    }}
                >
                    {page.map((m, i) =>
                        <FullscreenMatchCard
                            key={m.id}
                            match={m}
                            index={i}
                        />
                    )}
                </div>
            );
        }

        const showPager = !takeover && sorted.length > 0 && totalPages > 1;

        // Fullscreen takeover for countdown / finished
        if (takeover) {
            return (
                <div className={styles.duringGameRoot}>
                    <div className={styles.timerTakeover}>
                        {hasTimer ? (
                            <AnimatedTimer
                                timerState={timerState}
                                onPhaseChange={this.onTimerPhaseChange}
                            />
                        ) : (
                            <div className={styles.noTimer}>
                                Kein Timer gesetzt
                            </div>
                        )}
                    </div>

                    <style global jsx>{`
                        body {
                            background: #ffffff;
                        }
                    `}</style>
                </div>
            );
        }

        return (
            <div className={styles.duringGameRoot}>
                <div className={styles.timerContainer}>
                    {hasTimer ? (
                        <AnimatedTimer
                            timerState={timerState}
                            onPhaseChange={this.onTimerPhaseChange}
                        />
                    ) : (
                        <div className={styles.noTimer}>
                            Kein Timer gesetzt
                        </div>
                    )}
                </div>

                <div className={styles.matchesArea}>
                    {matchContent}
                </div>

                {showPager && (
                    <div className={styles.pageIndicator}>
                        {Array.from({length: totalPages}, (_, i) =>
                            <span
                                key={i}
                                className={i === pageIndex ? styles.pageDotActive : styles.pageDot}
                                data-testid="fullscreen-page-dot"
                            />
                        )}
                    </div>
                )}

                <style global jsx>{`
                    body {
                        background: #ffffff;
                    }
                `}</style>
            </div>
        );
    }
}
