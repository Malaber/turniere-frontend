import Head from 'next/head';
import React from 'react';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../static/css/everypage.css';
import '../static/css/tournament-fullscreen.css';
import {getTournamentMeta} from '../js/redux/tournamentApi';
import {Navbar, NavbarBrand, NavItem} from 'reactstrap';


function FullscreenPage(props) {
    return (<div>
        <FullscreenPageHeader title={props.tournamentMeta.name} code={props.tournamentMeta.code}/>
    </div>);
}

function FullscreenPageHeader(props) {
    return (<Navbar color='light' className='mb-4 border-bottom py-0'>
        <NavItem className='font-weight-bold'>{props.levelName}</NavItem>
        <NavbarBrand>{props.title}</NavbarBrand>
        <NavItem className='text-secondary'>
            Turnier-Code: <b className='text-primary text-monospace'>{props.code}</b>
        </NavItem>
    </Navbar>);
}

class Main extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            tournamentMeta: null
        };
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
    }

    componentDidMount() {
        getTournamentMeta(this.props.query.code, this.onTournamentRequestSuccess, this.onTournamentRequestError);
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        this.setState({metaStatus: requestStatus, tournamentMeta: tournament});
    }

    onTournamentRequestError(error) {
        if (error.response) {
            this.setState({metaStatus: error.response.status});
        } else {
            this.setState({metaStatus: -1});
        }
    }


    render() {
        const {metaStatus, tournamentMeta} = this.state;
        if (metaStatus === 200) {
            return (<div>
                <Head>
                    <title>{tournamentMeta.name}: turnie.re</title>
                </Head>
                <FullscreenPage tournamentMeta={tournamentMeta}/>
            </div>);
        } else {
            return <ErrorPageComponent code={metaStatus}/>;
        }
    }
}

export default Main;
