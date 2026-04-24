import {Container, ListGroup, ListGroupItem} from 'reactstrap';
import React from 'react';
import {Timer} from './Timer';

export function TournamentBigImage(props) {
    return (
        <div className="big-image mb-0">
            <h2 className="display-1">{props.name}</h2>
            <Container>
                <TournamentProperties {...props}/>
            </Container>
        </div>
    );
}

function TournamentProperties(props) {
    return (
        <ListGroup className="text-dark text-start shadow">
            {props.description && <ListGroupItem>{props.description}</ListGroupItem>}
            <ListGroupItem>
                {props.isPublic ? 'Das Turnier ist öffentlich.' : 'Das Turnier ist privat.'}
            </ListGroupItem>
            <ListGroupItem>Turnier-Code: <b>{props.code}</b></ListGroupItem>
            <ListGroupItem>von <b>{props.ownerUsername}</b></ListGroupItem>
            {props.timerState && props.timerState.mode &&
                <ListGroupItem>Spielzeit: <Timer timerState={props.timerState} /></ListGroupItem>
            }
        </ListGroup>
    );
}
