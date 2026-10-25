# turniere-frontend Agent Notes

Next.js 12 / React 18 frontend. Served by a custom Express server (`server.js`).
Package manager is **yarn**. The build tool is **next**.

## Default Workflow

Use `tasks.py` and prefer `inv ...` for local setup and startup.

```sh
inv setup
inv start --api-url=http://127.0.0.1:3000
```

Assume Node and Yarn are already installed locally.

What the invoke tasks do:

- `inv setup` runs `yarn install`
- `inv check-backend --api-url=...` waits for backend `/healthz`
- `inv start --api-url=...` optionally installs dependencies, waits for backend health, and starts the Express/Next dev server

Equivalent lower-level commands still work:

```sh
yarn install
TURNIERE_API_URL=http://127.0.0.1:3000 yarn dev
yarn build
yarn start
```

No dedicate test runner exists today (`"test"` script just exits 1).
Lint is configured via ESLint (`.eslintrc.json`).

## Git Workflow

Never amend commits. Always create small follow-up commits instead, so history
stays easy to review.

## Key Configuration

The only runtime env var consumed by the frontend is:

```
TURNIERE_API_URL   # base URL of the backend API, e.g. https://api.turnie.re
HOST               # optional bind host for the custom Express server
PORT               # optional bind port for the custom Express server
```

This is set at container start time, not baked into the image at build time.
The custom Express server in `server.js` reads and injects it.

For local development, the invoke task defaults are:

- backend: `http://127.0.0.1:3000`
- frontend bind host: `0.0.0.0`
- frontend bind port: `3001`

## Page / Route Map

Pages live in `pages/`. URL slugs are handled by the custom Express server, not
Next.js file-system routing directly.

| File | Public URL |
|---|---|
| `pages/index.js` | `/` |
| `pages/login.js` | `/login` |
| `pages/register.js` | `/register` |
| `pages/list.js` | `/list` |
| `pages/create.js` | `/create` |
| `pages/tournament.js` | `/t/:code` |
| `pages/tournament-mission-control.js` | `/t/:id/mission-control` |
| `pages/tournament-fullscreen.js` | `/t/:code/fullscreen` |
| `pages/tournament-fullscreen-groups.js` | `/t/:code/fullscreen-groups` |
| `pages/tournament-statistics.js` | `/t/:code/statistics` |
| `pages/profile.js` | `/profile` |
| `pages/faq.js` and others | static pages |

The `fullscreen` and `fullscreen-groups` pages are beamer/projector display
modes and poll the backend periodically. They must remain zero-interaction pages
that work without a logged-in session.

## Code Structure

```
js/
  api.js          # all Axios calls to the backend – single source of truth for HTTP shape
  constants.js    # API base URL helper and shared constants
  redux/          # Redux store, reducers, action creators
  components/     # shared React components
  utils/          # helpers
pages/             # Next.js page components
public/            # static assets
```

`js/api.js` is the authoritative mapping of backend API calls. When the backend
API surface changes, update `api.js` first and then fix affected pages or
components.

## State Management

Redux (redux-thunk) is used for global state such as the authenticated user and
current tournament data. Most async data fetching is done via thunk action
creators in `js/redux/`.

## Auth

The frontend uses `devise_token_auth` token-based auth. Tokens (`Access-Token`,
`Client`, `Uid`) are stored in `localStorage` and attached to every API request
via `js/api.js`.

## Deployment

Deployed as a Docker container. Image tag is read from `TURNIERE_FRONTEND_CONTAINER_VERSION`
in the infra compose file. The `TURNIERE_API_URL` env var is injected at runtime
by the infra `.env` file.

## What Matters During a Rewrite

- `js/api.js` encodes the full client-side API contract – treat it as a
  specification when consolidating repos.
- `tournament-fullscreen.js` and `tournament-fullscreen-groups.js` are the
  beamer pages used on the venue projector; their polling behavior and
  layout must be preserved.
- The Express server (`server.js`) handles custom routing that Next.js 12
  file-system routing does not cover natively; this will need explicit
  handling in any framework migration.

## GitHub CI migration

Active CI now lives in `.github/workflows`. Use the Invoke CI tasks documented in
the README for local reproduction. The GitLab YAML is a disabled compatibility
stub; new main builds publish to GHCR with automatic GitHub patch releases. Backend and
frontend Mission Control replace the archived match application.
