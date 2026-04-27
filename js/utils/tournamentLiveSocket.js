import {connectActionCable} from './actionCableSocket';

export function connectToTournamentSocket({tournamentId, onMessage}) {
    return connectActionCable({
        identifier: JSON.stringify({
            channel: 'TournamentChannel',
            tournament_id: tournamentId
        }),
        onMessage
    });
}

export function connectToTournamentMatchesSocket({tournamentId, state, filters, onMessage}) {
    const identifier = {
        channel: 'TournamentMatchesChannel',
        tournament_id: tournamentId
    };

    Object.entries(filters || (state ? {state} : {})).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            identifier[key] = value;
        }
    });

    if (state && !identifier.state) {
        identifier.state = state;
    }

    return connectActionCable({
        identifier: JSON.stringify(identifier),
        onMessage
    });
}
