import {connectActionCable} from './actionCableSocket';

export function connectToBeamerSocket({tournamentId, beamerName, onMessage}) {
    return connectActionCable({
        identifier: JSON.stringify({
            channel: 'TournamentBeamersChannel',
            tournament_id: tournamentId,
            beamer_name: beamerName
        }),
        onMessage
    });
}

export function connectToTimerSocket({tournamentId, onMessage}) {
    return connectActionCable({
        identifier: JSON.stringify({
            channel: 'TournamentTimersChannel',
            tournament_id: tournamentId
        }),
        onMessage
    });
}
