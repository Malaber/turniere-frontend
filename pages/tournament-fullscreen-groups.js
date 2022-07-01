import Head from 'next/head';
import React from 'react';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {getTournament} from '../js/redux/tournamentApi';
import {
    Col,
    Container, Navbar, NavbarBrand, NavItem, Row, Spinner
} from 'reactstrap';
import {QRCodeSVG} from 'qrcode.react';
import {Group} from '../js/components/GroupStage';


function FullscreenPage(props) {
    let logo;
    if (props.showLogo) {
        logo = <Col><img height='300' width='300' src='/static/images/bpwstr_logo.png'></img></Col>;
    } else {
        logo = <div />;
    }
    return (<div>
        <FullscreenPageHeader title={props.tournament.name} page={props.page + 1} maxPage={props.maxPage + 1}/>
        <Container className='fs-5' fluid>
            <Row className='row-cols-4'>
                {props.groups.map(group => <Col className='mb-2'><Group group={group} key={group.id}/></Col>)}
                <Col>
                    <QRCodeSVG
                        className='shadow'
                        value={'https://turnie.re/t/' + props.tournament.id}
                        size="300"
                    />
                </Col>
                {logo}
            </Row>
        </Container>
    </div>);
}

function FullscreenPageHeader(props) {
    return (<Navbar color='light' className='mb-4 border-bottom py-0'>
        <NavbarBrand>{props.title}</NavbarBrand>
        {props.page}/{props.maxPage}
    </Navbar>);
}


class Main extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);
        this.groupsPerPage = 11;
        this.pages = 2;
        this.page = 0;

        this.state = {
            groups: [], tournament: null, loadedTournament: false, loadingStatus: null, page: 0, showLogo: false
        };
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.increasePage = this.increasePage.bind(this);
    }

    componentDidMount() {
        this.updateTournament();
        const intervalIdPage = setInterval(this.increasePage, 3000);
        this.setState({intervalIdPage: intervalIdPage});
    }

    increasePage() {
        if (this.page >= this.pages) {
            this.page = 0;
        } else {
            this.page = this.page + 1;
        }
        this.updateTournament();
    }

    componentWillUnmount() {
        clearInterval(this.state.intervalIdPage);
    }

    updateTournament() {
        getTournament(this.props.query.code, this.onTournamentRequestSuccess, this.onTournamentRequestError);
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        // filter groups by page
        const groups = tournament.groupStage.groups;
        const start = this.page * this.groupsPerPage;
        const end = (this.page + 1) * this.groupsPerPage;

        this.setState({
            loadingStatus: requestStatus, tournament: tournament,
            groups: groups.slice(start, end), loadedTournament: true,
            page: this.page, showLogo: this.page == this.pages
        });
    }

    onTournamentRequestError(error) {
        if (error.response) {
            this.setState({loadingStatus: error.response.status, loadedTournament: true});
        } else {
            this.setState({loadingStatus: -1, loadedTournament: true});
        }
    }

    render() {
        const {groups, tournament, loadedTournament, loadingStatus, page, showLogo} = this.state;
        if (!loadedTournament) {
            return (<div>
                <Head>
                    <title>Vollbild-Ansicht: turnie.re</title>
                </Head>
                <Container className='p-5 text-center text-secondary'>
                    <Spinner size='sm'/>
                    <span className='ml-3'>lade Vollbild-Ansicht</span>
                </Container>
            </div>);
        }
        if (loadingStatus === 200) {
            return (<div>
                <Head>
                    <title>{tournament.name}: turnie.re</title>
                </Head>
                <FullscreenPage
                    tournament={tournament} groups={groups} page={page} maxPage={this.pages}
                    showLogo={showLogo}
                />
            </div>);
        } else {
            return <ErrorPageComponent code={loadingStatus}/>;
        }
    }
}

export default Main;
