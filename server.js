const express = require('express');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
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

        server.listen(dev ? 3000 : 80, err => {
            if (err) throw err;
        });
    })
    .catch(err => {
        console.log(err);
        process.exit(1);
    });
