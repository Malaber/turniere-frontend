import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import styles from './BetweenGamesView.module.css';
import {FullscreenMatchCard} from './FullscreenMatchCard';


const MATCHES_PER_PAGE = 32;
const CHUNK_CYCLE_MS = 12000;


function ChunkDots({total, active}) {
    if (total <= 1) return null;
    return (
        <div className={styles.chunkDots}>
            {Array.from({length: total}, (_, i) =>
                <span
                    key={i}
                    className={i === active ?
                        styles.dotActive :
                        styles.dot}
                    data-testid="fullscreen-page-dot"
                />
            )}
        </div>
    );
}


export class BetweenGamesView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {chunkIndex: 0};
        this.cycleChunk = this.cycleChunk.bind(this);
    }

    componentDidMount() {
        this.intervalId = setInterval(
            this.cycleChunk, CHUNK_CYCLE_MS
        );
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    getVisibleMatches() {
        const {matches} = this.props;
        if (!matches) return [];
        return [...matches]
            .sort(sortMatchesByPositionAscending());
    }

    cycleChunk() {
        const visibleMatches = this.getVisibleMatches();
        if (visibleMatches.length === 0) return;
        const total = Math.ceil(
            visibleMatches.length / MATCHES_PER_PAGE
        );
        this.setState(prev => ({
            chunkIndex: (prev.chunkIndex + 1) % total
        }));
    }

    render() {
        const {matches} = this.props;
        const {chunkIndex} = this.state;

        if (matches == null) {
            return (
                <div>
                    <div className={styles.loading}>
                        <Spinner size="sm"/>
                        {' '}lade Daten
                    </div>
                    <style global jsx>{`
                        body { background: #ffffff; }
                    `}</style>
                </div>
            );
        }

        const visibleMatches = this.getVisibleMatches();
        const totalChunks = Math.max(
            1, Math.ceil(visibleMatches.length / MATCHES_PER_PAGE)
        );
        const start = chunkIndex * MATCHES_PER_PAGE;
        const chunk = visibleMatches.slice(
            start, start + MATCHES_PER_PAGE
        );

        return (
            <div className={styles.page}>
                <div className={styles.columnHeader}>
                    <span className={styles.columnIcon}>
                        &#9654;
                    </span>
                    <span className={styles.columnTitle}>
                        Nächste Spiele
                    </span>
                </div>

                {chunk.length === 0 ? (
                    <div className={styles.empty}>
                        keine Matches
                    </div>
                ) : (
                    <div
                        className={styles.matchGrid}
                        key={chunkIndex}
                    >
                        {chunk.map((m, i) =>
                            <FullscreenMatchCard
                                key={m.id}
                                match={m}
                                index={i}
                                fillHeight
                                animationDelayStep={0.03}
                            />
                        )}
                    </div>
                )}

                <ChunkDots
                    total={totalChunks}
                    active={chunkIndex % totalChunks}
                />

                <style global jsx>{`
                    body {
                        background: #ffffff;
                    }
                `}</style>
            </div>
        );
    }
}
