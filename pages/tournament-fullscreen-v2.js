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
    'static_image': 'Statisches Bild'
};

const DEFAULT_DISPLAY_STATE_FILTERS = {
    'matches_all': {},
    'matches_in_progress': {state: 'in_progress'},
    'matches_upcoming': {state: 'upcoming'},
    'matches_not_started': {state: 'not_started'},
    'matches_finished': {state: 'finished'},
    'during_game': {state: 'in_progress'},
    'between_games': {},
    'groups': {},
    'group_tables': {},
    'static_image': {}
};

const STATIC_IMAGE_URLS = {
    bpwstr_banner: '/static/images/bpwstr_banner.jpg',
    bpwstr_logo: '/static/images/bpwstr_logo.png',
    turniere_logo: '/static/images/logo-questionmark.png'
};

const GROUPS_QR_CODE_URL = '/static/images/logo-questionmark.png';
const GROUPS_LOGO_URL = '/static/images/bpwstr_logo.png';

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
        this.connectBeamerSocket = this.connectBeamerSocket.bind(this);
        this.connectTimerSocket = this.connectTimerSocket.bind(this);
        this.connectTournamentSocket = this.connectTournamentSocket.bind(this);
        this.connectMatchesSocket = this.connectMatchesSocket.bind(this);
        this.refreshBeamerConfig = this.refreshBeamerConfig.bind(this);
        this.onBeamerMessage = this.onBeamerMessage.bind(this);
        this.onTimerMessage = this.onTimerMessage.bind(this);
        this.onTournamentMessage = this.onTournamentMessage.bind(this);
        this.onMatchesMessage = this.onMatchesMessage.bind(this);
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
    }

    componentWillUnmount() {
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

    refreshBeamerConfig(code, beamerName) {
        getBeamerByName(code, beamerName,
            (status, beamer) => {
                this.setState({
                    displayState: beamer.display_state,
                    beamerConfig: beamer.config || null,
                    beamerName: beamer.name,
                    loadedMatches: false
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
        this.setState({
            displayState: beamer.display_state,
            beamerConfig: beamer.config || null,
            beamerName: beamer.name,
            loadedMatches: false
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

            return {tournament: convertTournamentSnapshot(message.tournament, cachedMetadata)};
        });
    }

    onMatchesMessage(message) {
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

        this.setState({
            matchesStatus: 200,
            matches: convertMatchesSnapshot(message.matches),
            loadedMatches: true
        });
    }

    updateMatches() {
        const code = this.props.query.code;
        const backendFilter = filtersForDisplayState(this.state.displayState, this.state.beamerConfig);
        getTournamentMatches(code,
            (status, matches) => {
                this.setState({matchesStatus: status, matches: matches, loadedMatches: true});
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
            (status, tournament) => this.setState({tournament}, () => {
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
                qrCodeUrl={GROUPS_QR_CODE_URL}
                logoUrl={GROUPS_LOGO_URL}/>;
        case 'during_game':
            return <DuringGameView
                tournamentMeta={tournamentMeta}
                matches={matches}
                timerState={timerState}/>;
        case 'between_games':
            return <BetweenGamesView
                tournamentMeta={tournamentMeta}
                matches={this.state.loadedMatches ? matches : null}
                timerState={timerState}/>;
        case 'static_image':
            return <div className="fullscreen-static-image">
                <img
                    src={STATIC_IMAGE_URLS[(this.state.beamerConfig || {}).image_key] || STATIC_IMAGE_URLS.bpwstr_logo}
                    alt=""
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
                    <title>{tournamentMeta.name}: turnie.re</title>
                </Head>
                <BeamerTimerEffects timerState={this.state.timerState}/>
                {this.renderView()}
            </div>);
        }

        return <ErrorPageComponent statusCode={metaStatus}/>;
    }
}

export default Main;
