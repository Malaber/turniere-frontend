import {getRequest, patchRequest, postRequest} from './backendApi';
import {getState} from '../api';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {mergeTournamentSyncMetadata} from '../utils/tournamentSyncMetadata';
import {normalizeTimerState, normalizeTournamentTimerState} from '../utils/timerState';

export function getTournament(code, successCallback, errorCallback) {
    getRequest(getState(), '/tournaments/' + code)
        .then(response => {
            successCallback(response.status, convertTournament(mergeTournamentSyncMetadata(response.data)));
        })
        .catch(errorCallback);
}

export function getGroup(groupId, successCallback, errorCallback) {
    getRequest(getState(), '/groups/' + groupId)
        .then(response => {
            successCallback(response.status, convertGroup(response.data));
        })
        .catch(errorCallback);
}

export function getStage(stageId, successCallback, errorCallback) {
    getRequest(getState(), '/stages/' + stageId)
        .then(response => {
            successCallback(response.status, convertPlayoffStage(response.data));
        })
        .catch(errorCallback);
}

export function getTournamentMeta(tournamentId, successCallback, errorCallback) {
    getRequest(getState(), '/tournaments/' + tournamentId + '?simple=true')
        .then(response => {
            successCallback(response.status, response.data);
        })
        .catch(errorCallback);
}

export function getTournamentMatches(tournamentId, successCallback, errorCallback, matchState = null) {
    let matchFilter = '';
    if (matchState) {
        matchFilter = '?state=' + matchState;
    }
    getRequest(getState(), '/tournaments/' + tournamentId + '/matches' + matchFilter)
        .then(response => {
            successCallback(
                response.status, response.data.sort(
                    (a, b) => a.position > b.position
                ).map(
                    match => convertMatch(match)
                )
            );
        })
        .catch(errorCallback);
}

export function getTournamentTimerState(tournamentId, successCallback, errorCallback) {
    getRequest(getState(), '/tournaments/' + tournamentId + '/timer')
        .then(response => {
            successCallback(response.status, normalizeTimerState(response.data));
        })
        .catch(errorCallback);
}

export function getBeamerByName(tournamentCode, beamerName, successCallback, errorCallback) {
    const encodedName = encodeURIComponent(beamerName || '');
    const path = '/tournaments/' + tournamentCode +
        '/beamers/by_name?name=' + encodedName;
    getRequest(getState(), path)
        .then(response => {
            successCallback(response.status, response.data);
        })
        .catch(errorCallback);
}

export function updateTeamActionItem(itemId, completed, successCallback, errorCallback) {
    patchRequest(getState(), '/team_action_items/' + itemId, {completed: completed})
        .then(response => {
            successCallback(response.status, convertTeamActionItem(response.data));
        })
        .catch(errorCallback);
}

export function updateTeamActionItemByKeyAndTeam(tournamentId, key, teamId, completed, successCallback, errorCallback) {
    patchRequest(
        getState(),
        '/tournaments/' + tournamentId + '/team_action_lists/' + encodeURIComponent(key) + '/teams/' + teamId,
        {completed: completed}
    ).then(response => {
        successCallback(response.status, convertTeamActionItem(response.data));
    }).catch(errorCallback);
}

export function createTeamActionList(tournamentId, payload, successCallback, errorCallback) {
    postRequest(getState(), '/tournaments/' + tournamentId + '/team_action_lists', payload)
        .then(response => {
            successCallback(response.status, convertTeamActionList(response.data));
        })
        .catch(errorCallback);
}

export function convertTeamActionListsSnapshot(apiTeamActionLists) {
    if (!Array.isArray(apiTeamActionLists)) {
        return [];
    }
    return apiTeamActionLists.map(apiList => convertTeamActionList(apiList));
}

function convertTournament(apiTournament) {
    let groupStage = null;
    const playoffStages = [];
    for (const apiStage of apiTournament.stages) {
        if (apiStage.groups.length > 0) {
            // group stage
            groupStage = {
                id: apiStage.id,
                state: apiStage.state,
                groups: apiStage.groups.map(group => convertGroup(group))
            };
        } else {
            // playoff stage
            playoffStages.push(convertPlayoffStage(apiStage));
        }
    }
    return {
        id: apiTournament.id,
        code: apiTournament.code,
        description: apiTournament.description,
        name: apiTournament.name,
        isPublic: apiTournament.public,
        readOnlyMode: apiTournament.read_only_mode === true,
        syncTargetUrl: apiTournament.sync_target_url || '',
        syncAuthToken: apiTournament.sync_auth_token || '',
        syncLastPushedAt: apiTournament.sync_last_pushed_at ? new Date(apiTournament.sync_last_pushed_at) : null,
        syncLastPushError: apiTournament.sync_last_push_error || '',
        ownerUsername: apiTournament.owner_username,
        groupStage: groupStage,
        playoffStages: playoffStages,
        teamActionLists: convertTeamActionListsSnapshot(apiTournament.team_action_lists),
        teams: apiTournament.teams,
        timerState: normalizeTournamentTimerState(apiTournament)
    };
}

function convertTeamActionList(apiList) {
    const teamActionItems = Array.isArray(apiList.team_action_items) ?
        apiList.team_action_items.map(apiItem => convertTeamActionItem(apiItem)) :
        [];
    return {
        id: apiList.id,
        name: apiList.name,
        key: apiList.key,
        actionName: apiList.action_name,
        source: apiList.source,
        teamActionItems: teamActionItems
    };
}

function convertTeamActionItem(apiItem) {
    return {
        id: apiItem.id,
        completed: apiItem.completed === true,
        completedAt: apiItem.completed_at ? new Date(apiItem.completed_at) : null,
        team: apiItem.team ? {
            id: apiItem.team.id,
            name: apiItem.team.name
        } : null
    };
}

function convertPlayoffStage(apiStage) {
    return {
        id: apiStage.id,
        level: apiStage.level,
        matches: apiStage.matches.sort(
            sortMatchesByPositionAscending()
        ).map(
            match => convertMatch(match, false)
        )
    };
}

function convertGroup(apiGroup) {
    return {
        id: apiGroup.id,
        number: apiGroup.number,
        scores: apiGroup.group_scores.sort((a, b) => {
            if (a.position > b.position) {
                return 1;
            } else if (a.position < b.position) {
                return -1;
            } else {
                return 0;
            }
        }),
        matches: apiGroup.matches.sort(sortMatchesByPositionAscending()).map(match => convertMatch(match, true))
    };
}

function convertMatch(apiMatch, allowUndecided) {
    const scoreMode = apiMatch.decider ? 'hidden_points' : 'points';
    const result = {
        id: apiMatch.id,
        state: apiMatch.state,
        decider: apiMatch.decider === true,
        allowUndecided: allowUndecided,
        scoreMode: scoreMode,
        winnerTeamId: apiMatch.winner === null ? null : apiMatch.winner.id,
        position: apiMatch.position + 1,
        group: apiMatch.group ? {id: apiMatch.group.id, number: apiMatch.group.number} : null
    };

    if (apiMatch.match_scores.length === 2) {
        result.team1 = {
            name: apiMatch.match_scores[0].team ? apiMatch.match_scores[0].team.name : 'TBD',
            id: apiMatch.match_scores[0].team ? apiMatch.match_scores[0].team.id : null,
            score: apiMatch.match_scores[0].points,
            hiddenScore: apiMatch.match_scores[0].hidden_points,
            scoreId: apiMatch.match_scores[0].id
        };
        result.team2 = {
            name: apiMatch.match_scores[1].team ? apiMatch.match_scores[1].team.name : 'TBD',
            id: apiMatch.match_scores[1].team ? apiMatch.match_scores[1].team.id : null,
            score: apiMatch.match_scores[1].points,
            hiddenScore: apiMatch.match_scores[1].hidden_points,
            scoreId: apiMatch.match_scores[1].id
        };
    } else if (apiMatch.match_scores.length === 1) {
        result.team1 = {
            name: apiMatch.match_scores[0].team.name,
            id: apiMatch.match_scores[0].team.id,
            score: apiMatch.match_scores[0].points,
            hiddenScore: apiMatch.match_scores[0].hidden_points,
            scoreId: apiMatch.match_scores[0].id
        };
        result.team2 = {
            name: 'TBD',
            id: null,
            score: 0,
            hiddenScore: 0
        };
    } else {
        result.team1 = {
            name: 'TBD',
            id: null,
            score: 0,
            hiddenScore: 0
        };
        result.team2 = {
            name: 'TBD',
            id: null,
            score: 0,
            hiddenScore: 0
        };
    }

    return result;
}
