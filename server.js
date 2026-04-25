const express = require('express');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || (dev ? '3001' : '80'), 10);
const app = next({dev});
const handle = app.getRequestHandler();

app.prepare()
    .then(() => {
        const server = express();

        server.get('/t/:code', (req, res) => {
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
