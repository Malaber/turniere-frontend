import Head from 'next/head';
import React from 'react';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../static/css/everypage.css';
import '../static/css/tournament-fullscreen.css';
import {getTournamentMatches, getTournamentMeta} from '../js/redux/tournamentApi';
import {
    Col, DropdownItem, DropdownMenu, DropdownToggle, Navbar, NavbarBrand, NavItem, Row, UncontrolledDropdown
} from 'reactstrap';
import {Match} from '../js/components/Match';


function FullscreenPage(props) {
    return (<div>
        <FullscreenPageHeader title={props.tournamentMeta.name} code={props.tournamentMeta.code} filter={props.filter}/>
        <Matches matches={props.matches}/>
    </div>);
}

function Matches(props) {
    return (<div className='mx-4 h5'>
        <Row>
            {props.matches.map(match => <Col md='auto'><Match key={match.id} match={match}/></Col>)}
        </Row>
    </div>);
}

function FilterDropdown(props) {
    return (<UncontrolledDropdown>
        <i>Match-Filter: </i>
        <DropdownToggle color='light' caret>
            {props.selected.label}
        </DropdownToggle>
        <DropdownMenu>
            {Object.keys(matchFilters).map(matchFilter => <DropdownItem
                onClick={() => props.select(matchFilters[matchFilter])}>
                {matchFilters[matchFilter].label}
            </DropdownItem>)}
        </DropdownMenu>
    </UncontrolledDropdown>);
}


function FullscreenPageHeader(props) {
    return (<Navbar color='light' className='mb-4 border-bottom py-0'>
        <NavItem><FilterDropdown {...props.filter}/></NavItem>
        <NavbarBrand>{props.title}</NavbarBrand>
        <NavItem className='text-secondary'>
            Turnier-Code: <b className='text-primary text-monospace'>{props.code}</b>
        </NavItem>
    </Navbar>);
}

const matchFilters = {
    'all': {backend: null, label: 'alle'},
    'in_progress': {backend: 'in_progress', label: 'laufend'},
    'not_started': {backend: 'not_started', label: 'bereit zum Starten'},
    'finished': {backend: 'finished', label: 'beendet'},
    'single_team': {backend: 'single_team', label: 'ohne Gegner'},
    'not_ready': {backend: 'not_ready', label: 'noch nicht festgelegt'}
};

class Main extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            tournamentMeta: null, matches: [], matchFilter: matchFilters.all
        };
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.onTournamentMatchesRequestSuccess = this.onTournamentMatchesRequestSuccess.bind(this);
        this.onTournamentMatchesRequestError = this.onTournamentMatchesRequestError.bind(this);
        this.updateMatches = this.updateMatches.bind(this);
        this.selectFilter = this.selectFilter.bind(this);
    }

    selectFilter(filter) {
        this.setState({matchFilter: filter});
        this.updateMatches();
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
        getTournamentMatches(tournamentId, this.onTournamentMatchesRequestSuccess, this.onTournamentMatchesRequestError,
            this.state.matchFilter.backend);
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
        const filter = {
            selected: this.state.matchFilter, select: this.selectFilter
        };
        if (metaStatus === 200) {
            return (<div>
                <Head>
                    <title>{tournamentMeta.name}: turnie.re</title>
                </Head>
                <FullscreenPage tournamentMeta={tournamentMeta} matches={matches} filter={filter}/>
            </div>);
        } else {
            return <ErrorPageComponent code={metaStatus}/>;
        }
    }
}

export default Main;
