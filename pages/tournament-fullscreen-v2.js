import Head from 'next/head';
import React from 'react';
import {Container, Spinner} from 'reactstrap';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {
    convertMatchesSnapshot, convertTournamentSnapshot,
    getBeamerByName, getTournament, getTournamentMatches,
    getTournamentMeta, getTournamentTimerState
} from '../js/redux/tournamentApi';
import {connectToBeamerSocket, connectToTimerSocket} from '../js/utils/beamerSocket';
import {normalizeTimerState} from '../js/utils/timerState';
import {connectToTournamentMatchesSocket, connectToTournamentSocket} from '../js/utils/tournamentLiveSocket';
import {MatchesView} from '../js/components/fullscreen/MatchesView';
import {GroupsView} from '../js/components/fullscreen/GroupsView';
import {DuringGameView} from '../js/components/fullscreen/DuringGameView';
import {BetweenGamesView} from '../js/components/fullscreen/BetweenGamesView';
import {BeamerTimerEffects} from '../js/components/fullscreen/BeamerTimerEffects';
import {TimerOnlyView} from '../js/components/fullscreen/TimerOnlyView';
import {WerbungView} from '../js/components/fullscreen/WerbungView';
import {NextMatchesView} from '../js/components/fullscreen/NextMatchesView';
import {FinalView} from '../js/components/fullscreen/FinalView';
import {
    beamerMediaImageForKey,
    selectedWerbungImages,
    STATIC_IMAGE_KEY_CONFIG_KEY,
    WERBUNG_DISPLAY_MODE,
    werbungRotationMs
} from '../js/utils/beamerMedia';


const NEXT_MATCHES_DISPLAY_MODE = 'next_matches';
const FINAL_DISPLAY_MODE = 'final';

const DISPLAY_STATE_LABELS = {
    'matches_all': 'alle',
    'matches_in_progress': 'laufend',
    'matches_upcoming': 'kommend',
    'matches_not_started': 'bereit zum Starten',
    'matches_finished': 'beendet',
    'groups': 'Gruppenstand',
    'group_tables': 'Gruppenstand',
    'between_games': 'Zwischen den Spielen',
    'during_game': 'Während dem Spiel',
    'next_matches': 'Nächste Spiele',
    'final': 'Finale',
    'timer_only': 'Nur Timer',
    'static_image': 'Statisches Bild',
    'werbung': 'Werbung'
};

const DEFAULT_DISPLAY_STATE_FILTERS = {
    'matches_all': {},
    'matches_in_progress': {state: 'in_progress'},
    'matches_upcoming': {state: 'upcoming'},
    'matches_not_started': {state: 'not_started'},
    'matches_finished': {state: 'finished'},
    'during_game': {state: 'in_progress'},
    'between_games': {},
    'next_matches': {},
    'final': {stage_level: 0},
    'timer_only': {},
    'groups': {},
    'group_tables': {},
    'static_image': {},
    'werbung': {}
};

function filtersFromConfig(config) {
    if (!config || typeof config.match_filter !== 'string') {
        return null;
    }

    return config.match_filter.split(',').reduce((filters, part) => {
        const pieces = part.split(':');
        if (pieces.length !== 2 || !pieces[0] || !pieces[1]) {
            return filters;
        }
        filters[pieces[0]] = pieces[1];
        return filters;
    }, {});
}

function filtersForDisplayState(displayState, config = null) {
    return filtersFromConfig(config) || DEFAULT_DISPLAY_STATE_FILTERS[displayState] || {};
}

function filterKey(filters) {
    return Object.keys(filters || {})
        .filter(key => filters[key] !== null && filters[key] !== undefined && filters[key] !== '')
        .sort()
        .map(key => key + ':' + filters[key])
        .join(',');
}

function displayStateUsesMatches(displayState) {
    return [
        'matches_all',
        'matches_in_progress',
        'matches_upcoming',
        'matches_not_started',
        'matches_finished',
        'during_game',
        'between_games',
        'next_matches',
        'final'
    ].indexOf(displayState) !== -1;
}

function displayStateForBeamer(beamer) {
    if (!beamer) {
        return null;
    }
    if (beamer && beamer.config && beamer.config.display_mode === 'timer_only') {
        return 'timer_only';
    }
    if (beamer && beamer.config && beamer.config.display_mode === NEXT_MATCHES_DISPLAY_MODE) {
        return 'next_matches';
    }
    if (beamer && beamer.config && beamer.config.display_mode === FINAL_DISPLAY_MODE) {
        return 'final';
    }
    if (beamer && beamer.config && beamer.config.display_mode === WERBUNG_DISPLAY_MODE) {
        return 'werbung';
    }
    return beamer.display_state;
}

function showTimerReasonForBeamerConfig(config) {
    return !config || config.show_timer_reason !== false;
}

function matchHasGroup(match) {
    return match && match.group && match.group.number !== undefined && match.group.number !== null;
}

function groupLookupForTournament(tournament) {
    const groups = tournament && tournament.groupStage ? tournament.groupStage.groups : null;
    if (!Array.isArray(groups)) {
        return {};
    }

    return groups.reduce((lookup, group) => {
        if (!Array.isArray(group.matches)) {
            return lookup;
        }

        group.matches.forEach(match => {
            lookup[match.id] = {id: group.id, number: group.number};
        });
        return lookup;
    }, {});
}

function withGroupNumbersFromTournament(matches, tournament) {
    if (!Array.isArray(matches) || matches.length === 0) {
        return matches;
    }

    const groupsByMatchId = groupLookupForTournament(tournament);
    if (Object.keys(groupsByMatchId).length === 0) {
        return matches;
    }

    let changed = false;
    const enrichedMatches = matches.map(match => {
        if (matchHasGroup(match) || !groupsByMatchId[match.id]) {
            return match;
        }

        changed = true;
        return {
            ...match,
            group: groupsByMatchId[match.id]
        };
    });

    return changed ? enrichedMatches : matches;
}


class Main extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            tournamentMeta: null,
            tournament: null,
            matches: [],
            timerState: {mode: null, timestampIso: null},
            displayState: props.query.display || 'during_game',
            beamerConfig: null,
            beamerName: props.query.beamer || 'default',
            loadedMeta: false,
            loadedMatches: false,
            metaStatus: null,
            matchesStatus: null,
            socket: null,
            timerSocket: null,
            tournamentSocket: null,
            matchesSocket: null
        };

        this.updateMatches = this.updateMatches.bind(this);
        this.updateTimerState = this.updateTimerState.bind(this);
        this.updateTournament = this.updateTournament.bind(this);
        this.pollLiveState = this.pollLiveState.bind(this);
        this.connectBeamerSocket = this.connectBeamerSocket.bind(this);
        this.connectTimerSocket = this.connectTimerSocket.bind(this);
        this.connectTournamentSocket = this.connectTournamentSocket.bind(this);
        this.connectMatchesSocket = this.connectMatchesSocket.bind(this);
        this.disconnectMatchesSocket = this.disconnectMatchesSocket.bind(this);
        this.refreshBeamerConfig = this.refreshBeamerConfig.bind(this);
        this.onBeamerMessage = this.onBeamerMessage.bind(this);
        this.onTimerMessage = this.onTimerMessage.bind(this);
        this.onTournamentMessage = this.onTournamentMessage.bind(this);
        this.onMatchesMessage = this.onMatchesMessage.bind(this);
    }

    shouldResetMatchesFor(nextDisplayState, nextConfig) {
        if (!displayStateUsesMatches(nextDisplayState)) {
            return false;
        }
        if (!this.state.loadedMatches) {
            return true;
        }
        if (nextDisplayState !== this.state.displayState) {
            return true;
        }

        const currentFilterKey = filterKey(filtersForDisplayState(this.state.displayState, this.state.beamerConfig));
        const nextFilterKey = filterKey(filtersForDisplayState(nextDisplayState, nextConfig));
        return currentFilterKey !== nextFilterKey;
    }

    componentDidMount() {
        document.body.classList.add('hide-cursor');
        const code = this.props.query.code;
        const beamerName = this.state.beamerName;
        const forcedDisplayState = this.props.query.display;

        if (forcedDisplayState) {
            this.updateMatches();
        } else {
            this.refreshBeamerConfig(code, beamerName);
        }

        // Fetch tournament metadata
        getTournamentMeta(code,
            (status, meta) => {
                this.setState({
                    metaStatus: status,
                    tournamentMeta: meta,
                    loadedMeta: true
                }, () => {
                    this.connectTimerSocket(meta.id);
                    this.connectTournamentSocket(meta.id);
                    this.connectMatchesSocket(meta.id);
                });
            },
            error => {
                const s = error.response ? error.response.status : -1;
                this.setState({metaStatus: s, loadedMeta: true});
            }
        );

        // Fetch full tournament data and match list once. Live replacements arrive through ActionCable.
        this.updateTournament();

        // Initial timer snapshot. Live replacements arrive through ActionCable.
        this.updateTimerState();
        this.pollInterval = setInterval(this.pollLiveState, 3000);
    }

    componentWillUnmount() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        if (this.state.socket) {
            this.state.socket.disconnect();
        }
        if (this.state.timerSocket) {
            this.state.timerSocket.disconnect();
        }
        if (this.state.tournamentSocket) {
            this.state.tournamentSocket.disconnect();
        }
        if (this.state.matchesSocket) {
            this.state.matchesSocket.disconnect();
        }
    }

    pollLiveState() {
        this.updateTimerState();
        this.updateTournament();

        if (this.props.query.display) {
            this.updateMatches();
            return;
        }

        this.refreshBeamerConfig(this.props.query.code, this.state.beamerName);
    }

    connectBeamerSocket(beamerName) {
        if (this.state.socket) {
            this.state.socket.disconnect();
        }

        const socket = connectToBeamerSocket({
            tournamentId: this.state.tournamentMeta ? this.state.tournamentMeta.id : this.props.query.code,
            beamerName,
            onMessage: this.onBeamerMessage
        });
        this.setState({socket});
    }

    connectTimerSocket(tournamentId) {
        if (!tournamentId) {
            return;
        }

        if (this.state.timerSocket) {
            return;
        }

        const timerSocket = connectToTimerSocket({
            tournamentId,
            onMessage: this.onTimerMessage
        });
        this.setState({timerSocket});
    }

    connectTournamentSocket(tournamentId) {
        if (!tournamentId || this.state.tournamentSocket) {
            return;
        }

        const tournamentSocket = connectToTournamentSocket({
            tournamentId,
            onMessage: this.onTournamentMessage
        });
        this.setState({tournamentSocket});
    }

    connectMatchesSocket(tournamentId) {
        if (!tournamentId) {
            return;
        }

        if (!displayStateUsesMatches(this.state.displayState)) {
            this.disconnectMatchesSocket();
            return;
        }

        const filters = filtersForDisplayState(this.state.displayState, this.state.beamerConfig);
        const key = tournamentId + ':' + filterKey(filters);
        if (this.matchesSocketKey === key) {
            return;
        }

        if (this.state.matchesSocket) {
            this.state.matchesSocket.disconnect();
        }

        const matchesSocket = connectToTournamentMatchesSocket({
            tournamentId,
            filters,
            onMessage: this.onMatchesMessage
        });
        this.matchesSocketKey = key;
        this.setState({matchesSocket});
    }

    disconnectMatchesSocket() {
        if (this.state.matchesSocket) {
            this.state.matchesSocket.disconnect();
            this.setState({matchesSocket: null});
        }
        this.matchesSocketKey = null;
    }

    refreshBeamerConfig(code, beamerName) {
        getBeamerByName(code, beamerName,
            (status, beamer) => {
                const nextDisplayState = displayStateForBeamer(beamer);
                const nextConfig = beamer.config || null;
                this.setState({
                    displayState: nextDisplayState,
                    beamerConfig: nextConfig,
                    beamerName: beamer.name,
                    loadedMatches: this.shouldResetMatchesFor(nextDisplayState, nextConfig) ?
                        false :
                        this.state.loadedMatches
                }, () => {
                    this.connectBeamerSocket(beamer.name);
                    this.updateMatches();
                    if (this.state.tournamentMeta) {
                        this.connectMatchesSocket(this.state.tournamentMeta.id);
                    }
                });
            },
            () => {
                if (beamerName !== 'default') {
                    this.refreshBeamerConfig(code, 'default');
                    return;
                }
                this.setState({
                    displayState: 'during_game',
                    beamerConfig: null,
                    loadedMatches: false
                }, this.updateMatches);
            }
        );
    }

    onBeamerMessage(message) {
        const beamer = message.beamer;
        if (!beamer) {
            return;
        }

        if (message.type === 'beamer.deleted') {
            this.refreshBeamerConfig(this.props.query.code, this.props.query.beamer || beamer.name);
            return;
        }

        const reconnectNeeded = this.state.beamerName !== beamer.name;
        const nextDisplayState = displayStateForBeamer(beamer);
        const nextConfig = beamer.config || null;
        this.setState({
            displayState: nextDisplayState,
            beamerConfig: nextConfig,
            beamerName: beamer.name,
            loadedMatches: this.shouldResetMatchesFor(nextDisplayState, nextConfig) ?
                false :
                this.state.loadedMatches
        }, () => {
            if (reconnectNeeded) {
                this.connectBeamerSocket(beamer.name);
            }
            this.updateMatches();
            if (this.state.tournamentMeta) {
                this.connectMatchesSocket(this.state.tournamentMeta.id);
            }
        });
    }

    onTimerMessage(message) {
        if (message.type && message.type !== 'timer.updated') {
            return;
        }

        this.setState({timerState: normalizeTimerState(message)});
    }

    onTournamentMessage(message) {
        if (message.type && message.type !== 'tournament.updated') {
            return;
        }
        if (!message.tournament) {
            return;
        }

        this.setState(prev => {
            const cachedMetadata = prev.tournament ? {
                readOnlyMode: prev.tournament.readOnlyMode,
                syncTargetUrl: prev.tournament.syncTargetUrl,
                syncAuthToken: prev.tournament.syncAuthToken,
                syncLastPushedAt: prev.tournament.syncLastPushedAt,
                syncLastPushError: prev.tournament.syncLastPushError
            } : null;

            const tournament = convertTournamentSnapshot(message.tournament, cachedMetadata);
            return {
                tournament,
                matches: withGroupNumbersFromTournament(prev.matches, tournament)
            };
        });
    }

    onMatchesMessage(message) {
        if (!displayStateUsesMatches(this.state.displayState)) {
            return;
        }

        if (message.type && message.type !== 'tournament_matches.updated') {
            return;
        }
        if (!Array.isArray(message.matches)) {
            return;
        }

        const currentFilterKey = filterKey(filtersForDisplayState(this.state.displayState, this.state.beamerConfig));
        const messageFilters = message.filters || (message.state ? {state: message.state} : {});
        if (filterKey(messageFilters) !== currentFilterKey) {
            return;
        }

        const matches = convertMatchesSnapshot(message.matches);
        this.setState(prev => ({
            matchesStatus: 200,
            matches: withGroupNumbersFromTournament(matches, prev.tournament),
            loadedMatches: true
        }));
    }

    updateMatches() {
        if (!displayStateUsesMatches(this.state.displayState)) {
            this.setState({matchesStatus: 200, matches: [], loadedMatches: true});
            return;
        }

        const code = this.props.query.code;
        const backendFilter = filtersForDisplayState(this.state.displayState, this.state.beamerConfig);
        getTournamentMatches(code,
            (status, matches) => {
                this.setState(prev => ({
                    matchesStatus: status,
                    matches: withGroupNumbersFromTournament(matches, prev.tournament),
                    loadedMatches: true
                }));
            },
            error => {
                const s = error.response ? error.response.status : -1;
                this.setState({matchesStatus: s, loadedMatches: true});
            },
            backendFilter
        );
    }

    updateTimerState() {
        const code = this.props.query.code;
        getTournamentTimerState(code,
            (status, timerState) => this.setState({timerState}),
            error => console.error('Failed to fetch timer state:', error)
        );
    }

    updateTournament() {
        const code = this.props.query.code;
        getTournament(code,
            (status, tournament) => this.setState(prev => ({
                tournament,
                matches: withGroupNumbersFromTournament(prev.matches, tournament)
            }), () => {
                this.connectTimerSocket(tournament.id);
                this.connectTournamentSocket(tournament.id);
                this.connectMatchesSocket(tournament.id);
            }),
            error => console.error('Failed to fetch tournament:', error)
        );
    }

    renderView() {
        const {displayState, tournamentMeta, matches, timerState, tournament} = this.state;

        switch (displayState) {
        case 'groups':
        case 'group_tables':
            return <GroupsView
                tournament={tournament}
                showQrCode/>;
        case 'during_game':
            return <DuringGameView
                tournamentMeta={tournamentMeta}
                tournament={tournament}
                matchFilters={filtersForDisplayState(displayState, this.state.beamerConfig)}
                matches={matches}
                timerState={timerState}/>;
        case 'timer_only':
            return <TimerOnlyView
                timerState={timerState}
                showReason={showTimerReasonForBeamerConfig(this.state.beamerConfig)}
            />;
        case 'between_games':
            return <BetweenGamesView
                tournamentMeta={tournamentMeta}
                matches={this.state.loadedMatches ? matches : null}
                timerState={timerState}/>;
        case 'next_matches':
            return <NextMatchesView
                matches={this.state.loadedMatches ? matches : null}
                timerState={timerState}/>;
        case 'final':
            return <FinalView
                tournamentMeta={tournamentMeta}
                matches={this.state.loadedMatches ? matches : null}
                timerState={timerState}
                showThirdPlace={(this.state.beamerConfig || {}).show_third_place !== false}/>;
        case 'static_image':
            return <div className="fullscreen-static-image">
                <img
                    src={beamerMediaImageForKey(
                        (this.state.beamerConfig || {})[STATIC_IMAGE_KEY_CONFIG_KEY]
                    ).src}
                    alt=""
                    data-testid="beamer-static-image"
                />
                <style jsx>{`
                    .fullscreen-static-image {
                        align-items: center;
                        background: #07121f;
                        display: flex;
                        height: 100vh;
                        justify-content: center;
                        width: 100vw;
                    }

                    .fullscreen-static-image img {
                        max-height: 100vh;
                        max-width: 100vw;
                        object-fit: contain;
                    }
                `}</style>
            </div>;
        case 'werbung':
            return <WerbungView
                images={selectedWerbungImages(this.state.beamerConfig || {})}
                rotationMs={werbungRotationMs(this.state.beamerConfig || {})}
                timerState={timerState}
            />;
        case 'matches_all':
        case 'matches_in_progress':
        case 'matches_upcoming':
        case 'matches_not_started':
        case 'matches_finished':
        default:
            return <MatchesView
                tournamentMeta={tournamentMeta}
                matches={this.state.loadedMatches ? matches : null}
                timerState={timerState}
                filterLabel={DISPLAY_STATE_LABELS[displayState]}
            />;
        }
    }

    render() {
        const {tournamentMeta, loadedMeta, metaStatus} = this.state;

        if (!loadedMeta) {
            return (<div>
                <Head>
                    <title>Vollbild-Ansicht: turnie.re</title>
                </Head>
                <Container className="p-5 text-center text-secondary">
                    <Spinner size="sm"/>
                    <span className="ml-3">lade Vollbild-Ansicht</span>
                </Container>
            </div>);
        }

        if (metaStatus === 200) {
            return (<div>
                <Head>
                    <title>{`${tournamentMeta.name}: turnie.re`}</title>
                </Head>
                <BeamerTimerEffects
                    timerState={this.state.timerState}
                    soundEffectCommand={(this.state.beamerConfig || {}).sound_effect_command}
                />
                {this.renderView()}
            </div>);
        }

        return <ErrorPageComponent statusCode={metaStatus}/>;
    }
}

export default Main;
