import {Container, ListGroup, ListGroupItem} from 'reactstrap';
import React from 'react';

export function TournamentBigImage(props) {
    return (<div className="big-image mb-0">
        <h1 className="display-1">{props.name}</h1>
        <Container>
            <TournamentProperties {...props}/>
        </Container>
    </div>);
}

function TournamentProperties(props) {
    return (<ListGroup className='text-dark text-start shadow'>
        {props.description && <ListGroupItem>{props.description}</ListGroupItem>}
        <ListGroupItem>
            {props.isPublic ? 'Das Turnier ist öffentlich.' : 'Das Turnier ist privat.'}
        </ListGroupItem>
        <ListGroupItem>Turnier-Code: <b>{props.code}</b></ListGroupItem>
        <ListGroupItem>von <b>{props.ownerUsername}</b></ListGroupItem>
    </ListGroup>);
}
