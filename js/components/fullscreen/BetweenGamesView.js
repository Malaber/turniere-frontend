import React from 'react';
import {Spinner} from 'reactstrap';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import styles from './BetweenGamesView.module.css';
import {TeamName} from '../TeamName';


const MATCHES_PER_PAGE = 32;
const CHUNK_CYCLE_MS = 12000;


function MatchCard({match, index}) {
    const team1 = match.team1;
    const team2 = match.team2;
    const delay = (index * 0.03) + 's';
    const badge = match.group ?
        match.group.number :
        match.position;

    return (
        <div
            className={styles.matchCard}
            style={{animationDelay: delay}}
        >
            <div className={styles.matchContent}>
                <div className={styles.matchTeamRow}>
                    <TeamName name={team1.name} className={styles.teamName}/>
                </div>
                <div className={styles.matchTeamRow}>
                    <TeamName name={team2.name} className={styles.teamName}/>
                </div>
            </div>
            <div className={styles.matchBadge}>
                {badge}
            </div>
        </div>
    );
}


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

    getUpcoming() {
        const {matches} = this.props;
        if (!matches) return [];
        return [...matches]
            .sort(sortMatchesByPositionAscending())
            .filter(m => m.state === 'not_started');
    }

    cycleChunk() {
        const upcoming = this.getUpcoming();
        if (upcoming.length === 0) return;
        const total = Math.ceil(
            upcoming.length / MATCHES_PER_PAGE
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

        const upcoming = this.getUpcoming();
        const totalChunks = Math.max(
            1, Math.ceil(upcoming.length / MATCHES_PER_PAGE)
        );
        const start = chunkIndex * MATCHES_PER_PAGE;
        const chunk = upcoming.slice(
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
                        keine weiteren Spiele
                    </div>
                ) : (
                    <div
                        className={styles.matchGrid}
                        key={chunkIndex}
                    >
                        {chunk.map((m, i) =>
                            <MatchCard
                                key={m.id}
                                match={m}
                                index={i}
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
