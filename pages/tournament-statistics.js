import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {ButtonGroup, Col, Container, Row} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {StandingsTable} from '../js/components/StandingsTable';
import {DominanceShower} from '../js/components/DominanceShower';
import {Footer} from '../js/components/Footer';
import {requestTournamentStatistics} from '../js/api';
import {EditButton, TournamentStatusBar} from '../js/components/TournamentStatusBar';
import {LinkButton} from '../js/components/LinkButton';
import {TournamentBigImage} from '../js/components/TournamentBigImage';
import {LoadingPage} from '../js/components/LoadingPage';

class StatisticsTournamentPage extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    componentDidMount() {
        requestTournamentStatistics(this.props.query.code, () => {}, () => {});
    }

    render() {
        const {tournamentStatistics} = this.props;

        if (!tournamentStatistics.loaded) {
            return <LoadingPage title='turnie.re' text='Statistiken zum Turnier werden geladen...'/>;
        }

        return (
            <div>
                <Head>
                    <title>{tournamentStatistics.name}: turnie.re</title>
                </Head>
                <TurniereNavigation/>
                <TournamentBigImage {...tournamentStatistics}/>
                <TournamentStatusBar>
                    <ButtonGroup className='me-auto'>
                        <EditButton tournamentId={tournamentStatistics.id}
                            isOwner={this.props.username === tournamentStatistics.ownerUsername}
                            isSignedIn={this.props.isSignedIn}/>
                        <LinkButton href={'/t/' + tournamentStatistics.id}>
                            zurück zum Turnier
                        </LinkButton>
                        <LinkButton href={'/t/' + tournamentStatistics.id + '/fullscreen'}>
                            Turnier-Vollbild-Ansicht
                        </LinkButton>
                    </ButtonGroup>
                </TournamentStatusBar>
                <div className='pb-5'>
                    <StatisticsView tournamentStatistics={tournamentStatistics} />
                </div>
                <Footer/>
            </div>
        );
    }
}

function StatisticsView(props) {
    if (props.tournamentStatistics.statistics_available) {
        return (<div>
            <Container className="py-5">
                <Row>
                    <Col xs="6">
                        <DominanceShower stats={props.tournamentStatistics.most_dominant_team}
                            title="Stärkstes Team"/>
                    </Col>
                    <Col xs="6">
                        <DominanceShower stats={props.tournamentStatistics.least_dominant_team}
                            title="Schwächstes Team"/>
                    </Col>
                </Row>
            </Container>
            <Container className="pb-5">
                <StandingsTable data={props.tournamentStatistics}/>
            </Container>
        </div>);
    } else {
        return (<Container className="py-5">
            <h2 className="text-center">Statistiken sind für dieses Turnier leider nicht verfügbar.</h2>
        </Container>);
    }
}

function mapTournamentStatisticsToProps(state) {
    const {tournamentStatistics} = state;
    const {isSignedIn, username} = state.userinfo;
    return {tournamentStatistics, isSignedIn, username};
}

export default connect(
    mapTournamentStatisticsToProps
)(StatisticsTournamentPage);
