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
$ TURNIERE_API_URL=https://api.example.com yarn run dev
```
The environment variable `TURNIERE_API_URL` must contain an valid url to a [turniere backend server](https://github.com/turniere/turniere-backend).
 
In production environment the server runs on port 80, otherwise on port 3001.

## Production Setup: Build the Docker Container

```
$ docker build -t turniere-frontend .
```

The built container exposes port 80.

# Todo 

Timer in topnav