import Head from 'next/head';
import React from 'react';
import {ButtonGroup, Card, CardBody, Container} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {Footer} from '../js/components/Footer';

import TournamentList from '../js/components/TournamentList';
import {connect} from 'react-redux';
import {LinkButton} from '../js/components/LinkButton';

export default class PublicTournamentsPage extends React.Component {
    render() {
        return (<div className="main generic-fullpage-bg">
            <Head>
                <title>Öffentliche Turniere: turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <div>
                <PublicTournamentPageContent/>
            </div>
            <Footer/>
        </div>);
    }
}

function mapStateToProperties(state) {
    const {isSignedIn} = state.userinfo;
    return {isSignedIn};
}

const PublicTournamentPageContent = connect(mapStateToProperties)(PublicTournaments);

function PublicTournaments(props) {
    if (props.isSignedIn) {
        return (<div>
            <Container className='pt-5'>
                <PublicTournamentsCard/>
            </Container>
            <Container className="pb-5 pt-3">
                <ButtonGroup>
                    <LinkButton href="/private" outline={false} color='primary'>zu den privaten Turnieren</LinkButton>
                    <LinkButton href="/private" outline={false} color='success'>neues Turnier erstellen</LinkButton>
                </ButtonGroup>
            </Container>
        </div>);
    } else {
        return (<Container className='py-5'>
            <PublicTournamentsCard/>
        </Container>);
    }
}

function PublicTournamentsCard() {
    return (<Card className="shadow">
        <CardBody>
            <h1 className="custom-font">Öffentliche Turniere</h1>
            <TournamentList type='public'/>
        </CardBody>
    </Card>);
}
