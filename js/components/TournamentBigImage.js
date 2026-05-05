import {Container, ListGroup, ListGroupItem, Spinner} from 'reactstrap';
import React from 'react';
import {Timer} from './Timer';
import {getTimerReasonLabel} from '../utils/timerState';

export function TournamentBigImage(props) {
    return (
        <div className="big-image mb-0">
            <h2 className="display-1">{props.name || 'Turnier'}</h2>
            <Container>
                <TournamentProperties {...props}/>
            </Container>
        </div>
    );
}

function TournamentProperties(props) {
    const dateRange = formatTournamentDateRange(props.startsAt, props.endsAt);
    const websiteUrl = normalizeWebsiteUrl(props.websiteUrl);

    return (
        <ListGroup className="text-dark text-start shadow">
            {props.isLoadingBasic &&
                <ListGroupItem data-testid="tournament-basic-loading">
                    <Spinner size="sm" className="me-2"/>
                    Turnierdaten werden geladen...
                </ListGroupItem>}
            {props.description && <ListGroupItem>{props.description}</ListGroupItem>}
            {props.location &&
                <ListGroupItem data-testid="tournament-location">Ort: <b>{props.location}</b></ListGroupItem>}
            {dateRange &&
                <ListGroupItem data-testid="tournament-date-range">Zeitraum: <b>{dateRange}</b></ListGroupItem>}
            {websiteUrl &&
                <ListGroupItem data-testid="tournament-website">
                    Website: <a href={websiteUrl} target="_blank" rel="noreferrer">
                        {formatWebsiteLabel(websiteUrl)}
                    </a>
                </ListGroupItem>}
            {typeof props.isPublic === 'boolean' &&
                <ListGroupItem>
                    {props.isPublic ? 'Das Turnier ist öffentlich.' : 'Das Turnier ist privat.'}
                </ListGroupItem>}
            {props.code && <ListGroupItem>Turnier-Code: <b>{props.code}</b></ListGroupItem>}
            {props.ownerUsername && <ListGroupItem>von <b>{props.ownerUsername}</b></ListGroupItem>}
            {props.timerState && props.timerState.mode &&
                <ListGroupItem>
                    {getTimerReasonLabel(props.timerState)}: <Timer timerState={props.timerState} />
                </ListGroupItem>
            }
        </ListGroup>
    );
}

function formatTournamentDateRange(startsAt, endsAt) {
    const start = formatTournamentDateTime(startsAt);
    const end = formatTournamentDateTime(endsAt);

    if (start && end) {
        return start + ' - ' + end;
    }
    if (start) {
        return 'Start: ' + start;
    }
    if (end) {
        return 'Ende: ' + end;
    }
    return '';
}

function formatTournamentDateTime(value) {
    if (!value) {
        return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function normalizeWebsiteUrl(value) {
    if (!value) {
        return '';
    }
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return '';
        }
        return url.toString();
    } catch (_error) {
        return '';
    }
}

function formatWebsiteLabel(value) {
    const url = new URL(value);
    return (url.host + url.pathname).replace(/\/$/, '');
}
