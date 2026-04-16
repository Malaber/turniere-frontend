import React from 'react';
import {Container, Navbar} from 'reactstrap';

import {LinkButton} from './LinkButton';

export function TournamentStatusBar(props) {
    return (<Navbar color='light' light className='border-bottom border-top'>
        <Container>
            {props.children}
        </Container>
    </Navbar>);
}

export function EditButton(props) {
    const {tournamentCode, isOwner, isSignedIn} = props;

    if (isSignedIn && isOwner) {
        return (<LinkButton href={'/t/' + tournamentCode + '/edit'}>
            Turnier bearbeiten
        </LinkButton>);
    } else {
        return null;
    }
}
