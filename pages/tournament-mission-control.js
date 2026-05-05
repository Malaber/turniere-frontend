import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';

import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {Footer} from '../js/components/Footer';
import {TurniereNavigation} from '../js/components/Navigation';
import {LoadingPage} from '../js/components/LoadingPage';
import {MissionControl} from '../js/components/MissionControl';
import {
    convertTeamActionListsSnapshot,
    convertTournamentSnapshot,
    createTeamActionList as createTeamActionListRequest,
    getTournament,
    updateTeamActionItem,
    updateTeamActionItemByKeyAndTeam
} from '../js/redux/tournamentApi';
import {connectToTimerSocket} from '../js/utils/beamerSocket';
import {connectToTeamActionListsSocket} from '../js/utils/teamActionListsSocket';
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
                    onSetTeamActionItemState={this.props.onSetTeamActionItemState}
                    onCreateTeamActionList={this.props.onCreateTeamActionList}
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
        this.ensureTeamActionListsSocketConnection = this.ensureTeamActionListsSocketConnection.bind(this);
        this.replaceTeamActionListsFromSnapshot = this.replaceTeamActionListsFromSnapshot.bind(this);
        this.setTeamActionItemState = this.setTeamActionItemState.bind(this);
        this.setTeamActionItemStateByResponse = this.setTeamActionItemStateByResponse.bind(this);
        this.createTeamActionList = this.createTeamActionList.bind(this);
        this.onTimerMessage = this.onTimerMessage.bind(this);
        this.onTournamentMessage = this.onTournamentMessage.bind(this);
    }

    componentDidMount() {
        this.reloadTournament();
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
        if (this.teamActionListsSocketConnection) {
            this.teamActionListsSocketConnection.disconnect();
        }
        this.teamActionListsSocketConnection = null;
        this.teamActionListsSocketTournamentId = null;
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

        if (tournament.id) {
            this.ensureTeamActionListsSocketConnection(tournament.id);
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

    ensureTeamActionListsSocketConnection(tournamentId) {
        if (this.teamActionListsSocketTournamentId === tournamentId && this.teamActionListsSocketConnection) {
            return;
        }

        if (this.teamActionListsSocketConnection) {
            this.teamActionListsSocketConnection.disconnect();
        }

        this.teamActionListsSocketTournamentId = tournamentId;
        this.teamActionListsSocketConnection = connectToTeamActionListsSocket({
            tournamentId: tournamentId,
            onMessage: payload => {
                if (!payload || payload.type !== 'team_action_lists.updated') {
                    return;
                }
                if (payload.tournament_id !== tournamentId) {
                    return;
                }
                this.replaceTeamActionListsFromSnapshot(payload.team_action_lists);
            }
        });
    }

    replaceTeamActionListsFromSnapshot(teamActionListsSnapshot) {
        const teamActionLists = convertTeamActionListsSnapshot(teamActionListsSnapshot);
        this.setState(prevState => {
            if (!prevState.tournament) {
                return null;
            }
            return {
                tournament: Object.assign({}, prevState.tournament, {
                    teamActionLists: teamActionLists
                })
            };
        });
    }

    setTeamActionItemStateByResponse(updatedTeamActionItem, listKey, teamId) {
        this.setState(prevState => {
            if (!prevState.tournament || !Array.isArray(prevState.tournament.teamActionLists)) {
                return null;
            }

            let foundById = false;
            const nextLists = prevState.tournament.teamActionLists.map(list => ({
                ...list,
                teamActionItems: list.teamActionItems.map(item => {
                    if (item.id === updatedTeamActionItem.id) {
                        foundById = true;
                        return updatedTeamActionItem;
                    }
                    return item;
                })
            }));

            if (!foundById) {
                const fallbackLists = nextLists.map(list => ({
                    ...list,
                    teamActionItems: list.teamActionItems.map(item => {
                        const itemTeamId = item.team ? item.team.id : null;
                        if (list.key === listKey && itemTeamId === teamId) {
                            return updatedTeamActionItem;
                        }
                        return item;
                    })
                }));
                return {
                    tournament: Object.assign({}, prevState.tournament, {
                        teamActionLists: fallbackLists
                    })
                };
            }

            return {
                tournament: Object.assign({}, prevState.tournament, {
                    teamActionLists: nextLists
                })
            };
        });
    }

    setTeamActionItemState({tournamentId, listKey, teamId, itemId, completed, onSuccess, onError}) {
        let previousCompleted = false;
        let previousCompletedAt = null;

        this.setState(prevState => {
            if (!prevState.tournament || !Array.isArray(prevState.tournament.teamActionLists)) {
                return null;
            }
            const nextLists = prevState.tournament.teamActionLists.map(list => ({
                ...list,
                teamActionItems: list.teamActionItems.map(item => {
                    const itemTeamId = item.team ? item.team.id : null;
                    if (list.key === listKey && itemTeamId === teamId) {
                        previousCompleted = item.completed === true;
                        previousCompletedAt = item.completedAt;
                        return {
                            ...item,
                            completed: completed,
                            completedAt: completed ? item.completedAt : null
                        };
                    }
                    return item;
                })
            }));
            return {
                tournament: Object.assign({}, prevState.tournament, {teamActionLists: nextLists})
            };
        });

        const onPatchSuccess = (status, updatedTeamActionItem) => {
            this.setTeamActionItemStateByResponse(updatedTeamActionItem, listKey, teamId);
            onSuccess(status, updatedTeamActionItem);
        };

        const onPatchError = error => {
            const status = error && error.response ? error.response.status : -1;
            this.setState(prevState => {
                if (!prevState.tournament || !Array.isArray(prevState.tournament.teamActionLists)) {
                    return null;
                }
                const rolledBackLists = prevState.tournament.teamActionLists.map(list => ({
                    ...list,
                    teamActionItems: list.teamActionItems.map(item => {
                        const itemTeamId = item.team ? item.team.id : null;
                        if (list.key === listKey && itemTeamId === teamId) {
                            return {
                                ...item,
                                completed: previousCompleted,
                                completedAt: previousCompletedAt
                            };
                        }
                        return item;
                    })
                }));
                return {
                    tournament: Object.assign({}, prevState.tournament, {teamActionLists: rolledBackLists})
                };
            });
            onError(status, error);
        };

        if (itemId) {
            updateTeamActionItem(itemId, completed, onPatchSuccess, onPatchError);
            return;
        }

        if (!teamId) {
            onPatchError(null);
            return;
        }

        updateTeamActionItemByKeyAndTeam(tournamentId, listKey, teamId, completed, onPatchSuccess, onPatchError);
    }

    createTeamActionList({tournamentId, payload, onSuccess, onError}) {
        createTeamActionListRequest(tournamentId, payload, (status, createdTeamActionList) => {
            this.setState(prevState => {
                if (!prevState.tournament || !Array.isArray(prevState.tournament.teamActionLists)) {
                    return null;
                }
                const withoutExisting = prevState.tournament.teamActionLists
                    .filter(list => list.id !== createdTeamActionList.id);
                return {
                    tournament: Object.assign({}, prevState.tournament, {
                        teamActionLists: [...withoutExisting, createdTeamActionList]
                    })
                };
            });
            onSuccess(status, createdTeamActionList);
        }, error => {
            const status = error && error.response ? error.response.status : -1;
            onError(status, error);
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
                syncLastPushError: prev.tournament.syncLastPushError,
                location: prev.tournament.location,
                startsAt: prev.tournament.startsAt,
                endsAt: prev.tournament.endsAt,
                websiteUrl: prev.tournament.websiteUrl
            } : null;
            const tournament = convertTournamentSnapshot(message.tournament, cachedMetadata);
            if (!Array.isArray(message.tournament.team_action_lists) && prev.tournament) {
                tournament.teamActionLists = prev.tournament.teamActionLists;
            }

            return {
                status: 200,
                tournament: tournament,
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
                        onSetTeamActionItemState={this.setTeamActionItemState}
                        onCreateTeamActionList={this.createTeamActionList}
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
