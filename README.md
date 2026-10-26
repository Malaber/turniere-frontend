# turniere-frontend

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/300915a8466f4f059150b543e9a6d1b0)](https://app.codacy.com/app/JP1998/turniere-frontend?utm_source=github.com&utm_medium=referral&utm_content=turniere/turniere-frontend&utm_campaign=Badge_Grade_Dashboard)

## Quick install with Docker
[turnie.re - Quickstart](https://github.com/turniere/turniere-quickstart)

## Development Setup
### Prerequisites

You'll need Node.js and a package manager for Node.js (like npm or Yarn; We recommend Yarn) installed on your system in order to run this program. You can see how to install Node.js [here](https://nodejs.org/en/).

### Setup the Project

First of course you'll need to clone this repository:

```
$ git clone https://github.com/turniere/turniere-frontend.git
```

Afterwards you'll have to install the used libraries using following command:

```
$ yarn install
```

Then you can run the development server by executing:
```
$ TURNIERE_API_URL=https://api.turnie.re yarn run dev

$ TURNIERE_API_URL=http://localhost:3000 yarn run dev
```
The environment variable `TURNIERE_API_URL` must contain an valid url to a [turniere backend server](https://github.com/turniere/turniere-backend).
Fullscreen/beamer live updates also come from same backend via ActionCable at `/cable`.
No separate `TURNIERE_MATCH_URL` is required.
 
In production environment the server runs on port 80, otherwise on port 3001.

## Beamer Audio

Browsers can block audible autoplay until the page has user activation. For the
venue beamer, use a dedicated Chrome/Chromium profile with autoplay enabled:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$HOME/.turniere-beamer-chrome" \
  --autoplay-policy=no-user-gesture-required \
  --kiosk \
  "https://turnie.re/t/TOURNAMENT/fullscreen?beamer=default"
```

On load, the beamer page probes audible autoplay. If the browser blocks it, a
small warning button appears in the lower right corner before the timer sound is
needed. Clicking it grants activation for the current page load and retries any
pending sound at the current timer offset.

Mission Control also has a Beamer soundboard. Each beamer card can play or stop
sound effects on the matching fullscreen page. Timer sounds always win: if a
timer cue starts, any soundboard effect is stopped; while a timer sound is
active, soundboard play requests are ignored. The stop button only stops
soundboard effects.

To add another soundboard effect:

1. Add the audio file to `public/static/sounds/`.
2. Add a `key`, `label`, `src`, `volume`, and `durationSeconds` entry in
   `js/utils/soundEffects.js`.
3. If the sound should also be an automatic timer cue, add its timer threshold
   in `js/components/fullscreen/BeamerTimerEffects.js`.

## Production Setup: Build the Docker Container

```
$ docker build -t turniere-frontend .
```

The built container exposes port 80.

# Todo 

showMatches={playoffStages !== null} showmatches in GroupStage mittlerweile vmtl useless weil immer eingeklappt


### Reproduce CI E2E locally

`inv e2e-docker` runs the suite; use
`inv e2e-docker --spec=tests/16-footer-mobile.spec.ts` for the footer regression.
Install Docker Compose v2 and working Docker Buildx for the same multi-stage
builder as CI. The deprecated legacy builder also compiles unused intermediate
stages and is much slower.

Allocate at least 6 GB to the Docker VM for source builds and the E2E stack.
On Apple Silicon the pinned AMD64 backend runs under emulation; 2 GB Colima
defaults can kill native gem compilation (exit 137). Stop other containers before
resizing Colima (`colima stop`, then `colima start --memory 6`).

`ci/e2e-images.yml` is a JSON-compatible YAML lock containing a full backend source commit,
plus exact Postgres and Playwright image digests. The backend production image is built from that immutable GitHub commit. The Invoke task reads this file for Compose both locally and in GitHub Actions. Update those pins deliberately rather than
using a moving backend `latest` tag. Images target linux/amd64 like the runner.
`e2e/run-ci.sh` is the shared npm-install/test entrypoint; global setup bounds
readiness and login waits. The local task rebuilds the frontend from this checkout
and deletes its disposable database volume afterward. `--backend-version` is an
explicit override for backend integration work, not the reproducible default.

Footer links may wrap on small screens; regression checks enforce copyright
above all links, correct destinations, no clipping/overlap, and no horizontal
page overflow.

## GitHub Actions

`.github/workflows/ci.yml` replaces GitLab CI. PR checks run without credentials;
successful main runs publish GHCR images and automatic GitHub patch releases.
Publication does not deploy. See [release setup](ci/GITHUB_RELEASES.md).

See the [publishing permissions and package setup](ci/GITHUB_RELEASES.md).
Infra deployment remains a separate step in the local infra checkout. Backend/frontend are active; the legacy
match service is archived and superseded by Mission Control.

### Player score proposals (TUR-246)

Signed-in players on configured followers can propose the complete live score for
a team they belong to. Both teams' proposals and the official score are displayed
separately; matching proposals lock while the leader polls and republishes the
canonical score. Players cannot finish matches or advance stages. Mission Control
history displays the submitted and previous canonical values.

Deploy the companion backend change (including migrations) first. The frontend
uses `player_score_proposals_enabled`, a public capability flag, and the existing
sign-in flow. Trusted follower team memberships must already be provisioned;
account enrollment and membership synchronization are separate work.

New UI text lives in `js/locales/scoreProposals.js` (English/German). Browser
coverage can run against the existing pinned backend image using API fixtures:

```sh
inv e2e-test --frontend-url=http://127.0.0.1:3001 --backend-url=http://127.0.0.1:3000 --spec=20-player-score-proposals.spec.ts
```

Backend request/concurrency tests verify actual authorization, persistence and
leader application; browser tests verify pending/locked/official presentation,
participant-only controls and request failure feedback.

### Native browser with Docker backend (Apple Silicon)

Emulated AMD64 Chromium may exit with SIGTRAP on ARM Docker hosts. Keep CI's
native AMD64 container path unchanged; locally use:

```sh
inv setup
inv e2e-install
# If native Next.js bindings are missing despite an up-to-date install:
# inv setup --force
inv e2e-docker --host-browser
# Focused repeat:
inv e2e-docker --host-browser --spec=tests/20-player-score-proposals.spec.ts
```

This builds the same pinned backend production image and frontend production
image, starts disposable Postgres/backend containers, then runs the local dev
frontend and native Playwright browser. The backend binds to a randomly selected
loopback port; the frontend uses another free port. Containers and database are
removed afterward, including on failure. This verifies real backend integration
but is not the identical all-container browser environment used by GitHub CI.
The backend production target does not build development/test gem stages.
