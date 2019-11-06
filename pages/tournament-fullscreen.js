import Head from 'next/head';
import React from 'react';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../static/css/everypage.css';
import '../static/css/tournament-fullscreen.css';
import {getTournamentMatches, getTournamentMeta} from '../js/redux/tournamentApi';
import {Navbar, NavbarBrand, NavItem} from 'reactstrap';


function FullscreenPage(props) {
    return (<div>
        <FullscreenPageHeader title={props.tournamentMeta.name} code={props.tournamentMeta.code}/>
        {JSON.stringify(props.tournamentMeta)}
        <Matches matches={props.matches}/>
    </div>);
}

function Matches(props) {
    return (<div>
        {props.matches.map(match => <Match key={match.id} match={match}/>)}
    </div>);
}

function Match(props) {
    return <div>{JSON.stringify(props.match)}</div>;
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
            tournamentMeta: null, matches: []
        };
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.onTournamentMatchesRequestSuccess = this.onTournamentMatchesRequestSuccess.bind(this);
        this.onTournamentMatchesRequestError = this.onTournamentMatchesRequestError.bind(this);
        this.updateMatches = this.updateMatches.bind(this);
    }

    componentDidMount() {
        const tournamentId = this.props.query.code;
        getTournamentMeta(tournamentId, this.onTournamentRequestSuccess, this.onTournamentRequestError);
        this.updateMatches();
        const intervalId = setInterval(this.updateMatches, 3000);
        this.setState({intervalId: intervalId});
    }

    componentWillUnmount() {
        clearInterval(this.state.intervalId);
    }

    updateMatches() {
        const tournamentId = this.props.query.code;
        getTournamentMatches(tournamentId, this.onTournamentMatchesRequestSuccess,
            this.onTournamentMatchesRequestError);
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

    onTournamentMatchesRequestSuccess(requestStatus, matches) {
        this.setState({matchesStatus: requestStatus, matches: matches});
    }

    onTournamentMatchesRequestError(error) {
        if (error.response) {
            this.setState({matchesStatus: error.response.status});
        } else {
            this.setState({matchesStatus: -1});
        }
    }


    render() {
        const {metaStatus, tournamentMeta, matches} = this.state;
        if (metaStatus === 200) {
            return (<div>
                <Head>
                    <title>{tournamentMeta.name}: turnie.re</title>
                </Head>
                <FullscreenPage tournamentMeta={tournamentMeta} matches={matches}/>
            </div>);
        } else {
            return <ErrorPageComponent code={metaStatus}/>;
        }
    }
}

export default Main;
