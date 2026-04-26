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
    return tournament && tournament.id ? tournament.id : null;
}

app.prepare()
    .then(() => {
        const server = express();

        server.get('/t/:code', async (req, res) => {
            if (!/^\d+$/.test(req.params.code)) {
                try {
                    const tournamentId = await resolveTournamentId(req.params.code);
                    if (tournamentId) {
                        res.redirect(302, `/t/${tournamentId}`);
                        return;
                    }
                } catch (error) {
                    console.warn(`Could not resolve tournament code ${req.params.code}: ${error.message}`);
                }
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

        server.get('/t/:id(\\d+)/edit', (req, res) => {
            res.redirect(`/t/${req.params.id}/mission-control`);
        });

        server.get('/t/:id(\\d+)/mission-control', (req, res) => {
            const actualPage = '/tournament-mission-control';
            const queryParam = {id: req.params.id};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/statistics', (req, res) => {
            const actualPage = '/tournament-statistics';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/checklists', (req, res) => {
            const actualPage = '/tournament-checklists';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('*', (req, res) => {
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
