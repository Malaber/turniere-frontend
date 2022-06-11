import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';

import {ButtonGroup, Card, CardBody, Container} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {Footer} from '../js/components/Footer';

import TournamentList from '../js/components/TournamentList';
import RequireLogin from '../js/components/RequireLogin';
import { LinkButton } from '../js/components/LinkButton';

class PrivateTournamentsPage extends React.Component {
    render() {
        return (<RequireLogin loginMessage='Sie müssen angemeldet sein, um Ihre privaten Turniere zu sehen.'>
            <div className="main generic-fullpage-bg">
                <Head>
                    <title>Private Turniere: turnie.re</title>
                </Head>
                <TurniereNavigation/>
                <PrivateTournamentsPageContent isSignedIn={this.props.isSignedIn}/>
                <Footer/>
            </div>
        </RequireLogin>);
    }
}

function mapStateToProperties(state) {
    const {isSignedIn} = state.userinfo;
    return {isSignedIn};
}

const PrivateTournamentListPage = connect(mapStateToProperties)(PrivateTournamentsPage);

export default PrivateTournamentListPage;

function PrivateTournamentsPageContent(props) {
    return (<div>
        <Container className="pt-5">
            <PrivateTournamentsCard/>
        </Container>
        <Container className="pb-5 pt-3">
            <ButtonGroup>
                <LinkButton href="/list" outline={false} color='primary'>zu den öffentlichen Turnieren</LinkButton>
                {
                    props.isSignedIn &&
                    <LinkButton href="/create" outline={false} color='success'>neues Turnier erstellen</LinkButton>
                }
            </ButtonGroup>
        </Container>
    </div>);
}

class PrivateTournamentsCard extends React.Component {
    render() {
        return (<Card className="shadow">
            <CardBody>
                <h1 className="custom-font">Private Turniere</h1>
                <TournamentList type='private'/>
            </CardBody>
        </Card>);
    }
}
