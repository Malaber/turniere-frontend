import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import styles from './DuringGameView.module.css';


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
        this.state = {timeLeft: null};
        this.timerRef = React.createRef();
        this.tick = this.tick.bind(this);
    }

    componentDidMount() {
        this.startInterval();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.timerEnd !== this.props.timerEnd) {
            clearInterval(this.intervalId);
            if (this.props.timerEnd) {
                this.startInterval();
            } else {
                this.setState({timeLeft: null});
            }
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    startInterval() {
        if (!this.props.timerEnd) return;
        this.tick();
        this.intervalId = setInterval(this.tick, 1000);
    }

    tick() {
        const now = new Date();
        const remaining = this.props.timerEnd - now;
        const timeLeft = remaining > 0 ? remaining : 0;

        this.setState({timeLeft}, () => {
            const secs = Math.floor(timeLeft / 1000);

            // Report phase to parent
            if (this.props.onPhaseChange) {
                if (timeLeft === 0) {
                    this.props.onPhaseChange('finished');
                } else if (secs <= COUNTDOWN_THRESHOLD_S) {
                    this.props.onPhaseChange('countdown');
                } else {
                    this.props.onPhaseChange('normal');
                }
            }

            // Restart bump animation each second in last 10s
            if (secs <= COUNTDOWN_THRESHOLD_S && secs > 0 && this.timerRef.current) {
                const el = this.timerRef.current;
                el.style.animation = 'none';
                void el.offsetWidth;
                el.style.removeProperty('animation');
            }
        });
    }

    render() {
        const {timeLeft} = this.state;
        if (timeLeft === null) return null;

        if (timeLeft === 0) {
            return (
                <div className={styles.timerFinished}>
                    Spiel vorbei!
                </div>
            );
        }

        const totalSeconds = Math.floor(timeLeft / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const isUrgent = totalSeconds <= 10;

        const chars = [];
        if (hours > 0) {
            String(hours).split('').forEach(c => chars.push(c));
            chars.push(':');
        }
        String(minutes).split('').forEach(c => chars.push(c));
        chars.push(':');
        String(seconds).padStart(2, '0').split('')
            .forEach(c => chars.push(c));

        const cls = styles.timer
            + (isUrgent ? ' ' + styles.timerUrgent : '');

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
    const score1 = match.decider
        ? team1.hiddenScore : team1.score;
    const score2 = match.decider
        ? team2.hiddenScore : team2.score;

    const finished = match.state === 'finished';
    const t1Win = finished && match.winnerTeamId === team1.id;
    const t2Win = finished && match.winnerTeamId === team2.id;
    const t1Cls = t1Win ? styles.teamNameWinner : styles.teamName;
    const t2Cls = t2Win ? styles.teamNameWinner : styles.teamName;

    const delay = (index * 0.06) + 's';
    const badge = match.group
        ? match.group.number
        : match.position;

    return (
        <div
            className={styles.matchCard}
            style={{animationDelay: delay}}
        >
            <div className={styles.matchContent}>
                <div className={styles.matchTeamRow}>
                    <span className={t1Cls}>{team1.name}</span>
                    <span className={styles.teamScore}>{score1}</span>
                </div>
                <div className={styles.matchTeamRow}>
                    <span className={t2Cls}>{team2.name}</span>
                    <span className={styles.teamScore}>{score2}</span>
                </div>
            </div>
            <div className={styles.matchBadge}>
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
            timerPhase: 'normal', // 'normal' | 'countdown' | 'finished'
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
        const {matches, timerEnd} = this.props;
        const {pageIndex, timerPhase} = this.state;
        const takeover = timerPhase === 'countdown' || timerPhase === 'finished';

        const sorted = matches
            ? [...matches].sort(sortMatchesByPositionAscending())
            : [];
        const totalPages = Math.ceil(sorted.length / MATCHES_PER_PAGE);
        const start = pageIndex * MATCHES_PER_PAGE;
        const page = sorted.slice(start, start + MATCHES_PER_PAGE);

        // Choose grid columns: 4 cols for a full page, fewer when < 4 matches
        const cols = Math.min(4, page.length);
        const rows = cols > 0 ? Math.ceil(page.length / cols) : 0;

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
                        gridTemplateColumns: 'repeat(' + cols + ', 1fr)',
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
                        {timerEnd ? (
                            <AnimatedTimer
                                timerEnd={timerEnd}
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
                    {timerEnd ? (
                        <AnimatedTimer
                            timerEnd={timerEnd}
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
