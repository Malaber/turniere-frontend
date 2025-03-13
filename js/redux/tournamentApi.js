import {getRequest} from './backendApi';
import {getState} from '../api';
import {sortMatchesByPositionAscending} from '../utils/sorting';

export function getTournament(code, successCallback, errorCallback) {
    getRequest(getState(), '/tournaments/' + code)
        .then(response => {
            successCallback(response.status, convertTournament(response.data));
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
            successCallback(response.status, response.data.sort((a, b) => a.position > b.position).map(match => convertMatch(match)));
        })
        .catch(errorCallback);
}

export function getTournamentTimerEnd(tournamentId, successCallback, errorCallback) {
    getRequest(getState(), '/tournaments/' + tournamentId + '/timer_end')
        .then(response => {
            let timerEndDate;
            if (response.data.timer_end === null) {
                timerEndDate = null;
            } else {
                timerEndDate = new Date(response.data.timer_end);
            }
            successCallback(response.status, timerEndDate);
        })
        .catch(errorCallback);
}

function convertTournament(apiTournament) {
    let groupStage = null;
    const playoffStages = [];
    for (const apiStage of apiTournament.stages) {
        if (apiStage.groups.length > 0) {
            // group stage
            groupStage = {groups: apiStage.groups.map(group => convertGroup(group))};
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
        ownerUsername: apiTournament.owner_username,
        groupStage: groupStage,
        playoffStages: playoffStages,
        timerEnd: apiTournament.timer_end ? new Date(apiTournament.timer_end) : null
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
        matches: apiGroup.matches.sort((a, b) => a.position > b.position).map(match => convertMatch(match, true))
    };
}

function convertMatch(apiMatch, allowUndecided) {
    const result = {
        id: apiMatch.id,
        state: apiMatch.state,
        allowUndecided: allowUndecided,
        winnerTeamId: apiMatch.winner === null ? null : apiMatch.winner.id,
        position: apiMatch.position + 1,
        group: apiMatch.group ? {id: apiMatch.group.id, number: apiMatch.group.number} : null
    };

    if (apiMatch.match_scores.length === 2) {
        result.team1 = {
            name: apiMatch.match_scores[0].team.name,
            id: apiMatch.match_scores[0].team.id,
            score: apiMatch.match_scores[0].points,
            scoreId: apiMatch.match_scores[0].id
        };
        result.team2 = {
            name: apiMatch.match_scores[1].team.name,
            id: apiMatch.match_scores[1].team.id,
            score: apiMatch.match_scores[1].points,
            scoreId: apiMatch.match_scores[1].id
        };
    } else if (apiMatch.match_scores.length === 1) {
        result.team1 = {
            name: apiMatch.match_scores[0].team.name,
            id: apiMatch.match_scores[0].team.id,
            score: apiMatch.match_scores[0].points,
            scoreId: apiMatch.match_scores[0].id
        };
        result.team2 = {
            name: 'TBD',
            id: null,
            score: 0
        };
    } else {
        result.team1 = {
            name: 'TBD',
            id: null,
            score: 0
        };
        result.team2 = {
            name: 'TBD',
            id: null,
            score: 0
        };
    }

    return result;
}
