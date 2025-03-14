import Head from 'next/head';
import React from 'react';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {getTournamentMatches, getTournamentMeta, getTournamentTimerEnd} from '../js/redux/tournamentApi';
import {
    Col, Container, DropdownItem, DropdownMenu, DropdownToggle, Navbar, NavbarBrand, NavItem, Row, UncontrolledDropdown,
    Spinner
} from 'reactstrap';
import {Match} from '../js/components/Match';
import {sortMatchesByPositionAscending} from '../js/utils/sorting';
import {Timer} from '../js/components/Timer';


function FullscreenPage(props) {
    return (<div>
        <FullscreenPageHeader title={props.tournamentMeta.name} code={props.tournamentMeta.code} filter={props.filter}
                              timerEnd={props.timerEnd}/>
        <Matches matches={props.matches}/>
    </div>);
}

function Matches(props) {
    let matches;
    if (props.matches == null) {
        matches = (<div className="text-center text-secondary">
            <Spinner animation="border" role="status" size="sm"/>
            <span className="ml-3">lade Matches</span>
        </div>);
    } else if (props.matches.length === 0) {
        matches = (<div className="text-center text-secondary font-italic">keine Matches</div>);
    } else {
        matches = (<Row>
            {props.matches.sort(sortMatchesByPositionAscending()).map(
                match => <Col md="auto"><Match key={match.id} match={match}/></Col>
            )}
        </Row>);
    }
    return (<div className="mx-4 h5">
        {matches}
    </div>);
}

function FilterDropdown(props) {
    return (<UncontrolledDropdown>
        <i>Match-Filter: </i>
        <DropdownToggle color="light" caret>
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
    return (
        <Navbar color="light" className="mb-4 border-bottom py-0">
            <div className="ml-auto dropdown-container"><FilterDropdown {...props.filter} /></div>
            <NavbarBrand>{props.title}</NavbarBrand>
            {props.timerEnd &&
                <div className="ml-auto timer-container">Spielzeit: <NavbarBrand><Timer timerEnd={props.timerEnd}/></NavbarBrand></div>
            }
        </Navbar>
    );
}

const matchFilters = {
    'all': {backend: null, label: 'alle'},
    'in_progress': {backend: 'in_progress', label: 'laufend'},
    'upcoming': {backend: 'upcoming', label: 'kommend'},
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
            tournamentMeta: null, matches: [], matchFilter: matchFilters.all, loadedMeta: false, loadedMatches: false,
            timerEnd: null, intervalId: null
        };
        this.onTournamentRequestSuccess = this.onTournamentRequestSuccess.bind(this);
        this.onTournamentRequestError = this.onTournamentRequestError.bind(this);
        this.onTournamentMatchesRequestSuccess = this.onTournamentMatchesRequestSuccess.bind(this);
        this.onTournamentMatchesRequestError = this.onTournamentMatchesRequestError.bind(this);
        this.updateMatches = this.updateMatches.bind(this);
        this.selectFilter = this.selectFilter.bind(this);
        this.updateTimerEnd = this.updateTimerEnd.bind(this);
    }

    selectFilter(filter) {
        this.setState({matchFilter: filter, loadedMatches: false});
        this.updateMatches();
    }

    componentDidMount() {
        const tournamentId = this.props.query.code;
        getTournamentMeta(tournamentId, this.onTournamentRequestSuccess, this.onTournamentRequestError);
        this.updateMatches();
        this.updateTimerEnd();
        const matchesIntervalId = setInterval(this.updateMatches, 10000);
        const timerEndIntervalId = setInterval(this.updateTimerEnd, 10000);
        this.setState({matchesIntervalId: matchesIntervalId, timerEndIntervalId: timerEndIntervalId});
    }

    componentWillUnmount() {
        clearInterval(this.state.matchesIntervalId);
        clearInterval(this.state.timerEndIntervalId);
    }

    updateMatches() {
        const tournamentId = this.props.query.code;
        getTournamentMatches(tournamentId, this.onTournamentMatchesRequestSuccess, this.onTournamentMatchesRequestError,
            this.state.matchFilter.backend);
    }

    updateTimerEnd() {
        const tournamentId = this.props.query.code;
        getTournamentTimerEnd(tournamentId, (status, timerEnd) => {
            this.setState({timerEnd: timerEnd});
        }, error => {
            console.error('Failed to fetch timer end:', error);
        });
    }

    onTournamentRequestSuccess(requestStatus, tournament) {
        this.setState({metaStatus: requestStatus, tournamentMeta: tournament, loadedMeta: true});
    }

    onTournamentRequestError(error) {
        if (error.response) {
            this.setState({metaStatus: error.response.status, loadedMeta: true});
        } else {
            this.setState({metaStatus: -1, loadedMeta: true});
        }
    }

    onTournamentMatchesRequestSuccess(requestStatus, matches) {
        this.setState({matchesStatus: requestStatus, matches: matches, loadedMatches: true});
    }

    onTournamentMatchesRequestError(error) {
        if (error.response) {
            this.setState({matchesStatus: error.response.status, loadedMatches: true});
        } else {
            this.setState({matchesStatus: -1, loadedMatches: true});
        }
    }

    render() {
        const {metaStatus, matchesStatus, tournamentMeta, matches, timerEnd} = this.state;
        const filter = {
            selected: this.state.matchFilter, select: this.selectFilter
        };
        if (!this.state.loadedMeta) {
            return (<div>
                <Head>
                    <title>Vollbild-Ansicht: turnie.re</title>
                </Head>
                <Container className="p-5 text-center text-secondary">
                    <Spinner size="sm"/>
                    <span className="ml-3">lade Vollbild-Ansicht</span>
                </Container>
            </div>);
        }
        if (!this.state.loadedMatches) {
            return (<div>
                <Head>
                    <title>{tournamentMeta.name}: turnie.re</title>
                </Head>
                <FullscreenPage tournamentMeta={tournamentMeta} matches={null} filter={filter} timerEnd={timerEnd}/>
            </div>);
        }
        if (metaStatus === 200 && matchesStatus === 200) {
            return (<div>
                <Head>
                    <title>{tournamentMeta.name}: turnie.re</title>
                </Head>
                <FullscreenPage tournamentMeta={tournamentMeta} matches={matches} filter={filter} timerEnd={timerEnd}/>
            </div>);
        } else {
            return <ErrorPageComponent code={metaStatus}/>;
        }
    }
}

export default Main;
