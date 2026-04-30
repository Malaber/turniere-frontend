import {getApiUrl} from '../runtimeConfig';

const ACTION_CABLE_PROTOCOL = 'actioncable-v1-json';

function parseIdentifier(identifier) {
    try {
        return JSON.parse(identifier);
    } catch (error) {
        return {};
    }
}

function actionCableDebugState() {
    if (typeof window === 'undefined') {
        return null;
    }

    const existing = window.__turniereActionCable || {};
    if (!existing.subscriptions) {
        existing.subscriptions = {};
    }
    if (!existing.events) {
        existing.events = [];
    }
    window.__turniereActionCable = existing;
    return existing;
}

function recordActionCableEvent(type, identifier, extra = {}) {
    const state = actionCableDebugState();
    if (!state || !identifier) {
        return;
    }

    const parsedIdentifier = parseIdentifier(identifier);
    const event = Object.assign({
        type,
        identifier,
        parsedIdentifier,
        at: Date.now()
    }, extra);

    if (type === 'confirm_subscription') {
        state.subscriptions[identifier] = {
            identifier,
            parsedIdentifier,
            confirmed: true,
            confirmedAt: event.at
        };
    }
    if (type === 'disconnect' && state.subscriptions[identifier]) {
        state.subscriptions[identifier].confirmed = false;
        state.subscriptions[identifier].disconnectedAt = event.at;
    }

    state.events.push(event);
    if (state.events.length > 300) {
        state.events.splice(0, state.events.length - 300);
    }

    window.dispatchEvent(new CustomEvent('turniere:action-cable', {detail: event}));
}

function websocketUrl() {
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/cable`;
    }

    const apiUrl = getApiUrl().replace(/\/$/, '');
    if (!apiUrl) {
        throw new Error('TURNIERE_API_URL missing for ActionCable connection');
    }

    const url = new URL(apiUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/cable';
    url.search = '';
    return url.toString();
}

export function connectActionCable({identifier, onMessage}) {
    let closed = false;
    let socket = null;
    let reconnectTimeout = null;

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

        if (message.type === 'ping') {
            return;
        }

        if (message.type === 'confirm_subscription' || message.type === 'disconnect') {
            recordActionCableEvent(message.type, message.identifier);
            return;
        }

        if (message.identifier === identifier && message.message) {
            recordActionCableEvent('message', message.identifier, {
                messageType: message.message.type || null
            });
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
