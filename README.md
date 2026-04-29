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
