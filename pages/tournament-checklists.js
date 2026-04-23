import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {Alert, Badge} from 'reactstrap';

import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {Footer} from '../js/components/Footer';
import {TurniereNavigation} from '../js/components/Navigation';
import {TournamentBigImage} from '../js/components/TournamentBigImage';
import {EditButton, TournamentStatusBar} from '../js/components/TournamentStatusBar';
import {LinkButton} from '../js/components/LinkButton';
import {LoadingPage} from '../js/components/LoadingPage';
import {
    convertTeamActionListsSnapshot,
    getTournament,
    updateTeamActionItem,
    updateTeamActionItemByKeyAndTeam
} from '../js/redux/tournamentApi';
import {connectToTeamActionListsSocket} from '../js/utils/teamActionListsSocket';

class ChecklistsPage extends React.Component {
    render() {
        const {ownerUsername} = this.props.tournament;
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
                <TeamActionListsSection
                    tournamentId={this.props.tournament.id}
                    teamActionLists={this.props.tournament.teamActionLists}
                    isOwner={isOwner}
                    isSignedIn={isSignedIn}
                    readOnlyMode={isReadOnly}
                    onSetTeamActionItemState={this.props.onSetTeamActionItemState}
                />
            </div>
        );
    }
}

class TeamActionListsSection extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pendingByItemKey: {},
            errorMessage: ''
        };
        this.onChange = this.onChange.bind(this);
    }

    onChange(list, item, event) {
        const nextCompleted = event.target.checked === true;
        const pendingKey = buildTeamActionItemPendingKey(list.key, item);

        this.setState(prevState => ({
            pendingByItemKey: Object.assign({}, prevState.pendingByItemKey, {[pendingKey]: true}),
            errorMessage: ''
        }));

        this.props.onSetTeamActionItemState({
            tournamentId: this.props.tournamentId,
            listKey: list.key,
            teamId: item.team ? item.team.id : null,
            itemId: item.id,
            completed: nextCompleted,
            onSuccess: () => {
                this.setState(prevState => ({
                    pendingByItemKey: Object.assign({}, prevState.pendingByItemKey, {[pendingKey]: false})
                }));
            },
            onError: status => {
                this.setState(prevState => ({
                    pendingByItemKey: Object.assign({}, prevState.pendingByItemKey, {[pendingKey]: false}),
                    errorMessage: buildTeamActionListsErrorMessage(status)
                }));
            }
        });
    }

    render() {
        const teamActionLists = Array.isArray(this.props.teamActionLists) ? this.props.teamActionLists : [];
        const canMutate = this.props.isSignedIn && this.props.isOwner && !this.props.readOnlyMode;

        return (<div className='container mt-3'>
            <div className='card'>
                <div className='card-body'>
                    <h5 className='mb-2'>Team Action Lists</h5>
                    <p className='text-muted mb-3'>
                        Team-Checklisten werden live synchronisiert. Änderung immer als Zielzustand senden.
                    </p>
                    {!canMutate &&
                        <Alert color='secondary' className='mb-3'>
                            Nur Turnier-Owner kann Status ändern.
                        </Alert>}
                    {this.state.errorMessage &&
                        <Alert color='danger' className='mb-3'>
                            {this.state.errorMessage}
                        </Alert>}
                    {teamActionLists.length === 0 &&
                        <Alert color='light' className='mb-0'>
                            Keine Checklisten verfügbar.
                        </Alert>}
                    {teamActionLists.map(list => (
                        <div key={list.id} className='mb-4'>
                            <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
                                <h6 className='mb-0'>{list.name}</h6>
                                <Badge color='info' pill>{list.key}</Badge>
                            </div>
                            <div className='text-muted small mb-2'>{list.actionName}</div>
                            {list.teamActionItems.map(item => {
                                const pendingKey = buildTeamActionItemPendingKey(list.key, item);
                                const disabled = !canMutate || this.state.pendingByItemKey[pendingKey] === true;
                                return (
                                    <div key={item.id || pendingKey} className='form-check mb-2'>
                                        <input
                                            id={'team-action-item-' + pendingKey}
                                            className='form-check-input'
                                            type='checkbox'
                                            checked={item.completed === true}
                                            disabled={disabled}
                                            onChange={event => this.onChange(list, item, event)}
                                        />
                                        <label className='form-check-label' htmlFor={'team-action-item-' + pendingKey}>
                                            {item.team ? item.team.name : 'Unbekanntes Team'}
                                            {item.completedAt &&
                                                <span className='text-muted ms-2'>
                                                    ({formatTeamActionCompletedAt(item.completedAt)})
                                                </span>}
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>);
    }
}

function buildTeamActionItemPendingKey(listKey, item) {
    const teamId = item.team ? item.team.id : 'unknown-team';
    return listKey + '-' + teamId;
}

function formatTeamActionCompletedAt(value) {
    if (!(value instanceof Date)) {
        return '';
    }
    return value.toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildTeamActionListsErrorMessage(status) {
    if (status === 401) {
        return 'Nicht eingeloggt.';
    }
    if (status === 403) {
        return 'Nur Turnier-Owner darf Team-Action-Items ändern.';
    }
    if (status === 404) {
        return 'Team-Action-Item nicht gefunden.';
    }
    if (status === 423) {
        return 'Follower-Modus: Änderungen gesperrt.';
    }
    return 'Änderung fehlgeschlagen. Bitte erneut versuchen.';
}

function StatusBar(props) {
    return (<TournamentStatusBar>
        <div className='d-flex flex-wrap gap-2 me-auto'>
            <EditButton tournamentId={props.tournament.id} isOwner={props.isOwner} isSignedIn={props.isSignedIn}/>
            <StatisticsButton tournamentId={props.tournament.id}/>
            <FullscreenButton tournamentId={props.tournament.id}/>
            <BackButton tournamentId={props.tournament.id}/>
        </div>
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

function BackButton(props) {
    return (<LinkButton href={'/t/' + props.tournamentId}>
        zurück zum Turnier
    </LinkButton>);
}

function mapStateToTournamentPageProperties(state) {
    const {isSignedIn, username} = state.userinfo;
    return {isSignedIn, username};
}

const TournamentChecklistsPage = connect(mapStateToTournamentPageProperties)(ChecklistsPage);

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
        this.teamActionListsSocketConnection = null;
        this.teamActionListsSocketTournamentId = null;
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.reloadTournament = this.reloadTournament.bind(this);
        this.ensureTeamActionListsSocketConnection = this.ensureTeamActionListsSocketConnection.bind(this);
        this.replaceTeamActionListsFromSnapshot = this.replaceTeamActionListsFromSnapshot.bind(this);
        this.setTeamActionItemState = this.setTeamActionItemState.bind(this);
        this.setTeamActionItemStateByResponse = this.setTeamActionItemStateByResponse.bind(this);
    }

    componentDidMount() {
        this.reloadTournament();
    }

    componentWillUnmount() {
        if (this.teamActionListsSocketConnection) {
            this.teamActionListsSocketConnection.disconnect();
        }
        this.teamActionListsSocketConnection = null;
        this.teamActionListsSocketTournamentId = null;
    }

    reloadTournament() {
        getTournament(this.props.query.code, this.onTournamentRequestSuccess, this.onTournamentRequestError);
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        this.setState({status: requestStatus, tournament: tournament, loaded: true}, () => {
            if (requestStatus === 200 && tournament && tournament.id) {
                this.ensureTeamActionListsSocketConnection(tournament.id);
            }
        });
    }

    onTournamentRequestError(error) {
        if (error.response) {
            this.setState({status: error.response.status, loaded: true});
        } else {
            this.setState({status: -1, loaded: true});
        }
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

    render() {
        const tournamentName = this.state.tournament === null ?
            'Checklisten' :
            this.state.tournament.name + ' - Checklisten';

        const {status, tournament} = this.state;

        if (status === 200) {
            return (<div>
                <Head>
                    <title>{tournamentName}: turnie.re</title>
                </Head>
                <TurniereNavigation tournament={tournament} />
                <TournamentChecklistsPage
                    tournament={tournament}
                    onSetTeamActionItemState={this.setTeamActionItemState}
                />
                <Footer/>
            </div>);
        } else {
            if (!this.state.loaded) {
                return <LoadingPage title='turnie.re' text='Checklisten werden geladen...'/>;
            }
            return <ErrorPageComponent statusCode={status}/>;
        }
    }
}

export default Main;
