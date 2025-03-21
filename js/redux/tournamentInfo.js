export const actionTypesTournamentinfo = {
    'REQUEST_TOURNAMENT': 'REQUEST_TOURNAMENT',
    'REQUEST_TOURNAMENT_SUCCESS': 'REQUEST_TOURNAMENT_SUCCESS',

    'CREATE_TOURNAMENT': 'CREATE_TOURNAMENT',

    'MODIFY_TOURNAMENT': 'MODIFY_TOURNAMENT',
    'MODIFY_TOURNAMENT_SUCCESS': 'MODIFY_TOURNAMENT_SUCCESS',
    'MODIFY_TOURNAMENT_ERROR': 'MODIFY_TOURNAMENT_ERROR',

    'START_MATCH': 'START_MATCH',
    'SUBMIT_MATCH_SCORES': 'SUBMIT_MATCH_SCORES',
    'END_MATCH': 'END_MATCH',

    'REHYDRATE': 'TOURNAMENTINFO_REHYDRATE',
    'CLEAR': 'TOURNAMENTINFO_CLEAR'
};

export const defaultStateTournamentinfo = {
    code: '',
    description: '',
    id: -1,
    name: '',
    ownerUsername: '',
    isPublic: '',
    stages: [],
    teams: []
    // date: null
};
