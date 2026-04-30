export const actionTypesTournamentinfo = {
    'REQUEST_TOURNAMENT': 'REQUEST_TOURNAMENT',
    'REQUEST_TOURNAMENT_SUCCESS': 'REQUEST_TOURNAMENT_SUCCESS',

    'CREATE_TOURNAMENT': 'CREATE_TOURNAMENT',

    'MODIFY_TOURNAMENT': 'MODIFY_TOURNAMENT',
    'MODIFY_TOURNAMENT_SUCCESS': 'MODIFY_TOURNAMENT_SUCCESS',
    'MODIFY_TOURNAMENT_ERROR': 'MODIFY_TOURNAMENT_ERROR',

    'START_MATCH': 'START_MATCH',
    'STOP_MATCH': 'STOP_MATCH',
    'SUBMIT_MATCH_SCORES': 'SUBMIT_MATCH_SCORES',
    'END_MATCH': 'END_MATCH',
    'SWAP_MATCH_POSITIONS': 'SWAP_MATCH_POSITIONS',
    'CREATE_DECIDER_MATCH': 'CREATE_DECIDER_MATCH',
    'FINISH_GROUP_STAGE': 'FINISH_GROUP_STAGE',
    'SET_TOURNAMENT_TIMER': 'SET_TOURNAMENT_TIMER',

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
    readOnlyMode: false,
    syncTargetUrl: '',
    syncAuthToken: '',
    syncLastPushedAt: null,
    syncLastPushError: '',
    stages: [],
    teams: [],
    timerState: null
    // date: null
};
