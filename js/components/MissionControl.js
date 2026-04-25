import React from 'react';
import {
    Alert, Badge, Button, Card, CardBody, Col, FormGroup, Input, Label, Nav, NavItem, NavLink, Row, Table,
    TabContent, TabPane
} from 'reactstrap';
import {FaLock, FaSearch, FaSlidersH, FaTrash, FaUsers} from 'react-icons/fa';
import {notify} from 'react-notify-toast';
import {
    createBeamer,
    deleteBeamer,
    endMatch,
    getBeamers,
    setTournamentTimer,
    startMatch,
    startNextGroupMatches,
    startNextStageMatches,
    submitDeciderMatchScores,
    submitMatchScores,
    updateBeamer,
    updateTeamName
} from '../api';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {TIMER_MODE_COUNTDOWN, TIMER_MODE_COUNTUP} from '../utils/timerState';
import {TournamentSettingsForm} from './TournamentSettingsForm';

function stageName(level) {
    const names = ['Finale', 'Halbfinale', 'Viertelfinale', 'Achtelfinale'];
    if (level < names.length) {
        return names[level];
    }
    return Math.pow(2, level) + 'tel-Finale';
}

function scoreFor(match, teamKey) {
    const score = match.decider ? match[teamKey].hiddenScore : match[teamKey].score;
    return score === null || score === undefined ? '' : score;
}

function errorMessage(errorBody, fallback) {
    if (errorBody && typeof errorBody.error === 'string') {
        return errorBody.error;
    }
    return fallback;
}

const DISPLAY_STATES = [
    {value: 'matches_all', label: 'Alle Matches'},
    {value: 'matches_in_progress', label: 'Laufende Matches'},
    {value: 'matches_upcoming', label: 'Kommende Matches'},
    {value: 'matches_not_started', label: 'Bereit zum Starten'},
    {value: 'matches_finished', label: 'Beendete Matches'},
    {value: 'groups', label: 'Gruppenstand'},
    {value: 'between_games', label: 'Zwischen den Spielen'},
    {value: 'during_game', label: 'Waehrend dem Spiel'}
];

function displayStateLabel(value) {
    const match = DISPLAY_STATES.find(state => state.value === value);
    return match ? match.label : value;
}

function matchStateLabel(state) {
    if (state === 'in_progress') {
        return 'In Progress';
    }
    if (state === 'not_started') {
        return 'Not Started';
    }
    if (state === 'finished') {
        return 'Finished';
    }
    return state;
}

function matchStateClass(state) {
    if (state === 'in_progress') {
        return 'is-progress';
    }
    if (state === 'finished') {
        return 'is-finished';
    }
    if (state === 'not_started') {
        return 'is-not-started';
    }
    return 'is-live';
}

function nextPlayoffTable(match) {
    return Math.ceil(match.position / 2);
}

export class MissionControl extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            activeTab: 'timer',
            search: '',
            actionRunning: null
        };
        this.setActiveTab = this.setActiveTab.bind(this);
        this.setSearch = this.setSearch.bind(this);
        this.startGroupMatches = this.startGroupMatches.bind(this);
        this.startStageMatches = this.startStageMatches.bind(this);
        this.onActionSuccess = this.onActionSuccess.bind(this);
        this.onActionError = this.onActionError.bind(this);
    }

    setActiveTab(tab) {
        this.setState({activeTab: tab});
    }

    setSearch(event) {
        this.setState({search: event.target.value});
    }

    startGroupMatches() {
        this.setState({actionRunning: 'group'});
        startNextGroupMatches(this.props.tournament.groupStage.groups, this.onActionSuccess, this.onActionError);
    }

    startStageMatches(stage) {
        this.setState({actionRunning: 'stage-' + stage.id});
        startNextStageMatches(stage, this.onActionSuccess, this.onActionError);
    }

    onActionSuccess(matches) {
        if (matches.length === 0) {
            notify.show('Keine startbaren Matches gefunden.', 'warning', 2500);
        } else {
            notify.show('Matches wurden gestartet.', 'success', 2500);
        }
        this.setState({actionRunning: null});
        this.props.onTournamentChange();
    }

    onActionError(errorBody) {
        notify.show(errorMessage(errorBody, 'Die Matches konnten nicht gestartet werden.'), 'error', 3000);
        this.setState({actionRunning: null});
        this.props.onTournamentChange();
    }

    render() {
        const {tournament, isOwner, isSignedIn} = this.props;
        const canControl = isOwner && isSignedIn && tournament.readOnlyMode !== true;
        const canEditSettings = isOwner && isSignedIn;

        if (!isOwner || !isSignedIn) {
            return null;
        }

        return (
            <div className='container mb-4' data-testid='mission-control'>
                <Card className='mission-control-card'>
                    <CardBody>
                        <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3'>
                            <div>
                                <h2 className='h4 mb-1'>Mission Control</h2>
                                <div className='text-muted'>Live-Steuerung fuer Turnierleitung</div>
                            </div>
                        </div>

                        {!canControl &&
                            <Alert color='warning' className='mt-3 mb-3'>
                                Follower-Modus aktiv. Live-Aktionen sind gesperrt.
                            </Alert>}

                        <Nav tabs className='mb-3'>
                            <NavItem>
                                <NavLink href='#' active={this.state.activeTab === 'timer'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('timer');
                                    }}>
                                    Timer
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#' active={this.state.activeTab === 'beamer'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('beamer');
                                    }}>
                                    Beamer
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#' active={this.state.activeTab === 'starts'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('starts');
                                    }}>
                                    Match-Starts
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#' active={this.state.activeTab === 'scores'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('scores');
                                    }}>
                                    Ergebnisse
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#' active={this.state.activeTab === 'teams'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('teams');
                                    }}>
                                    Teams
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#' active={this.state.activeTab === 'settings'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('settings');
                                    }}>
                                    Turnier-Einstellungen
                                </NavLink>
                            </NavItem>
                        </Nav>

                        <TabContent activeTab={this.state.activeTab}>
                            <TabPane tabId='timer'>
                                <MissionTimer
                                    tournamentId={tournament.id}
                                    timerState={tournament.timerState}
                                    disabled={!canControl}
                                    onTournamentChange={this.props.onTournamentChange}
                                />
                            </TabPane>

                            <TabPane tabId='beamer'>
                                <MissionBeamer tournament={tournament} disabled={!canControl} />
                            </TabPane>

                            <TabPane tabId='starts'>
                                <MissionNextMatches
                                    tournament={tournament}
                                    disabled={!canControl}
                                    actionRunning={this.state.actionRunning}
                                    onStartGroupMatches={this.startGroupMatches}
                                    onStartStageMatches={this.startStageMatches}
                                />
                            </TabPane>

                            <TabPane tabId='scores'>
                                <div className='mission-control-toolbar mb-3'>
                                    <Input
                                        type='search'
                                        value={this.state.search}
                                        onChange={this.setSearch}
                                        placeholder='Teams suchen'
                                        data-testid='mission-control-search'
                                    />
                                </div>
                                <MissionMatches
                                    tournament={tournament}
                                    search={this.state.search}
                                    disabled={!canControl}
                                    onTournamentChange={this.props.onTournamentChange}
                                />
                            </TabPane>

                            <TabPane tabId='teams'>
                                <div className='mission-control-toolbar mb-3'>
                                    <Input
                                        type='search'
                                        value={this.state.search}
                                        onChange={this.setSearch}
                                        placeholder='Teams suchen'
                                        data-testid='mission-control-search'
                                    />
                                </div>
                                <MissionTeams
                                    teams={tournament.teams}
                                    search={this.state.search}
                                    disabled={!canControl}
                                    onTournamentChange={this.props.onTournamentChange}
                                />
                            </TabPane>

                            <TabPane tabId='settings'>
                                <MissionTournamentSettings
                                    tournament={tournament}
                                    disabled={!canEditSettings}
                                    onTournamentChange={this.props.onTournamentChange}
                                />
                            </TabPane>
                        </TabContent>
                    </CardBody>
                </Card>
            </div>
        );
    }
}

class MissionBeamer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {beamers: [], name: '', running: false};
        this.setName = this.setName.bind(this);
        this.reload = this.reload.bind(this);
        this.create = this.create.bind(this);
        this.onError = this.onError.bind(this);
    }

    componentDidMount() {
        this.reload();
    }

    reload() {
        getBeamers(this.props.tournament.id,
            beamers => this.setState({beamers: beamers || [], running: false}),
            this.onError);
    }

    setName(event) {
        this.setState({name: event.target.value});
    }

    create(event) {
        event.preventDefault();
        if (!this.state.name.trim()) {
            return;
        }
        this.setState({running: true});
        createBeamer(this.props.tournament.id, {
            name: this.state.name.trim(),
            display_state: 'matches_all'
        }, () => {
            notify.show('Beamer wurde erstellt.', 'success', 2000);
            this.setState({name: ''});
            this.reload();
        }, this.onError);
    }

    update(beamer, displayState) {
        this.setState({running: true});
        updateBeamer(this.props.tournament.id, beamer.id, {
            display_state: displayState
        }, () => {
            notify.show('Beamer wurde aktualisiert.', 'success', 2000);
            this.reload();
        }, this.onError);
    }

    remove(beamer) {
        this.setState({running: true});
        deleteBeamer(this.props.tournament.id, beamer.id, () => {
            notify.show('Beamer wurde geloescht.', 'success', 2000);
            this.reload();
        }, this.onError);
    }

    onError(errorBody) {
        notify.show(errorMessage(errorBody, 'Beamer konnte nicht aktualisiert werden.'), 'error', 3000);
        this.setState({running: false});
    }

    render() {
        return (
            <section className='mission-control-section mission-pane-beamer' data-testid='mission-beamer-control'>
                <h3 className='h5 mission-pane-heading'>Aktive Beamer</h3>
                <Table responsive bordered className='mission-beamer-table'>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Anzeige</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.state.beamers.map(beamer => (
                            <tr key={beamer.id}>
                                <td className='mission-beamer-name'>{beamer.name}</td>
                                <td>
                                    <div className='mission-beamer-display'>
                                        <Input
                                            type='select'
                                            value={beamer.display_state || 'matches_all'}
                                            disabled={this.state.running || this.props.disabled}
                                            data-testid={'mission-beamer-display-' + beamer.id}
                                            onChange={event => this.update(beamer, event.target.value)}>
                                            {DISPLAY_STATES.map(state => (
                                                <option key={state.value} value={state.value}>{state.label}</option>
                                            ))}
                                        </Input>
                                        <Button color='primary' disabled={this.state.running || this.props.disabled}
                                            onClick={() => this.update(beamer, beamer.display_state || 'matches_all')}>
                                            Aktualisieren
                                        </Button>
                                        <Button color='link'
                                            href={'/t/' + this.props.tournament.id +
                                            '/fullscreen?beamer=' + encodeURIComponent(beamer.name)}
                                            target='_blank'>
                                            {displayStateLabel(beamer.display_state || 'matches_all')}
                                        </Button>
                                    </div>
                                </td>
                                <td>
                                    <Button outline color='danger'
                                        disabled={this.state.running || this.props.disabled}
                                        data-testid={'mission-beamer-delete-' + beamer.id}
                                        onClick={() => this.remove(beamer)}>
                                        <FaTrash aria-hidden='true' /> Loeschen
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {this.state.beamers.length === 0 &&
                            <tr>
                                <td colSpan='3' className='text-muted'>Keine Beamer vorhanden.</td>
                            </tr>}
                    </tbody>
                </Table>

                <hr className='my-4' />

                <form onSubmit={this.create} className='mission-beamer-create'>
                    <h3 className='h5 mission-pane-heading'>Neuen Beamer erstellen</h3>
                    <Label for='missionBeamerName'>Name</Label>
                    <Input id='missionBeamerName'
                        value={this.state.name}
                        onChange={this.setName}
                        disabled={this.state.running || this.props.disabled}
                        placeholder='z.B. Hauptbeamer'
                        data-testid='mission-beamer-name' />
                    <Button type='submit' color='primary' className='mt-3'
                        disabled={this.state.running || this.props.disabled || !this.state.name.trim()}
                        data-testid='mission-beamer-create'>
                        Beamer erstellen
                    </Button>
                </form>
            </section>
        );
    }
}

function MissionTournamentSettings(props) {
    return (
        <section className='mission-control-section'>
            <h3 className='h5'>Turnier-Einstellungen</h3>
            <TournamentSettingsForm
                tournament={props.tournament}
                disabled={props.disabled}
                onTournamentChange={props.onTournamentChange}
            />
        </section>
    );
}

class MissionTimer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {minutes: 15, seconds: '00', timestamp: '', running: false};
        this.setMinutes = this.setMinutes.bind(this);
        this.setSeconds = this.setSeconds.bind(this);
        this.setTimestamp = this.setTimestamp.bind(this);
        this.setCountdownMinutes = this.setCountdownMinutes.bind(this);
        this.setCountdownTimestamp = this.setCountdownTimestamp.bind(this);
        this.startCountup = this.startCountup.bind(this);
        this.clearTimer = this.clearTimer.bind(this);
        this.onSuccess = this.onSuccess.bind(this);
        this.onError = this.onError.bind(this);
    }

    setMinutes(event) {
        this.setState({minutes: event.target.value});
    }

    setSeconds(event) {
        this.setState({seconds: event.target.value});
    }

    setTimestamp(event) {
        this.setState({timestamp: event.target.value});
    }

    setCountdownMinutes() {
        const minutes = parseInt(this.state.minutes || 0, 10);
        const remainderSeconds = parseInt(this.state.seconds || 0, 10);
        const seconds = (minutes * 60) + remainderSeconds;
        this.patchTimer({timestamp_seconds: seconds, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    setQuickCountdown(seconds) {
        this.patchTimer({timestamp_seconds: seconds, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    setCountdownTimestamp() {
        this.patchTimer({timestamp: this.state.timestamp, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    startCountup() {
        this.patchTimer({timer_mode: TIMER_MODE_COUNTUP});
    }

    clearTimer() {
        this.patchTimer({clear_timer: true});
    }

    patchTimer(payload) {
        this.setState({running: true});
        setTournamentTimer(this.props.tournamentId, payload, this.onSuccess, this.onError);
    }

    onSuccess() {
        notify.show('Timer wurde aktualisiert.', 'success', 2500);
        this.setState({running: false});
        this.props.onTournamentChange();
    }

    onError(errorBody) {
        notify.show(errorMessage(errorBody, 'Timer konnte nicht aktualisiert werden.'), 'error', 3000);
        this.setState({running: false});
    }

    render() {
        const currentTimer = this.props.timerState && this.props.timerState.mode ?
            this.props.timerState.mode + ' ' + this.props.timerState.timestampIso :
            'kein Timer';
        return (
            <section className='mission-control-section mission-pane-timer' data-testid='mission-timer-control'>
                <div className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
                    <h3 className='h5 mission-pane-heading'>Countdown starten</h3>
                    <span className='text-muted small'>{currentTimer}</span>
                </div>
                <Row className='g-3'>
                    <Col lg='4'>
                        <div className='mission-control-panel'>
                            <h4>Schnellstart</h4>
                            <p>Starte einen Countdown mit vordefinierter Dauer.</p>
                            <div className='mission-quick-grid'>
                                <button type='button' className='mission-quick-button'
                                    disabled={this.props.disabled || this.state.running}
                                    data-testid='mission-timer-quick-20'
                                    onClick={() => this.setQuickCountdown(20 * 60)}>
                                    <strong>20:00</strong>
                                    <span>20 Minuten</span>
                                </button>
                                <button type='button' className='mission-quick-button'
                                    disabled={this.props.disabled || this.state.running}
                                    data-testid='mission-timer-quick-15s'
                                    onClick={() => this.setQuickCountdown(15)}>
                                    <strong>00:15</strong>
                                    <span>15 Sekunden</span>
                                </button>
                            </div>
                        </div>
                    </Col>
                    <Col lg='4'>
                        <div className='mission-control-panel'>
                            <h4>Manuelle Dauer</h4>
                            <p>Starte einen Countdown mit eigener Zeit.</p>
                            <Row className='g-2'>
                                <Col>
                                    <Label for='missionTimerMinutes'>Minuten</Label>
                                    <Input id='missionTimerMinutes' type='number' min='0'
                                        value={this.state.minutes} onChange={this.setMinutes}/>
                                </Col>
                                <Col>
                                    <Label for='missionTimerSeconds'>Sekunden</Label>
                                    <Input id='missionTimerSeconds' type='number' min='0' max='59'
                                        value={this.state.seconds} onChange={this.setSeconds}/>
                                </Col>
                            </Row>
                            <Button color='primary' className='w-100 mt-3'
                                data-testid='mission-timer-countdown-minutes'
                                disabled={this.props.disabled || this.state.running}
                                onClick={this.setCountdownMinutes}>
                                Countdown starten
                            </Button>
                        </div>
                    </Col>
                    <Col lg='4'>
                        <div className='mission-control-panel'>
                            <h4>Bis Zeitpunkt</h4>
                            <p>Starte einen Countdown bis zu einem bestimmten Zeitpunkt.</p>
                            <Input id='missionTimerTimestamp' type='datetime-local'
                                value={this.state.timestamp} onChange={this.setTimestamp}/>
                            <Button color='primary' className='w-100 mt-3'
                                data-testid='mission-timer-countdown-timestamp'
                                disabled={this.props.disabled || this.state.running || !this.state.timestamp}
                                onClick={this.setCountdownTimestamp}>
                                Countdown bis Zeitpunkt starten
                            </Button>
                        </div>
                    </Col>
                </Row>

                <div className='mission-control-panel mt-3'>
                    <h3 className='h5 mission-pane-heading'>Countup starten</h3>
                    <p>Starte einen aufwaertszaehlenden Timer.</p>
                    <Button color='info' className='mission-countup-button'
                        disabled={this.props.disabled || this.state.running}
                        data-testid='mission-timer-countup'
                        onClick={this.startCountup}>
                        Countup starten
                    </Button>
                </div>

                <div className='mission-control-panel mt-3'>
                    <h3 className='h5 mission-pane-heading'>Timer verwalten</h3>
                    <p>Alle aktiven Timer stoppen und zuruecksetzen.</p>
                    <Button outline color='danger' className='w-100'
                        disabled={this.props.disabled || this.state.running}
                        data-testid='mission-timer-clear'
                        onClick={this.clearTimer}>
                        Timer loeschen
                    </Button>
                </div>
            </section>
        );
    }
}

function MissionNextMatches(props) {
    const groupStage = props.tournament.groupStage;
    const groups = groupStage ? groupStage.groups.map(group => ({
        key: 'group-' + group.id,
        title: 'Gruppe ' + group.number,
        badge: group.matches.length + ' Matches',
        matches: group.matches,
        playoff: false
    })) : [];
    const stages = props.tournament.playoffStages.map(stage => ({
        key: 'stage-' + stage.id,
        title: stageName(stage.level),
        badge: stage.matches.length + ' Matches',
        stage: stage,
        matches: stage.matches,
        playoff: true
    }));
    const rows = groups.concat(stages);

    return (
        <section className='mission-control-section mission-pane-matches' data-testid='mission-match-control'>
            <div className='mission-match-toolbar'>
                <div className='mission-match-search'>
                    <FaSearch aria-hidden='true' />
                    <Input type='search' placeholder='Matches suchen...' aria-label='Matches suchen' />
                </div>
                <Button color='link' className='mission-filter-reset'>x Filter zuruecksetzen</Button>
                <Button outline color='secondary' className='mission-view-button'>
                    <FaSlidersH aria-hidden='true' /> Ansicht anpassen
                </Button>
            </div>

            <div className='d-flex gap-2 flex-wrap mb-3'>
                {groupStage && groupStage.state !== 'finished' &&
                    <Button color='success'
                        data-testid='mission-start-next-groups'
                        disabled={props.disabled || props.actionRunning === 'group'}
                        onClick={props.onStartGroupMatches}>
                        Naechste Gruppenmatches starten
                    </Button>}
                {props.tournament.playoffStages.map(stage => (
                    <Button key={stage.id} color='success' outline
                        disabled={props.disabled || props.actionRunning === 'stage-' + stage.id}
                        onClick={() => props.onStartStageMatches(stage)}>
                        {stageName(stage.level)} starten
                    </Button>
                ))}
            </div>

            {rows.map(row => (
                <div key={row.key} className='mission-match-stage'>
                    <h3 className='h5 mission-pane-heading'>
                        {row.title}
                        <Badge color='light' className='mission-stage-badge'>{row.badge}</Badge>
                    </h3>
                    <div className='mission-match-grid'>
                        {row.matches.sort(sortMatchesByPositionAscending()).map(match => (
                            <MissionStartMatchCard key={match.id} match={match} playoff={row.playoff} />
                        ))}
                    </div>
                </div>
            ))}

            <div className='mission-status-legend'>
                <span><i className='is-live'></i>Live</span>
                <span><i className='is-progress'></i>In Progress</span>
                <span><i className='is-not-started'></i>Not Started</span>
                <span><i className='is-finished'></i>Finished</span>
            </div>
        </section>
    );
}

function MissionStartMatchCard(props) {
    const match = props.match;
    const stateClass = matchStateClass(match.state);
    const stateLabel = match.state === 'in_progress' ? 'Live' : matchStateLabel(match.state);
    const tableLabel = 'G' + (match.group ? match.group.number : Math.max(1, match.position)) + '-S' + match.position;
    return (
        <div className={'mission-start-card ' + stateClass} data-testid='mission-start-match-card'>
            <div className='mission-start-table'>{tableLabel}</div>
            <div className='mission-start-row'>
                <span><FaUsers aria-hidden='true' />{match.team1.name}</span>
                <Input type='number' value={scoreFor(match, 'team1')} readOnly
                    aria-label={match.team1.name + ' score'} />
            </div>
            <div className='mission-start-row'>
                <span><FaUsers aria-hidden='true' />{match.team2.name}</span>
                <Input type='number' value={scoreFor(match, 'team2')} readOnly
                    aria-label={match.team2.name + ' score'} />
            </div>
            <div className='mission-start-meta'>
                <span><i className={stateClass}></i>{stateLabel}</span>
                <span><FaLock aria-hidden='true' />Locked</span>
            </div>
            {props.playoff &&
                <div className='mission-next-table'>
                    Tisch {match.position} <span>-&gt;</span> Tisch {nextPlayoffTable(match)}
                </div>}
        </div>
    );
}

function MissionMatches(props) {
    const rows = [];
    if (props.tournament.groupStage) {
        props.tournament.groupStage.groups.forEach(group => {
            rows.push({
                key: 'group-' + group.id,
                name: 'Gruppe ' + group.number,
                group: group,
                matches: group.matches
            });
        });
    }
    props.tournament.playoffStages.forEach(stage => {
        rows.push({
            key: 'stage-' + stage.id,
            name: stageName(stage.level),
            matches: stage.matches
        });
    });

    return (
        <section className='mission-control-section'>
            <h3 className='h5'>Scores</h3>
            {rows.map(row => (
                <MissionStageBlock
                    key={row.key}
                    title={row.name}
                    group={row.group}
                    matches={row.matches}
                    search={props.search}
                    disabled={props.disabled}
                    onTournamentChange={props.onTournamentChange}
                />
            ))}
        </section>
    );
}

function MissionStageBlock(props) {
    const search = props.search.trim().toLowerCase();
    const matches = props.matches
        .filter(match => {
            if (!search) {
                return true;
            }
            return [match.team1.name, match.team2.name].join(' ').toLowerCase().indexOf(search) !== -1;
        })
        .sort(sortMatchesByPositionAscending());

    if (matches.length === 0) {
        return null;
    }

    return (
        <div className='mb-3'>
            <h4 className='h6 d-flex align-items-center gap-2'>
                {props.title}
                <Badge color='secondary'>{matches.length}</Badge>
            </h4>
            {props.group && <MissionGroupTable group={props.group}/>}
            <Row className='g-2'>
                {matches.map(match => (
                    <Col lg='4' md='6' key={match.id}>
                        <MissionMatchCard
                            match={match}
                            disabled={props.disabled}
                            onTournamentChange={props.onTournamentChange}
                        />
                    </Col>
                ))}
            </Row>
        </div>
    );
}

function MissionGroupTable(props) {
    return (
        <Table size='sm' bordered responsive className='mission-control-group-table'>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>Punkte</th>
                    <th>Differenz</th>
                </tr>
            </thead>
            <tbody>
                {props.group.scores.map(score => (
                    <tr key={score.id}>
                        <td>{score.position}</td>
                        <td>{score.team.name}</td>
                        <td>{score.group_points}</td>
                        <td>{score.difference_in_points}</td>
                    </tr>
                ))}
            </tbody>
        </Table>
    );
}

class MissionMatchCard extends React.Component {
    constructor(props) {
        super(props);
        this.state = this.scoreStateFromProps(props);
        this.setScore1 = this.setScore1.bind(this);
        this.setScore2 = this.setScore2.bind(this);
        this.setLive = this.setLive.bind(this);
        this.startMatch = this.startMatch.bind(this);
        this.submit = this.submit.bind(this);
        this.onStartSuccess = this.onStartSuccess.bind(this);
        this.onStartError = this.onStartError.bind(this);
        this.onScoresSuccess = this.onScoresSuccess.bind(this);
        this.onEndSuccess = this.onEndSuccess.bind(this);
        this.onActionError = this.onActionError.bind(this);
    }

    scoreStateFromProps(props) {
        return {
            score1: scoreFor(props.match, 'team1'),
            score2: scoreFor(props.match, 'team2'),
            live: props.match.state === 'in_progress',
            running: false
        };
    }

    componentDidUpdate(prevProps) {
        const scoreChanged = scoreFor(prevProps.match, 'team1') !== scoreFor(this.props.match, 'team1') ||
            scoreFor(prevProps.match, 'team2') !== scoreFor(this.props.match, 'team2');
        if (prevProps.match.id !== this.props.match.id || prevProps.match.state !== this.props.match.state ||
            scoreChanged) {
            this.setState(this.scoreStateFromProps(this.props));
        }
    }

    setScore1(event) {
        this.setState({score1: event.target.value});
    }

    setScore2(event) {
        this.setState({score2: event.target.value});
    }

    setLive(event) {
        this.setState({live: event.target.checked});
    }

    startMatch() {
        this.setState({running: true});
        startMatch(this.props.match.id, this.onStartSuccess, this.onStartError);
    }

    submit(event) {
        event.preventDefault();
        const submitScores = this.props.match.decider ? submitDeciderMatchScores : submitMatchScores;
        this.setState({running: true});
        submitScores(
            this.state.score1,
            this.props.match.team1.scoreId,
            this.state.score2,
            this.props.match.team2.scoreId,
            this.onScoresSuccess,
            this.onActionError
        );
    }

    onStartSuccess() {
        notify.show('Match wurde gestartet.', 'success', 2000);
        this.setState({running: false, live: true});
        this.props.onTournamentChange();
    }

    onStartError() {
        notify.show('Match konnte nicht gestartet werden.', 'error', 3000);
        this.setState({running: false});
    }

    onScoresSuccess() {
        if (this.state.live) {
            notify.show('Score wurde gespeichert.', 'success', 2000);
            this.setState({running: false});
            this.props.onTournamentChange();
            return;
        }

        endMatch(this.props.match.id, this.onEndSuccess, this.onActionError);
    }

    onEndSuccess() {
        notify.show('Match wurde beendet.', 'success', 2000);
        this.setState({running: false});
        this.props.onTournamentChange();
    }

    onActionError() {
        notify.show('Score konnte nicht gespeichert werden.', 'error', 3000);
        this.setState({running: false});
    }

    render() {
        const match = this.props.match;
        const editable = match.state === 'in_progress' && !this.props.disabled;
        const canStart = match.state === 'not_started' && !this.props.disabled;
        return (
            <form onSubmit={this.submit} className='mission-control-match border rounded p-2'
                data-testid='mission-match-card'>
                <div className='d-flex justify-content-between align-items-center mb-2'>
                    <strong>Sp. {match.position}</strong>
                    <Badge color={match.state === 'in_progress' ? 'warning' : 'secondary'}>
                        {match.state}
                    </Badge>
                </div>
                {match.decider && <div className='text-muted mb-2'>Entscheidungsmatch</div>}
                <Label>{match.team1.name}</Label>
                <Input type='number' value={this.state.score1} onChange={this.setScore1} disabled={!editable}/>
                <Label className='mt-2'>{match.team2.name}</Label>
                <Input type='number' value={this.state.score2} onChange={this.setScore2} disabled={!editable}/>
                <FormGroup check className='my-2'>
                    <Input
                        id={`mission-match-live-${match.id}`}
                        type='checkbox'
                        checked={this.state.live}
                        onChange={this.setLive}
                        disabled={!editable}
                    />
                    <Label check for={`mission-match-live-${match.id}`}>
                        Live
                    </Label>
                </FormGroup>
                <div className='d-flex gap-2'>
                    {canStart &&
                        <Button color='outline-primary' size='sm' type='button'
                            data-testid='mission-match-start'
                            disabled={this.state.running} onClick={this.startMatch}>
                            Start
                        </Button>}
                    <Button color='primary' size='sm' type='submit'
                        data-testid='mission-match-save'
                        disabled={!editable || this.state.running}>
                        Speichern
                    </Button>
                </div>
            </form>
        );
    }
}

class MissionTeams extends React.Component {
    constructor(props) {
        super(props);
        this.state = {teamNames: {}, savingTeamId: null};
        this.setTeamName = this.setTeamName.bind(this);
        this.saveTeamName = this.saveTeamName.bind(this);
        this.onSuccess = this.onSuccess.bind(this);
        this.onError = this.onError.bind(this);
    }

    setTeamName(teamId, name) {
        this.setState(prev => ({
            teamNames: Object.assign({}, prev.teamNames, {[teamId]: name})
        }));
    }

    saveTeamName(team) {
        this.setState({savingTeamId: team.id});
        updateTeamName({
            id: team.id,
            name: this.state.teamNames[team.id] || team.name
        }, this.onSuccess, this.onError);
    }

    onSuccess() {
        notify.show('Team wurde umbenannt.', 'success', 2000);
        this.setState({savingTeamId: null});
        this.props.onTournamentChange();
    }

    onError() {
        notify.show('Team konnte nicht umbenannt werden.', 'error', 3000);
        this.setState({savingTeamId: null});
    }

    render() {
        const search = this.props.search.trim().toLowerCase();
        const teams = this.props.teams.filter(team => !search || team.name.toLowerCase().indexOf(search) !== -1);
        return (
            <section className='mission-control-section'>
                <h3 className='h5'>Teams</h3>
                <Row className='g-2'>
                    {teams.map(team => (
                        <Col md='6' lg='4' key={team.id}>
                            <div className='d-flex gap-2'>
                                <Input value={this.state.teamNames[team.id] || team.name}
                                    onChange={event => this.setTeamName(team.id, event.target.value)}
                                    disabled={this.props.disabled}/>
                                <Button color='secondary' outline
                                    data-testid='mission-team-save'
                                    disabled={this.props.disabled || this.state.savingTeamId === team.id}
                                    onClick={() => this.saveTeamName(team)}>
                                    Speichern
                                </Button>
                            </div>
                        </Col>
                    ))}
                </Row>
            </section>
        );
    }
}
