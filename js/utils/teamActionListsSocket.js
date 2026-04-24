import {connectActionCable} from './actionCableSocket';

export function connectToTeamActionListsSocket({tournamentId, onMessage}) {
    return connectActionCable({
        identifier: JSON.stringify({
            channel: 'TournamentTeamActionListsChannel',
            tournament_id: tournamentId
        }),
        onMessage
    });
}
