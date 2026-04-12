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
            const actualPage = '/tournament-fullscreen';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/fullscreen-groups', (req, res) => {
            const actualPage = '/tournament-fullscreen-groups';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/edit', (req, res) => {
            const actualPage = '/tournament-edit';
            const queryParam = {code: req.params.code};
            app.render(req, res, actualPage, queryParam);
        });

        server.get('/t/:code/statistics', (req, res) => {
            const actualPage = '/tournament-statistics';
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
