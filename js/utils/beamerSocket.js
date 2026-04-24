import getConfig from 'next/config';

const {publicRuntimeConfig} = getConfig();

const ACTION_CABLE_PROTOCOL = 'actioncable-v1-json';

function websocketUrl() {
    const apiUrl = (publicRuntimeConfig.api_url || '').replace(/\/$/, '');
    if (!apiUrl) {
        throw new Error('TURNIERE_API_URL missing for beamer ActionCable connection');
    }

    const url = new URL(apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/cable';
    url.search = '';
    return url.toString();
}

export function connectToBeamerSocket({tournamentId, beamerName, onMessage}) {
    let closed = false;
    let socket = null;
    let reconnectTimeout = null;

    const identifier = JSON.stringify({
        channel: 'TournamentBeamersChannel',
        tournament_id: tournamentId,
        beamer_name: beamerName
    });

    function clearReconnectTimeout() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    }

    function scheduleReconnect() {
        if (closed || reconnectTimeout) {
            return;
        }

        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
        }, 1000);
    }

    function handleMessage(event) {
        let message = null;
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            return;
        }

        if (message.type === 'welcome') {
            socket.send(JSON.stringify({
                command: 'subscribe',
                identifier
            }));
            return;
        }

        if (
            message.type === 'ping' ||
            message.type === 'confirm_subscription' ||
            message.type === 'disconnect'
        ) {
            return;
        }

        if (message.identifier === identifier && message.message) {
            onMessage(message.message);
        }
    }

    function connect() {
        socket = new WebSocket(websocketUrl(), [ACTION_CABLE_PROTOCOL]);
        socket.addEventListener('message', handleMessage);
        socket.addEventListener('error', () => {
            if (socket && socket.readyState < WebSocket.CLOSING) {
                socket.close();
            }
        });
        socket.addEventListener('close', () => {
            if (!closed) {
                scheduleReconnect();
            }
        });
    }

    connect();

    return {
        disconnect() {
            closed = true;
            clearReconnectTimeout();
            if (socket && socket.readyState < WebSocket.CLOSING) {
                socket.close();
            }
        }
    };
}

export function connectToTimerSocket({tournamentId, onMessage}) {
    let closed = false;
    let socket = null;
    let reconnectTimeout = null;

    const identifier = JSON.stringify({
        channel: 'TournamentTimersChannel',
        tournament_id: tournamentId
    });

    function clearReconnectTimeout() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    }

    function scheduleReconnect() {
        if (closed || reconnectTimeout) {
            return;
        }

        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
        }, 1000);
    }

    function handleMessage(event) {
        let message = null;
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            return;
        }

        if (message.type === 'welcome') {
            socket.send(JSON.stringify({
                command: 'subscribe',
                identifier
            }));
            return;
        }

        if (
            message.type === 'ping' ||
            message.type === 'confirm_subscription' ||
            message.type === 'disconnect'
        ) {
            return;
        }

        if (message.identifier === identifier && message.message) {
            onMessage(message.message);
        }
    }

    function connect() {
        socket = new WebSocket(websocketUrl(), [ACTION_CABLE_PROTOCOL]);
        socket.addEventListener('message', handleMessage);
        socket.addEventListener('error', () => {
            if (socket && socket.readyState < WebSocket.CLOSING) {
                socket.close();
            }
        });
        socket.addEventListener('close', () => {
            if (!closed) {
                scheduleReconnect();
            }
        });
    }

    connect();

    return {
        disconnect() {
            closed = true;
            clearReconnectTimeout();
            if (socket && socket.readyState < WebSocket.CLOSING) {
                socket.close();
            }
        }
    };
}
