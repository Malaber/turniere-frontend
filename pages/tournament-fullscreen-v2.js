import Head from 'next/head';
import React from 'react';
import {Container, Spinner} from 'reactstrap';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {
    getBeamerByName, getTournament, getTournamentMatches,
    getTournamentMeta, getTournamentTimerEnd
} from '../js/redux/tournamentApi';
import {connectToBeamerSocket} from '../js/utils/beamerSocket';
import {MatchesView} from '../js/components/fullscreen/MatchesView';
import {GroupsView} from '../js/components/fullscreen/GroupsView';
import {DuringGameView} from '../js/components/fullscreen/DuringGameView';


const DISPLAY_STATE_LABELS = {
    'matches_all': 'alle',
    'matches_in_progress': 'laufend',
    'matches_upcoming': 'kommend',
    'matches_not_started': 'bereit zum Starten',
    'matches_finished': 'beendet',
    'groups': 'Gruppenstand',
    'between_games': 'Zwischen den Spielen',
    'during_game': 'Während dem Spiel'
};

const DISPLAY_STATE_TO_BACKEND_FILTER = {
    'matches_all': null,
    'matches_in_progress': 'in_progress',
    'matches_upcoming': 'upcoming',
    'matches_not_started': 'not_started',
    'matches_finished': 'finished',
    'between_games': null,
    'during_game': 'in_progress'
};


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
            timerEnd: null,
            displayState: 'matches_all',
            beamerName: props.query.beamer || 'default',
            qrCodeUrl: null,
            logoUrl: null,
            loadedMeta: false,
            loadedMatches: false,
            metaStatus: null,
            matchesStatus: null,
            socket: null
        };

        this.updateMatches = this.updateMatches.bind(this);
        this.updateTimerEnd = this.updateTimerEnd.bind(this);
        this.updateTournament = this.updateTournament.bind(this);
        this.onDisplayStateChange = this.onDisplayStateChange.bind(this);
    }

    componentDidMount() {
        document.body.classList.add('hide-cursor');
        const code = this.props.query.code;
        const beamerName = this.state.beamerName;

        // Fetch beamer config
        getBeamerByName(code, beamerName,
            (status, beamer) => {
                this.setState({
                    displayState: beamer.display_state,
                    beamerName: beamer.name,
                    qrCodeUrl: beamer.qr_code_url,
                    logoUrl: beamer.logo_url
                }, () => {
                    this.updateMatches();
                });
            },
            () => {
                // Beamer not found — use defaults
                this.updateMatches();
            }
        );

        // Connect Socket.IO for live state changes
        const socket = connectToBeamerSocket(beamerName, this.onDisplayStateChange);
        this.setState({socket});

        // Fetch tournament metadata
        getTournamentMeta(code,
            (status, meta) => {
                this.setState({metaStatus: status, tournamentMeta: meta, loadedMeta: true});
            },
            error => {
                const s = error.response ? error.response.status : -1;
                this.setState({metaStatus: s, loadedMeta: true});
            }
        );

        // Fetch full tournament data (for groups view)
        this.updateTournament();

        // Start timer polling
        this.updateTimerEnd();

        // Set up polling intervals
        this.matchesIntervalId = setInterval(this.updateMatches, 10000);
        this.timerEndIntervalId = setInterval(this.updateTimerEnd, 10000);
        this.tournamentIntervalId = setInterval(this.updateTournament, 15000);
    }

    componentWillUnmount() {
        clearInterval(this.matchesIntervalId);
        clearInterval(this.timerEndIntervalId);
        clearInterval(this.tournamentIntervalId);
        if (this.state.socket) {
            this.state.socket.disconnect();
        }
    }

    onDisplayStateChange(newState) {
        this.setState({displayState: newState, loadedMatches: false}, () => {
            this.updateMatches();
        });
    }

    updateMatches() {
        const code = this.props.query.code;
        const backendFilter = DISPLAY_STATE_TO_BACKEND_FILTER[this.state.displayState];
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

    updateTimerEnd() {
        const code = this.props.query.code;
        getTournamentTimerEnd(code,
            (status, timerEnd) => this.setState({timerEnd}),
            error => console.error('Failed to fetch timer end:', error)
        );
    }

    updateTournament() {
        const code = this.props.query.code;
        getTournament(code,
            (status, tournament) => this.setState({tournament}),
            error => console.error('Failed to fetch tournament:', error)
        );
    }

    renderView() {
        const {displayState, tournamentMeta, matches, timerEnd, tournament} = this.state;
        const {qrCodeUrl, logoUrl} = this.state;

        switch (displayState) {
        case 'groups':
            return <GroupsView
                tournament={tournament}
                qrCodeUrl={qrCodeUrl}
                logoUrl={logoUrl}/>;
        case 'during_game':
            return <DuringGameView
                tournamentMeta={tournamentMeta}
                matches={matches}
                timerEnd={timerEnd}/>;
        case 'between_games':
        case 'matches_all':
        case 'matches_in_progress':
        case 'matches_upcoming':
        case 'matches_not_started':
        case 'matches_finished':
        default:
            return <MatchesView
                tournamentMeta={tournamentMeta}
                matches={this.state.loadedMatches ? matches : null}
                timerEnd={timerEnd}
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
                {this.renderView()}
            </div>);
        }

        return <ErrorPageComponent statusCode={metaStatus}/>;
    }
}

export default Main;
