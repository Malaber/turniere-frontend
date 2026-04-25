import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';

import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {Footer} from '../js/components/Footer';
import {TurniereNavigation} from '../js/components/Navigation';
import {LoadingPage} from '../js/components/LoadingPage';
import {MissionControl} from '../js/components/MissionControl';
import {getTournament, convertTournamentSnapshot} from '../js/redux/tournamentApi';
import {connectToTimerSocket} from '../js/utils/beamerSocket';
import {normalizeTimerState} from '../js/utils/timerState';
import {connectToTournamentSocket} from '../js/utils/tournamentLiveSocket';

class MissionControlContent extends React.Component {
    render() {
        const {ownerUsername} = this.props.tournament;
        const {isSignedIn, username} = this.props;
        const isOwner = username === ownerUsername;

        return (
            <div className='container-fluid py-4 mission-control-page'>
                <MissionControl
                    tournament={this.props.tournament}
                    isSignedIn={isSignedIn}
                    isOwner={isOwner}
                    defaultOpen={true}
                    onTournamentChange={this.props.onTournamentChange}
                />
            </div>
        );
    }
}

function mapState(state) {
    const {isSignedIn, username} = state.userinfo;
    return {isSignedIn, username};
}

const ConnectedMissionControlContent = connect(mapState)(MissionControlContent);

class MissionControlPage extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            tournament: null,
            loaded: false
        };

        this.reloadTournament = this.reloadTournament.bind(this);
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.onTimerMessage = this.onTimerMessage.bind(this);
        this.onTournamentMessage = this.onTournamentMessage.bind(this);
    }

    componentDidMount() {
        this.reloadTournament();
    }

    componentWillUnmount() {
        if (this.timerSocket) {
            this.timerSocket.disconnect();
        }
        if (this.tournamentSocket) {
            this.tournamentSocket.disconnect();
        }
    }

    reloadTournament() {
        getTournament(this.props.query.id, this.onTournamentRequestSuccess, this.onTournamentRequestError);
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        this.setState({status: requestStatus, tournament: tournament, loaded: true});

        if (!this.timerSocket && tournament.id) {
            this.timerSocket = connectToTimerSocket({
                tournamentId: tournament.id,
                onMessage: this.onTimerMessage
            });
        }

        if (!this.tournamentSocket && tournament.id) {
            this.tournamentSocket = connectToTournamentSocket({
                tournamentId: tournament.id,
                onMessage: this.onTournamentMessage
            });
        }
    }

    onTournamentRequestError(error) {
        if (error.response) {
            this.setState({status: error.response.status, loaded: true});
        } else {
            this.setState({status: -1, loaded: true});
        }
    }

    onTimerMessage(message) {
        if (message.type && message.type !== 'timer.updated') {
            return;
        }

        this.setState(prev => {
            if (!prev.tournament) {
                return null;
            }

            return {
                tournament: Object.assign({}, prev.tournament, {
                    timerState: normalizeTimerState(message)
                })
            };
        });
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

            return {
                status: 200,
                tournament: convertTournamentSnapshot(message.tournament, cachedMetadata),
                loaded: true
            };
        });
    }

    render() {
        const {status, tournament} = this.state;
        const tournamentName = tournament === null ? 'Turnier' : tournament.name;

        if (status === 200) {
            return (
                <div>
                    <Head>
                        <title>{tournamentName}: Mission Control</title>
                    </Head>
                    <TurniereNavigation tournament={tournament} />
                    <ConnectedMissionControlContent
                        tournament={tournament}
                        onTournamentChange={this.reloadTournament}
                    />
                    <Footer />
                </div>
            );
        }

        if (!this.state.loaded) {
            return <LoadingPage title='turnie.re' text='Mission Control wird geladen...' />;
        }

        return <ErrorPageComponent statusCode={status} />;
    }
}

export default MissionControlPage;
