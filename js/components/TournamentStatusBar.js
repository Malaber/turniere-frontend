import React from 'react';
import Navbar from 'react-bootstrap/Navbar';
import {Container} from 'reactstrap';

import {LinkButton} from './LinkButton';

export function TournamentStatusBar(props) {
    return (<Navbar sticky='top' bg='light' className='border-bottom border-top'>
        <Container className='px-3'>
            {props.children}
        </Container>
    </Navbar>);
}

export function EditButton(props) {
    const {tournamentId, isOwner, isSignedIn} = props;

    if (isSignedIn && isOwner) {
        return (<LinkButton href={'/t/' + tournamentId + '/edit'}>
            Turnier bearbeiten
        </LinkButton>);
    } else {
        return null;
    }
}
