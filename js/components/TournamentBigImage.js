import {Container, ListGroup, ListGroupItem, Spinner} from 'reactstrap';
import React from 'react';
import {Timer} from './Timer';

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
    return (
        <ListGroup className="text-dark text-start shadow">
            {props.isLoadingBasic &&
                <ListGroupItem data-testid="tournament-basic-loading">
                    <Spinner size="sm" className="me-2"/>
                    Turnierdaten werden geladen...
                </ListGroupItem>}
            {props.description && <ListGroupItem>{props.description}</ListGroupItem>}
            {typeof props.isPublic === 'boolean' &&
                <ListGroupItem>
                    {props.isPublic ? 'Das Turnier ist öffentlich.' : 'Das Turnier ist privat.'}
                </ListGroupItem>}
            {props.code && <ListGroupItem>Turnier-Code: <b>{props.code}</b></ListGroupItem>}
            {props.ownerUsername && <ListGroupItem>von <b>{props.ownerUsername}</b></ListGroupItem>}
            {props.timerState && props.timerState.mode &&
                <ListGroupItem>Spielzeit: <Timer timerState={props.timerState} /></ListGroupItem>
            }
        </ListGroup>
    );
}
