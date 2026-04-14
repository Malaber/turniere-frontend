import {io} from 'socket.io-client';
import getConfig from 'next/config';

const {publicRuntimeConfig} = getConfig();

export function connectToBeamerSocket(beamerName, onStateChange) {
    const matchUrl = publicRuntimeConfig.match_url;
    const socket = io(matchUrl, {
        transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
        socket.emit('join_beamer', {beamer_name: beamerName});
    });

    socket.on('beamer_state_changed', (data) => {
        if (data.beamer_name === beamerName) {
            onStateChange(data.display_state);
        }
    });

    return socket;
}
