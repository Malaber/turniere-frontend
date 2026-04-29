import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {formatTimerMs, getTimerDisplay, TIMER_MODE_COUNTDOWN} from '../../utils/timerState';
import styles from './DuringGameView.module.css';
import {FullscreenMatchCard} from './FullscreenMatchCard';


const MATCHES_PER_PAGE = 16;
const PORTRAIT_MATCHES_PER_PAGE = 8;
const PAGE_CYCLE_MS = 10000;
const COUNTDOWN_THRESHOLD_S = 10;
const FINISHED_DISPLAY_MS = 10000;


function getTotalPages(matches, matchesPerPage = MATCHES_PER_PAGE) {
    if (!matches || matches.length === 0) return 0;
    return Math.ceil(matches.length / matchesPerPage);
}


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


export class AnimatedTimer extends React.Component {
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
            if (this.props.hideFinished) return null;
            return (
                <div className={styles.timerFinished}>
                    Spiel vorbei!
                </div>
            );
        }

        const totalSeconds = Math.floor(display.ms / 1000);
        const isUrgent = display.mode === TIMER_MODE_COUNTDOWN &&
            (totalSeconds <= 10 || this.props.forceUrgent);

        const chars = formatTimerMs(display.ms).split('');
        const timerStyle = {'--timer-slots': String(chars.length)};

        const cls = styles.timer +
            (isUrgent ? ' ' + styles.timerUrgent : '') +
            (this.props.className ? ' ' + this.props.className : '');

        return (
            <div
                ref={this.timerRef}
                className={cls}
                data-testid={this.props.testId}
                style={timerStyle}
            >
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


export class DuringGameView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pageIndex: 0,
            hasPaged: false,
            matchesPerPage: MATCHES_PER_PAGE,
            viewportHeight: null,
            timerPhase: 'normal' // 'normal' | 'countdown' | 'finished'
        };
        this.cyclePage = this.cyclePage.bind(this);
        this.onTimerPhaseChange = this.onTimerPhaseChange.bind(this);
        this.updateViewportLayout = this.updateViewportLayout.bind(this);
        this._finishedTimeout = null;
    }

    componentDidMount() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            this.portraitMediaQuery = window.matchMedia('(max-aspect-ratio: 3 / 4)');
            this.updateViewportLayout();
            if (this.portraitMediaQuery.addEventListener) {
                this.portraitMediaQuery.addEventListener('change', this.updateViewportLayout);
            } else if (this.portraitMediaQuery.addListener) {
                this.portraitMediaQuery.addListener(this.updateViewportLayout);
            }
            window.addEventListener('resize', this.updateViewportLayout);
        }
        this.intervalId = setInterval(
            this.cyclePage, PAGE_CYCLE_MS
        );
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.matches !== this.props.matches) {
            this.updateViewportLayout();
        }

        const prevTotal = getTotalPages(prevProps.matches, prevState.matchesPerPage);
        const total = getTotalPages(this.props.matches, this.state.matchesPerPage);
        const nextState = {};

        if (total > 0 && this.state.pageIndex >= total) {
            nextState.pageIndex = 0;
        }

        if (prevTotal === 0 && total > 0 && this.state.hasPaged) {
            nextState.hasPaged = false;
            nextState.pageIndex = 0;
        }

        if (Object.keys(nextState).length > 0) {
            this.setState(nextState);
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
        clearTimeout(this._finishedTimeout);
        if (this.portraitMediaQuery) {
            if (this.portraitMediaQuery.removeEventListener) {
                this.portraitMediaQuery.removeEventListener('change', this.updateViewportLayout);
            } else if (this.portraitMediaQuery.removeListener) {
                this.portraitMediaQuery.removeListener(this.updateViewportLayout);
            }
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.updateViewportLayout);
        }
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
        const total = Math.ceil(matches.length / this.state.matchesPerPage);
        if (total <= 1) return;
        this.setState(prev => ({
            pageIndex: (prev.pageIndex + 1) % total,
            hasPaged: true
        }));
    }

    updateViewportLayout() {
        const matchesPerPage = this.portraitMediaQuery && this.portraitMediaQuery.matches ?
            PORTRAIT_MATCHES_PER_PAGE :
            MATCHES_PER_PAGE;
        const viewportHeight = typeof window !== 'undefined' ?
            window.innerHeight :
            null;

        this.setState(prev => {
            const matchCount = this.props.matches ? this.props.matches.length : 0;
            const totalPages = Math.max(1, Math.ceil(matchCount / matchesPerPage));
            const pageIndex = Math.min(prev.pageIndex, totalPages - 1);

            if (
                prev.matchesPerPage === matchesPerPage &&
                prev.viewportHeight === viewportHeight &&
                prev.pageIndex === pageIndex
            ) {
                return null;
            }

            return {
                matchesPerPage,
                viewportHeight,
                pageIndex
            };
        });
    }

    render() {
        const {matches, timerState} = this.props;
        const {pageIndex, timerPhase, matchesPerPage, viewportHeight} = this.state;
        const hasTimer = timerState && timerState.mode;
        const takeover = timerPhase === 'countdown' || timerPhase === 'finished';
        const rootStyle = viewportHeight ?
            {'--fullscreen-height': viewportHeight + 'px'} :
            undefined;

        const sorted = matches ?
            [...matches].sort(sortMatchesByPositionAscending()) :
            [];
        const totalPages = Math.ceil(sorted.length / matchesPerPage);
        const pages = [];
        for (let i = 0; i < totalPages; i++) {
            pages.push(sorted.slice(
                i * matchesPerPage,
                (i + 1) * matchesPerPage
            ));
        }

        const page = pages[pageIndex] || [];
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
                <div className={styles.matchCarousel}>
                    <div
                        className={styles.matchCarouselTrack}
                        data-testid="fullscreen-match-carousel-track"
                        style={{
                            transform: 'translateX(-' + (pageIndex * 100) + '%)'
                        }}
                    >
                        {pages.map((matchPage, pageNumber) => {
                            const active = pageNumber === pageIndex;
                            const animateCards = active && !this.state.hasPaged;
                            const cols = Math.min(4, matchPage.length);

                            return (
                                <div
                                    key={pageNumber}
                                    className={styles.matchCarouselPage}
                                    aria-hidden={!active}
                                >
                                    <div
                                        className={styles.matchGrid}
                                        style={{
                                            '--match-grid-columns': cols
                                        }}
                                    >
                                        {matchPage.map((m, i) =>
                                            <FullscreenMatchCard
                                                key={m.id}
                                                match={m}
                                                index={i}
                                                animateEntry={animateCards}
                                                isActive={active}
                                                showScores
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        const showPager = !takeover && sorted.length > 0 && totalPages > 1;

        // Fullscreen takeover for countdown / finished
        if (takeover) {
            return (
                <div className={styles.duringGameRoot} style={rootStyle}>
                    <div className={styles.timerTakeover}>
                        {hasTimer ? (
                            <AnimatedTimer
                                timerState={timerState}
                                onPhaseChange={this.onTimerPhaseChange}
                                testId="fullscreen-timer"
                            />
                        ) : (
                            <div className={styles.noTimer}>
                                Kein Timer gesetzt
                            </div>
                        )}
                    </div>

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
                </div>
            );
        }

        return (
            <div className={styles.duringGameRoot} style={rootStyle}>
                <div className={styles.timerContainer}>
                    {hasTimer ? (
                        <AnimatedTimer
                            timerState={timerState}
                            onPhaseChange={this.onTimerPhaseChange}
                            testId="fullscreen-timer"
                            hideFinished={timerPhase === 'normal'}
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
            </div>
        );
    }
}
