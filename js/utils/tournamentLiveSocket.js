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

export function connectToTournamentMatchesSocket({tournamentId, state, onMessage}) {
    const identifier = {
        channel: 'TournamentMatchesChannel',
        tournament_id: tournamentId
    };

    if (state) {
        identifier.state = state;
    }

    return connectActionCable({
        identifier: JSON.stringify(identifier),
        onMessage
    });
}
