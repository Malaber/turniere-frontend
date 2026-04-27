import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {Alert, Badge, ButtonGroup} from 'reactstrap';

import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {Footer} from '../js/components/Footer';
import {TurniereNavigation} from '../js/components/Navigation';
import {PlayoffStages} from '../js/components/PlayoffStages';
import GroupStage from '../js/components/GroupStage';
import {TournamentBigImage} from '../js/components/TournamentBigImage';
import {EditButton, TournamentStatusBar} from '../js/components/TournamentStatusBar';
import {LinkButton} from '../js/components/LinkButton';
import {LoadingPage} from '../js/components/LoadingPage';
import {getTournament} from '../js/redux/tournamentApi';
import {FavoriteBar} from '../js/components/FavoriteBar';
import {ScrollToTopButton} from '../js/components/ScrollToTopButton';
import {connectToTimerSocket} from '../js/utils/beamerSocket';
import {normalizeTimerState} from '../js/utils/timerState';
import {connectToTournamentSocket} from '../js/utils/tournamentLiveSocket';
import {convertTournamentSnapshot} from '../js/redux/tournamentApi';
import {requestTournamentList} from '../js/api';

class PrivateTournamentPage extends React.Component {
    render() {
        const {ownerUsername, playoffStages, groupStage} = this.props.tournament;
        const {isSignedIn, username} = this.props;
        const isOwner = username === ownerUsername;
        const isReadOnly = this.props.tournament.readOnlyMode === true;

        return (
            <div className='pb-5'>
                <TournamentBigImage {...this.props.tournament}/>
                <StatusBar tournament={this.props.tournament} isOwner={isOwner} isSignedIn={isSignedIn}/>
                {isReadOnly &&
                    <div className='container mt-3'>
                        <Alert color='warning' data-testid='readonly-tournament-banner'>
                            <div className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
                                <span>Follower-Modus aktiv. Live-Aktionen sind auf dieser Ansicht gesperrt.</span>
                                <Badge color='warning' pill>Read only</Badge>
                            </div>
                        </Alert>
                    </div>}
                <FavoriteBar teams={this.props.tournament.teams} tournamentId={this.props.tournament.id}/>
                <div className='stages'>
                    {groupStage != null &&
                    <div><GroupStage
                        groups={groupStage.groups}
                        stageId={groupStage.id}
                        stageState={groupStage.state}
                        isSignedIn={isSignedIn}
                        isOwner={isOwner}
                        readOnlyMode={isReadOnly}
                        teams={this.props.tournament.teams}
                        onTournamentChange={this.props.onTournamentChange}
                    /></div>}
                    <PlayoffStages playoffStages={playoffStages} isSignedIn={isSignedIn}
                        isOwner={isOwner} readOnlyMode={isReadOnly}/>
                </div>
                <ScrollToTopButton />
            </div>
        );
    }
}

function StatusBar(props) {
    return (<TournamentStatusBar>
        <ButtonGroup className='me-auto flex-wrap'>
            <EditButton tournamentId={props.tournament.id} isOwner={props.isOwner} isSignedIn={props.isSignedIn}/>
            <StatisticsButton tournamentId={props.tournament.id}/>
            <FullscreenButton tournamentId={props.tournament.id}/>
            <ChecklistsButton tournamentId={props.tournament.id}/>
        </ButtonGroup>
    </TournamentStatusBar>);
}

function StatisticsButton(props) {
    return (<LinkButton href={'/t/' + props.tournamentId + '/statistics'}>
        Statistiken
    </LinkButton>);
}

function FullscreenButton(props) {
    return (<LinkButton href={'/t/' + props.tournamentId + '/fullscreen'}>
        Vollbild-Ansicht
    </LinkButton>);
}

function ChecklistsButton(props) {
    return (<LinkButton href={'/t/' + props.tournamentId + '/checklists'}>
        Checklisten
    </LinkButton>);
}

function mapStateToTournamentPageProperties(state) {
    const {isSignedIn, username} = state.userinfo;
    return {isSignedIn, username};
}

const TournamentPage = connect(mapStateToTournamentPageProperties)(PrivateTournamentPage);

class Main extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            tournament: null,
            loaded: false
        };
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.reloadTournament = this.reloadTournament.bind(this);
        this.redirectCodeToId = this.redirectCodeToId.bind(this);
        this.redirectCodeFromTournamentLists = this.redirectCodeFromTournamentLists.bind(this);
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
        getTournament(this.props.query.code, this.onTournamentRequestSuccess, this.onTournamentRequestError);
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        this.setState({status: requestStatus, tournament: tournament, loaded: true});
        this.redirectCodeToId(tournament);
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

    redirectCodeToId(tournament) {
        if (!tournament || !tournament.id) {
            return;
        }
        if (String(this.props.query.code) === String(tournament.id)) {
            if (String(tournament.code) !== String(this.props.query.code)) {
                this.redirectCodeFromTournamentLists(false);
            }
            return;
        }
        window.location.replace('/t/' + tournament.id);
    }

    onTournamentRequestError(error) {
        if (error.response && error.response.status === 404) {
            this.redirectCodeFromTournamentLists(true);
            return;
        }
        if (error.response) {
            this.setState({status: error.response.status, loaded: true});
        } else {
            this.setState({status: -1, loaded: true});
        }
    }

    redirectCodeFromTournamentLists(showNotFound = true) {
        const redirectMatch = tournaments => {
            const tournament = tournaments.find(item => String(item.code) === String(this.props.query.code));
            if (tournament && tournament.id) {
                window.location.replace('/t/' + tournament.id);
                return true;
            }
            return false;
        };
        const setNotFound = () => this.setState({status: 404, loaded: true});
        const tryPublic = () => requestTournamentList('public', tournaments => {
            if (!redirectMatch(tournaments)) {
                if (showNotFound) {
                    setNotFound();
                }
            }
        }, () => {
            if (showNotFound) {
                setNotFound();
            }
        });

        requestTournamentList('private', tournaments => {
            if (!redirectMatch(tournaments)) {
                tryPublic();
            }
        }, tryPublic);
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
        const tournamentName = this.state.tournament === null ? 'Turnier' : this.state.tournament.name;

        const {status, tournament} = this.state;

        if (status === 200) {
            return (<div>
                <Head>
                    <title>{tournamentName}: turnie.re</title>
                </Head>
                <TurniereNavigation tournament={tournament} />
                <TournamentPage tournament={tournament} onTournamentChange={this.reloadTournament}/>
                <Footer/>
            </div>);
        } else {
            if (!this.state.loaded) {
                return <LoadingPage title='turnie.re' text='Turnier wird geladen...'/>;
            }
            return <ErrorPageComponent statusCode={status}/>;
        }
    }
}

export default Main;
