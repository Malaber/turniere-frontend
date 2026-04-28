export const actionTypesTournamentStatistics = {
    'REQUEST_TOURNAMENT_STATISTICS': 'REQUEST_TOURNAMENT_STATISTICS',
    'INT_REQUEST_TOURNAMENT_STATISTICS': 'INT_REQUEST_TOURNAMENT_STATISTICS',

    'REQUEST_TOURNAMENT_STATISTICS_SUCCESS': 'REQUEST_TOURNAMENT_STATISTICS_SUCCESS',

    'REHYDRATE': 'TOURNAMENTINFO_REHYDRATE',
    'CLEAR': 'TOURNAMENTINFO_CLEAR'
};

export const defaultStateTournamentStatistics = {
    code: '',
    description: '',
    id: -1,
    name: '',
    owner_username: '',
    isPublic: '',

    loaded: false,
    statistics_available: false,

    most_dominant_team: {},
    least_dominant_team: {},
    group_phase_performances: []
};


export function transformTournamentInfoToStatistics(data) {
    return {
        code: data.code,
        description: data.description,
        id: data.id,
        name: data.name,
        ownerUsername: data.owner_username,
        isPublic: data.public
    };
}

export function transformTournamentStatsToStatistics(data) {
    if (statisticsUnavailable(data)) {
        return {
            statistics_available: false,
            most_dominant_team: {},
            least_dominant_team: {},
            group_phase_performances: []
        };
    }

    const statistics = {
        statistics_available: true,
        most_dominant_team: {
            points_made: data.most_dominant_score.scored_points,
            points_received: data.most_dominant_score.received_points,
            team_name: data.most_dominant_score.team.name
        },
        least_dominant_team: {
            points_made: data.least_dominant_score.scored_points,
            points_received: data.least_dominant_score.received_points,
            team_name: data.least_dominant_score.team.name
        },
        group_phase_performances: []
    };

    for (let i = 0; i < data.group_scores.length; i++) {
        const score = data.group_scores[i];

        statistics.group_phase_performances[i] = {
            win_loss_differential: score.group_points,
            point_differential: score.scored_points - score.received_points,
            rank: i + 1,
            team_name: score.team.name
        };
    }

    return statistics;
}

function statisticsUnavailable(data) {
    return !data || Object.keys(data).length === 0 || data.most_dominant_score === null ||
        data.least_dominant_score === null || !Array.isArray(data.group_scores) || data.group_scores.length === 0;
}
