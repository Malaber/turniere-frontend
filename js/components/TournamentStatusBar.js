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
    const {tournamentId, isOwner, isSignedIn} = props;

    if (isSignedIn && isOwner) {
        return (<LinkButton href={'/t/' + tournamentId + '/mission-control'}>
            Mission Control
        </LinkButton>);
    } else {
        return null;
    }
}
