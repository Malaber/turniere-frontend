const express = require('express');
const http = require('http');
const https = require('https');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || (dev ? '3001' : '80'), 10);
const apiUrl = process.env.TURNIERE_API_URL || 'https://api.turnie.re';
const app = next({dev});
const handle = app.getRequestHandler();

function runtimeConfigScript() {
    const runtimeConfig = JSON.stringify({
        apiUrl
    }).replace(/</g, '\\u003c');
    return `window.__TURNIERE_RUNTIME_CONFIG__=${runtimeConfig};`;
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
    const tournament = await requestJson(`${apiUrl.replace(/\/$/, '')}/tournaments/${encodeURIComponent(code)}`);
    if (!tournament || !tournament.id) {
        return null;
    }
    if (String(tournament.id) === String(code) || String(tournament.code) === String(code)) {
        return tournament.id;
    }
    return null;
}

async function resolvePublicTournamentIdByCode(code) {
    const tournaments = await requestJson(`${apiUrl.replace(/\/$/, '')}/tournaments?type=public`);
    if (!Array.isArray(tournaments)) {
        return null;
    }
    const tournament = tournaments.find(item => String(item.code) === String(code));
    return tournament && tournament.id ? tournament.id : null;
}

app.prepare()
    .then(() => {
        const server = express();

        server.get('/turniere-runtime-config.js', (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.type('application/javascript');
            res.send(runtimeConfigScript());
        });

        server.get('/t/:code', async (req, res) => {
            try {
                const tournamentId = await resolvePublicTournamentIdByCode(req.params.code) ||
                    await resolveTournamentId(req.params.code);
                if (tournamentId && String(tournamentId) !== req.params.code) {
                    res.redirect(302, `/t/${tournamentId}`);
                    return;
                }
            } catch (error) {
                console.warn(`Could not resolve tournament code ${req.params.code}: ${error.message}`);
            }
            const actualPage = '/tournament';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/fullscreen', (req, res) => {
            const actualPage = '/tournament-fullscreen-v2';
            const queryParam = {
                code: req.params.code,
                beamer: req.query.beamer || 'default',
                display: req.query.display || null
            };
            app.render(req, res, actualPage, queryParam);
        });

        server.get(/^\/t\/(\d+)\/edit$/, (req, res) => {
            res.redirect(`/t/${req.params[0]}/mission-control`);
        });

        server.get(/^\/t\/(\d+)\/mission-control$/, (req, res) => {
            const actualPage = '/tournament-mission-control';
            const queryParam = {id: req.params[0]};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/statistics', (req, res) => {
            const actualPage = '/tournament-statistics';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/checklists', async (req, res) => {
            try {
                const tournamentId = await resolvePublicTournamentIdByCode(req.params.code) ||
                    await resolveTournamentId(req.params.code);
                if (tournamentId) {
                    res.redirect(302, `/t/${tournamentId}/mission-control#checklists`);
                    return;
                }
            } catch (error) {
                console.warn(`Could not resolve tournament checklist URL ${req.params.code}: ${error.message}`);
            }
            res.redirect(302, `/t/${req.params.code}/mission-control#checklists`);
        });

        server.use((req, res) => {
            return handle(req, res);
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
