const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const path = require('path');
const tls = require('tls');

const dev = process.env.NODE_ENV !== 'production';
const host = process.env.HOSTNAME || process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || (dev ? '3001' : '80'), 10);
const apiUrl = process.env.TURNIERE_API_URL || 'https://api.turnie.re';
const standaloneConfig = dev ? null : loadStandaloneConfig();
if (standaloneConfig) {
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(standaloneConfig);
}
const next = require('next');
const app = next({
    dev,
    hostname: host,
    port,
    conf: standaloneConfig || undefined
});
const handle = app.getRequestHandler();

function loadStandaloneConfig() {
    const requiredServerFilesPath = path.join(__dirname, '.next', 'required-server-files.json');
    try {
        const requiredServerFiles = JSON.parse(fs.readFileSync(requiredServerFilesPath, 'utf8'));
        return requiredServerFiles.config || null;
    } catch (error) {
        return null;
    }
}

function requestBaseUrl(req) {
    return `http://${req.headers.host || `${host}:${port}`}`;
}

function backendUrl(pathname, search = '') {
    const target = new URL(apiUrl);
    const basePath = target.pathname.replace(/\/$/, '');
    target.pathname = `${basePath}${pathname}`;
    target.search = search;
    return target;
}

function backendBaseUrl() {
    return apiUrl.replace(/\/$/, '');
}

function runtimeConfigScript() {
    return 'window.__TURNIERE_RUNTIME_CONFIG__={};';
}

function requestJson(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const request = client.get(parsedUrl, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
            });
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        });
        request.on('error', reject);
        request.setTimeout(5000, () => {
            request.destroy(new Error('Backend lookup timed out'));
        });
    });
}

async function resolveTournamentId(code) {
    const tournamentUrl = backendUrl(`/tournaments/${encodeURIComponent(code)}`);
    const tournament = await requestJson(tournamentUrl.toString());
    if (!tournament || !tournament.id) {
        return null;
    }
    if (String(tournament.id) === String(code) || String(tournament.code) === String(code)) {
        return tournament.id;
    }
    return null;
}

async function resolvePublicTournamentIdByCode(code) {
    const tournamentsUrl = backendUrl('/tournaments', '?type=public');
    const tournaments = await requestJson(tournamentsUrl.toString());
    if (!Array.isArray(tournaments)) {
        return null;
    }
    const tournament = tournaments.find(item => String(item.code) === String(code));
    return tournament && tournament.id ? tournament.id : null;
}

function sendJson(res, statusCode, body) {
    res.statusCode = statusCode;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

function redirect(res, location) {
    res.statusCode = 302;
    res.setHeader('location', location);
    res.end();
}

function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function apiPathFromRequest(req) {
    const parsedRequestUrl = new URL(req.url, requestBaseUrl(req));
    const pathname = parsedRequestUrl.pathname === '/api' ?
        '/' :
        parsedRequestUrl.pathname.replace(/^\/api/, '');
    return backendUrl(pathname, parsedRequestUrl.search);
}

function proxyHeaders(req, target) {
    const headers = {
        ...req.headers,
        host: target.host
    };
    const forwardedFor = [req.headers['x-forwarded-for'], req.socket.remoteAddress]
        .filter(Boolean)
        .join(', ');
    if (forwardedFor) {
        headers['x-forwarded-for'] = forwardedFor;
    }
    if (req.headers.host) {
        headers['x-forwarded-host'] = req.headers.host;
    }
    headers['x-forwarded-proto'] = req.socket.encrypted ? 'https' : 'http';
    delete headers.connection;
    delete headers['proxy-connection'];
    delete headers.upgrade;
    return headers;
}

function proxyBackendRequest(req, res, target) {
    const client = target.protocol === 'https:' ? https : http;
    const proxyReq = client.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: req.method,
        path: `${target.pathname}${target.search}`,
        headers: proxyHeaders(req, target)
    }, proxyRes => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', error => {
        if (res.headersSent) {
            res.destroy(error);
            return;
        }
        sendJson(res, 502, {
            error: 'backend_unreachable',
            message: error.message
        });
    });
    req.on('aborted', () => proxyReq.destroy());
    req.pipe(proxyReq);
}

function proxyApiRequest(req, res) {
    proxyBackendRequest(req, res, apiPathFromRequest(req));
}

function rawHeaderLines(headers) {
    return Object.entries(headers).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
            return value.map(item => `${key}: ${item}`);
        }
        if (typeof value === 'undefined') {
            return [];
        }
        return [`${key}: ${value}`];
    });
}

function proxyWebSocketUpgrade(req, socket, head) {
    const parsedRequestUrl = new URL(req.url, requestBaseUrl(req));
    const target = backendUrl('/cable', parsedRequestUrl.search);
    const useTls = target.protocol === 'https:';
    const connectOptions = {
        host: target.hostname,
        port: Number(target.port || (useTls ? 443 : 80)),
        servername: target.hostname
    };
    const onConnect = () => {
        const headers = {
            ...req.headers,
            host: target.host,
            connection: 'Upgrade',
            upgrade: 'websocket'
        };
        const forwardedFor = [req.headers['x-forwarded-for'], req.socket.remoteAddress]
            .filter(Boolean)
            .join(', ');
        if (forwardedFor) {
            headers['x-forwarded-for'] = forwardedFor;
        }
        if (req.headers.host) {
            headers['x-forwarded-host'] = req.headers.host;
        }
        headers['x-forwarded-proto'] = req.socket.encrypted ? 'https' : 'http';
        delete headers['proxy-connection'];

        backendSocket.write([
            `${req.method} ${target.pathname}${target.search} HTTP/${req.httpVersion}`,
            ...rawHeaderLines(headers),
            '',
            ''
        ].join('\r\n'));
        if (head && head.length > 0) {
            backendSocket.write(head);
        }
        backendSocket.pipe(socket);
        socket.pipe(backendSocket);
    };
    const backendSocket = useTls ?
        tls.connect(connectOptions, onConnect) :
        net.connect(connectOptions, onConnect);

    backendSocket.on('error', () => {
        if (!socket.destroyed) {
            socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
            socket.destroy();
        }
    });
    socket.on('error', () => backendSocket.destroy());
}

function isApiRequest(pathname) {
    return pathname === '/api' || pathname.startsWith('/api/');
}

function isCableRequest(pathname) {
    return pathname === '/cable' || pathname === '/api/cable';
}

function sendWrongServiceSyncResponse(req, res, tournamentId) {
    const baseUrl = backendBaseUrl();
    const requestPath = new URL(req.url, requestBaseUrl(req)).pathname;
    req.resume();
    sendJson(res, 404, {
        error: 'wrong_service',
        message: `PATCH ${requestPath} reached turniere-frontend. Sync push endpoints live on turniere-backend.`,
        hint: 'Use the backend API URL configured in TURNIERE_API_URL for sync_target_url.',
        configuredBackendUrl: apiUrl,
        backendEndpoint: `${baseUrl}/tournaments/${encodeURIComponent(tournamentId)}/sync_state`
    });
}

async function routeRequest(req, res) {
    const parsedUrl = new URL(req.url, requestBaseUrl(req));
    const pathname = parsedUrl.pathname || '/';

    if (pathname === '/turniere-runtime-config.js') {
        res.setHeader('cache-control', 'no-store');
        res.setHeader('content-type', 'application/javascript; charset=utf-8');
        res.end(runtimeConfigScript());
        return;
    }

    if (isApiRequest(pathname)) {
        proxyApiRequest(req, res);
        return;
    }

    if (pathname === '/cable') {
        proxyBackendRequest(req, res, backendUrl('/cable', parsedUrl.search || ''));
        return;
    }

    const syncMatch = pathname.match(/^\/tournaments\/([^/]+)\/sync_state$/);
    if (req.method === 'PATCH' && syncMatch) {
        sendWrongServiceSyncResponse(req, res, safeDecode(syncMatch[1]));
        return;
    }

    const tournamentMatch = pathname.match(/^\/t\/([^/]+)$/);
    if (req.method === 'GET' && tournamentMatch) {
        const code = safeDecode(tournamentMatch[1]);
        if (/^\d+$/.test(code)) {
            await app.render(req, res, '/tournament', {code});
            return;
        }

        try {
            const tournamentId = await resolvePublicTournamentIdByCode(code) ||
                await resolveTournamentId(code);
            if (tournamentId && String(tournamentId) !== code) {
                redirect(res, `/t/${tournamentId}`);
                return;
            }
        } catch (error) {
            console.warn(`Could not resolve tournament code ${code}: ${error.message}`);
        }
        await app.render(req, res, '/tournament', {code});
        return;
    }

    const fullscreenMatch = pathname.match(/^\/t\/([^/]+)\/fullscreen$/);
    if (req.method === 'GET' && fullscreenMatch) {
        await app.render(req, res, '/tournament-fullscreen-v2', {
            code: safeDecode(fullscreenMatch[1]),
            beamer: parsedUrl.searchParams.get('beamer') || 'default',
            display: parsedUrl.searchParams.get('display') || null
        });
        return;
    }

    const finalBeamerMatch = pathname.match(/^\/t\/([^/]+)\/final$/);
    if (req.method === 'GET' && finalBeamerMatch) {
        await app.render(req, res, '/tournament-fullscreen-v2', {
            code: safeDecode(finalBeamerMatch[1]),
            beamer: parsedUrl.searchParams.get('beamer') || 'default',
            display: 'final'
        });
        return;
    }

    const editMatch = pathname.match(/^\/t\/(\d+)\/edit$/);
    if (req.method === 'GET' && editMatch) {
        redirect(res, `/t/${editMatch[1]}/mission-control`);
        return;
    }

    const missionControlMatch = pathname.match(/^\/t\/(\d+)\/mission-control$/);
    if (req.method === 'GET' && missionControlMatch) {
        await app.render(req, res, '/tournament-mission-control', {id: missionControlMatch[1]});
        return;
    }

    const accountProfileMatch = pathname.match(/^\/accounts\/(\d+)$/);
    if (req.method === 'GET' && accountProfileMatch) {
        await app.render(req, res, '/account-profile', {id: accountProfileMatch[1]});
        return;
    }

    const statisticsMatch = pathname.match(/^\/t\/([^/]+)\/statistics$/);
    if (req.method === 'GET' && statisticsMatch) {
        await app.render(req, res, '/tournament-statistics', {code: safeDecode(statisticsMatch[1])});
        return;
    }

    const checklistMatch = pathname.match(/^\/t\/([^/]+)\/checklists$/);
    if (req.method === 'GET' && checklistMatch) {
        const code = safeDecode(checklistMatch[1]);
        try {
            const tournamentId = await resolvePublicTournamentIdByCode(code) ||
                await resolveTournamentId(code);
            if (tournamentId) {
                redirect(res, `/t/${tournamentId}/mission-control#checklists`);
                return;
            }
        } catch (error) {
            console.warn(`Could not resolve tournament checklist URL ${code}: ${error.message}`);
        }
        redirect(res, `/t/${code}/mission-control#checklists`);
        return;
    }

    await handle(req, res);
}

app.prepare()
    .then(() => {
        const server = http.createServer((req, res) => {
            routeRequest(req, res).catch(error => {
                console.error(error);
                if (!res.headersSent) {
                    sendJson(res, 500, {
                        error: 'frontend_server_error',
                        message: error.message
                    });
                } else {
                    res.destroy(error);
                }
            });
        });

        server.on('upgrade', (req, socket, head) => {
            const parsedUrl = new URL(req.url, requestBaseUrl(req));
            const pathname = parsedUrl.pathname || '/';
            if (!isCableRequest(pathname)) {
                socket.destroy();
                return;
            }
            proxyWebSocketUpgrade(req, socket, head);
        });

        server.listen(port, host, err => {
            if (err) throw err;
            console.log(`turniere-frontend listening on http://${host}:${port}`);
        });
    })
    .catch(err => {
        console.log(err);
        process.exit(1);
    });
