import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {Alert, Badge, ButtonGroup, Spinner} from 'reactstrap';

import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {Footer} from '../js/components/Footer';
import {TurniereNavigation} from '../js/components/Navigation';
import {PlayoffStages} from '../js/components/PlayoffStages';
import GroupStage from '../js/components/GroupStage';
import {TournamentBigImage} from '../js/components/TournamentBigImage';
import {EditButton, TournamentStatusBar} from '../js/components/TournamentStatusBar';
import {LinkButton} from '../js/components/LinkButton';
import {LoadingPage} from '../js/components/LoadingPage';
import {getTournament, getTournamentMeta} from '../js/redux/tournamentApi';
import {FavoriteBar} from '../js/components/FavoriteBar';
import {ScrollToTopButton} from '../js/components/ScrollToTopButton';
import {connectToTimerSocket} from '../js/utils/beamerSocket';
import {normalizeTimerState} from '../js/utils/timerState';
import {connectToTournamentSocket} from '../js/utils/tournamentLiveSocket';
import {convertTournamentSnapshot} from '../js/redux/tournamentApi';
import {requestTournamentList} from '../js/api';

class PrivateTournamentPage extends React.Component {
    render() {
        const {ownerUsername, playoffStages = [], groupStage = null} = this.props.tournament;
        const {isSignedIn, username} = this.props;
        const isOwner = username === ownerUsername;
        const isReadOnly = this.props.tournament.readOnlyMode === true;
        const teams = Array.isArray(this.props.tournament.teams) ? this.props.tournament.teams : [];

        return (
            <div className='pb-5'>
                <TournamentBigImage
                    {...this.props.tournament}
                    isLoadingBasic={this.props.loadingBasicInfo}
                />
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
                {this.props.loadingTournament ?
                    <TournamentFavoritesLoading/> :
                    <FavoriteBar teams={teams} tournamentId={this.props.tournament.id}/>}
                <div className='stages'>
                    {this.props.loadErrorStatus ?
                        <TournamentLoadError statusCode={this.props.loadErrorStatus}/> :
                        (this.props.loadingTournament ?
                            <TournamentDetailsLoading/> :
                            <>
                                {groupStage != null &&
                                <div><GroupStage
                                    groups={groupStage.groups}
                                    stageId={groupStage.id}
                                    stageState={groupStage.state}
                                    isSignedIn={isSignedIn}
                                    isOwner={isOwner}
                                    readOnlyMode={isReadOnly}
                                    teams={teams}
                                    onTournamentChange={this.props.onTournamentChange}
                                /></div>}
                                <PlayoffStages playoffStages={playoffStages} isSignedIn={isSignedIn}
                                    isOwner={isOwner} readOnlyMode={isReadOnly}/>
                            </>)}
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
            <ChecklistsButton
                tournamentId={props.tournament.id}
                isOwner={props.isOwner}
                isSignedIn={props.isSignedIn}
            />
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
    if (!props.isOwner || !props.isSignedIn) {
        return null;
    }

    return (<LinkButton href={'/t/' + props.tournamentId + '/mission-control#checklists'}>
        Checklisten
    </LinkButton>);
}

function mapStateToTournamentPageProperties(state) {
    const {isSignedIn, username} = state.userinfo;
    return {isSignedIn, username};
}

const TournamentPage = connect(mapStateToTournamentPageProperties)(PrivateTournamentPage);

function TournamentFavoritesLoading() {
    return (
        <div className="favorites py-3" data-testid="tournament-favorites-loading">
            <div className="container text-secondary">
                <Spinner size="sm" className="me-2"/>
                Teams werden geladen...
            </div>
        </div>
    );
}

function TournamentDetailsLoading() {
    return (
        <div className="tournament-inline-loader py-5 text-center text-secondary"
            data-testid="tournament-details-loading">
            <Spinner className="mb-3"/>
            <div className="h4 custom-font">Spielplan wird geladen...</div>
        </div>
    );
}

function TournamentLoadError(props) {
    return (
        <div className="container py-4" data-testid="tournament-details-error">
            <Alert color="danger">
                Turnierdaten konnten nicht geladen werden. Status: {props.statusCode}
            </Alert>
        </div>
    );
}

class Main extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            tournament: null,
            tournamentMeta: null,
            loadedMeta: false,
            loadedFull: false,
            metaStatus: null,
            fullStatus: null,
            fullLoading: false
        };
        this.onTournamentMetaRequestSuccess = this.onTournamentMetaRequestSuccess.bind(this);
        this.onTournamentMetaRequestError = this.onTournamentMetaRequestError.bind(this);
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.loadTournamentMeta = this.loadTournamentMeta.bind(this);
        this.reloadTournament = this.reloadTournament.bind(this);
        this.connectTournamentStreams = this.connectTournamentStreams.bind(this);
        this.redirectCodeToId = this.redirectCodeToId.bind(this);
        this.redirectCodeFromTournamentLists = this.redirectCodeFromTournamentLists.bind(this);
        this.onTimerMessage = this.onTimerMessage.bind(this);
        this.onTournamentMessage = this.onTournamentMessage.bind(this);
    }

    componentDidMount() {
        if (this.shouldLazyLoadTournament()) {
            this.loadTournamentMeta();
        } else {
            this.reloadTournament();
        }
        this.pollInterval = setInterval(this.reloadTournament, 3000);
    }

    componentWillUnmount() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        if (this.timerSocket) {
            this.timerSocket.disconnect();
        }
        if (this.tournamentSocket) {
            this.tournamentSocket.disconnect();
        }
    }

    shouldLazyLoadTournament() {
        return isTournamentIdValue(this.props.query.code);
    }

    loadTournamentMeta() {
        this.setState({fullLoading: true});
        getTournamentMeta(
            this.props.query.code,
            this.onTournamentMetaRequestSuccess,
            this.onTournamentMetaRequestError
        );
    }

    reloadTournament() {
        if (!this.state.tournament) {
            this.setState({fullLoading: true});
        }
        getTournament(this.props.query.code, this.onTournamentRequestSuccess, this.onTournamentRequestError);
    }

    onTournamentMetaRequestSuccess(requestStatus, tournamentMeta) {
        this.setState({
            metaStatus: requestStatus,
            tournamentMeta: tournamentMeta,
            loadedMeta: true,
            fullLoading: true
        }, () => {
            this.redirectCodeToId(tournamentMeta);
            this.connectTournamentStreams(tournamentMeta);
            this.reloadTournament();
        });
    }

    onTournamentMetaRequestError(error) {
        if (error.response && error.response.status === 404) {
            this.redirectCodeFromTournamentLists(true);
            return;
        }

        const status = error.response ? error.response.status : -1;
        this.setState({
            metaStatus: status,
            loadedMeta: true,
            fullLoading: false
        });
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        this.setState({
            fullStatus: requestStatus,
            metaStatus: requestStatus,
            tournament: tournament,
            tournamentMeta: tournament,
            loadedMeta: true,
            loadedFull: true,
            fullLoading: false
        }, () => {
            this.redirectCodeToId(tournament);
            this.connectTournamentStreams(tournament);
        });
    }

    connectTournamentStreams(tournament) {
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
        if (String(this.props.query.code) !== String(tournament.id) &&
            String(this.props.query.code) !== String(tournament.code)) {
            this.redirectCodeFromTournamentLists(true);
            return;
        }
        if (String(this.props.query.code) === String(tournament.id)) {
            return;
        }
        window.location.replace('/t/' + tournament.id);
    }

    onTournamentRequestError(error) {
        if (error.response && error.response.status === 404) {
            this.redirectCodeFromTournamentLists(true);
            return;
        }
        const status = error.response ? error.response.status : -1;
        this.setState({
            fullStatus: status,
            loadedFull: true,
            fullLoading: false
        });
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
        const setNotFound = () => this.setState({
            metaStatus: 404,
            fullStatus: 404,
            loadedMeta: true,
            loadedFull: true,
            fullLoading: false
        });
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
            const tournamentTimerState = normalizeTimerState(message);
            if (!prev.tournament && !prev.tournamentMeta) {
                return null;
            }

            const nextState = {};
            if (prev.tournament) {
                nextState.tournament = Object.assign({}, prev.tournament, {
                    timerState: tournamentTimerState
                });
            }
            if (prev.tournamentMeta) {
                nextState.tournamentMeta = Object.assign({}, prev.tournamentMeta, {
                    timerState: tournamentTimerState
                });
            }
            return nextState;
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
            const previousTournament = prev.tournament || prev.tournamentMeta;
            const cachedMetadata = previousTournament ? {
                readOnlyMode: previousTournament.readOnlyMode,
                syncTargetUrl: previousTournament.syncTargetUrl,
                syncAuthToken: previousTournament.syncAuthToken,
                syncLastPushedAt: previousTournament.syncLastPushedAt,
                syncLastPushError: previousTournament.syncLastPushError,
                location: previousTournament.location,
                startsAt: previousTournament.startsAt,
                endsAt: previousTournament.endsAt,
                websiteUrl: previousTournament.websiteUrl
            } : null;
            const tournament = convertTournamentSnapshot(message.tournament, cachedMetadata);

            return {
                fullStatus: 200,
                metaStatus: 200,
                tournament: tournament,
                tournamentMeta: tournament,
                loadedMeta: true,
                loadedFull: true,
                fullLoading: false
            };
        });
    }

    render() {
        const lazyRoute = this.shouldLazyLoadTournament();
        const displayTournament = this.state.tournament ||
            this.state.tournamentMeta ||
            (lazyRoute && !this.state.loadedMeta ? createTournamentPlaceholder(this.props.query.code) : null);
        const tournamentName = displayTournament === null ? 'Turnier' : displayTournament.name;
        const loadErrorStatus = this.state.tournamentMeta &&
            this.state.loadedFull &&
            this.state.fullStatus !== 200 ?
            this.state.fullStatus :
            null;

        if (displayTournament && (
            this.state.fullStatus === 200 ||
            this.state.metaStatus === 200 ||
            (lazyRoute && !this.state.loadedMeta)
        )) {
            return (<div>
                <Head>
                    <title>{`${tournamentName}: turnie.re`}</title>
                </Head>
                <TurniereNavigation tournament={this.state.tournament || this.state.tournamentMeta} />
                <TournamentPage
                    tournament={displayTournament}
                    onTournamentChange={this.reloadTournament}
                    loadingBasicInfo={lazyRoute && !this.state.tournamentMeta && !this.state.tournament}
                    loadingTournament={!this.state.tournament && !loadErrorStatus}
                    loadErrorStatus={loadErrorStatus}
                />
                <Footer/>
            </div>);
        }

        if (!lazyRoute && !this.state.loadedFull) {
            return <LoadingPage title='turnie.re' text='Turnier wird geladen...'/>;
        }

        return <ErrorPageComponent statusCode={this.state.fullStatus || this.state.metaStatus || -1}/>;
    }
}

function isTournamentIdValue(value) {
    return /^[0-9]+$/.test(String(value || ''));
}

function createTournamentPlaceholder(tournamentId) {
    return {
        id: tournamentId,
        code: tournamentId,
        description: '',
        name: 'Turnier wird geladen...',
        location: '',
        startsAt: null,
        endsAt: null,
        websiteUrl: '',
        isPublic: null,
        readOnlyMode: false,
        ownerUsername: null,
        groupStage: null,
        playoffStages: [],
        teamActionLists: [],
        teams: [],
        timerState: null
    };
}

export default Main;
