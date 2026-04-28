import React from 'react';
import {
    Alert, Badge, Button, Card, CardBody, Col, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader,
    Nav, NavItem, NavLink, Row, Table, TabContent, TabPane
} from 'reactstrap';
import {FaExternalLinkAlt, FaKeyboard, FaLock, FaSearch, FaTrash, FaUsers} from 'react-icons/fa';
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
import {TeamName} from './TeamName';
import {Timer} from './Timer';

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
    {value: 'between_games', label: 'Zwischen den Spielen'},
    {value: 'during_game', label: 'Während dem Spiel'},
    {value: 'group_tables', label: 'Gruppenstand'},
    {value: 'static_image', label: 'Statisches Bild'}
];

const BEAMER_MODES = [
    {value: 'group_tables', label: 'Group Tables', displayState: 'group_tables'},
    {value: 'during_game', label: 'Matches with Timer', displayState: 'during_game'},
    {value: 'between_games', label: 'Matches Only', displayState: 'between_games'},
    {value: 'static_image', label: 'Static Image', displayState: 'static_image'}
];

const BEAMER_MATCH_STATES = [
    {value: '', label: 'Alle Status'},
    {value: 'in_progress', label: 'Laufend'},
    {value: 'not_started', label: 'Nicht gestartet'},
    {value: 'finished', label: 'Beendet'}
];

const STATIC_IMAGE_OPTIONS = [
    {value: 'bpwstr_banner', label: 'BPWSTR Banner'},
    {value: 'bpwstr_logo', label: 'BPWSTR Logo'},
    {value: 'turniere_logo', label: 'Turnie Logo'}
];

const TAB_IDS = ['timer', 'beamer', 'starts', 'scores', 'teams', 'settings'];
const SEARCH_TAB_IDS = ['scores', 'teams'];

function tabFromLocation() {
    if (typeof window === 'undefined') {
        return null;
    }

    const hashTab = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const tab = hashTab || queryTab;
    return TAB_IDS.indexOf(tab) !== -1 ? tab : null;
}

function displayStateLabel(value) {
    const match = DISPLAY_STATES.find(state => state.value === value);
    return match ? match.label : value;
}

function beamerModeFor(beamer) {
    const mode = BEAMER_MODES.find(item => item.displayState === beamer.display_state);
    return mode ? mode.value : 'during_game';
}

function beamerModeLabel(value) {
    const mode = BEAMER_MODES.find(item => item.value === value);
    return mode ? mode.label : value;
}

function matchFilterValue(filters) {
    const entries = Object.keys(filters)
        .filter(key => filters[key] !== null && filters[key] !== undefined && filters[key] !== '')
        .sort()
        .map(key => key + ':' + filters[key]);
    return entries.join(',');
}

function addMatchFilterOptions(options, label, filters) {
    BEAMER_MATCH_STATES.forEach(state => {
        const stateFilters = state.value ? Object.assign({}, filters, {state: state.value}) : filters;
        const stateLabel = state.value ? label + ' - ' + state.label : label;
        options.push({value: matchFilterValue(stateFilters), label: stateLabel});
    });
}

function beamerMatchFilterOptions(tournament) {
    const options = [];
    addMatchFilterOptions(options, 'Alle Matches', {});

    const groupStage = tournament.groupStage || {};
    const groupPositions = [];
    (groupStage.groups || []).forEach(group => {
        (group.matches || []).forEach(match => {
            const backendPosition = match.backendPosition !== undefined ? match.backendPosition : match.position - 1;
            if (groupPositions.indexOf(backendPosition) === -1) {
                groupPositions.push(backendPosition);
            }
        });
    });
    groupPositions.sort((a, b) => a - b).forEach(position => {
        addMatchFilterOptions(options, 'Gruppenphase Runde ' + (position + 1), {group_stage_position: position});
    });

    (tournament.playoffStages || []).forEach(stage => {
        addMatchFilterOptions(options, stageName(stage.level), {stage_level: stage.level});
    });

    return options;
}

function matchStateLabel(state) {
    if (state === 'in_progress') {
        return 'In Progress';
    }
    if (state === 'not_started' || state === 'not_ready') {
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
    if (state === 'not_started' || state === 'not_ready') {
        return 'is-not-started';
    }
    return 'is-live';
}

const UNLOCK_HOLD_DURATION_MS = 600;
const UNLOCK_RESET_MS = 6000;
const START_HOLD_DURATION_MS = 600;

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
        this.searchInput = React.createRef();
        this.setActiveTab = this.setActiveTab.bind(this);
        this.setSearch = this.setSearch.bind(this);
        this.handleLocationChange = this.handleLocationChange.bind(this);
        this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
        this.focusSearch = this.focusSearch.bind(this);
        this.startGroupMatches = this.startGroupMatches.bind(this);
        this.startStageMatches = this.startStageMatches.bind(this);
        this.onActionSuccess = this.onActionSuccess.bind(this);
        this.onActionError = this.onActionError.bind(this);
    }

    componentDidMount() {
        const initialTab = tabFromLocation();
        if (initialTab) {
            this.setState({activeTab: initialTab});
        }
        window.addEventListener('popstate', this.handleLocationChange);
        window.addEventListener('hashchange', this.handleLocationChange);
        window.addEventListener('keydown', this.handleGlobalKeyDown);
    }

    componentDidUpdate() {
        this.handleLocationChange();
    }

    componentWillUnmount() {
        window.removeEventListener('popstate', this.handleLocationChange);
        window.removeEventListener('hashchange', this.handleLocationChange);
        window.removeEventListener('keydown', this.handleGlobalKeyDown);
    }

    setActiveTab(tab, updateUrl = true, callback = null) {
        if (TAB_IDS.indexOf(tab) === -1) {
            return;
        }

        this.setState({activeTab: tab}, callback);
        if (updateUrl && typeof window !== 'undefined') {
            window.history.pushState(null, '', '#' + tab);
        }
    }

    setSearch(event) {
        this.setState({search: event.target.value});
    }

    handleLocationChange() {
        const tab = tabFromLocation();
        if (tab && tab !== this.state.activeTab) {
            this.setActiveTab(tab, false);
        }
    }

    handleGlobalKeyDown(event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            this.focusSearch();
        }
    }

    focusSearch() {
        const focus = () => {
            const activeSearch = document.querySelector('.tab-pane.active [data-testid="mission-control-search"]');
            const input = activeSearch || this.searchInput.current;
            if (input) {
                input.focus();
                input.select();
            }
        };

        if (SEARCH_TAB_IDS.indexOf(this.state.activeTab) === -1) {
            this.setActiveTab('scores', true, focus);
            return;
        }

        focus();
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
                                <div className='text-muted'>Live-Steuerung für Turnierleitung</div>
                            </div>
                            <Button color='outline-primary'
                                href={'/t/' + tournament.id}
                                data-testid='mission-tournament-link'>
                                Turnier öffnen <FaExternalLinkAlt aria-hidden='true' />
                            </Button>
                        </div>

                        {!canControl &&
                            <Alert color='warning' className='mt-3 mb-3'>
                                Follower-Modus aktiv. Live-Aktionen sind gesperrt.
                            </Alert>}

                        <Nav tabs className='mb-3'>
                            <NavItem>
                                <NavLink href='#timer' active={this.state.activeTab === 'timer'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('timer');
                                    }}>
                                    Timer
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#beamer' active={this.state.activeTab === 'beamer'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('beamer');
                                    }}>
                                    Beamer
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#starts' active={this.state.activeTab === 'starts'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('starts');
                                    }}>
                                    Match-Starts
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#scores' active={this.state.activeTab === 'scores'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('scores');
                                    }}>
                                    Ergebnisse
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#teams' active={this.state.activeTab === 'teams'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('teams');
                                    }}>
                                    Teams
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#settings' active={this.state.activeTab === 'settings'}
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
                                <MissionMatches
                                    tournament={tournament}
                                    search={this.state.search}
                                    onSearchChange={this.setSearch}
                                    searchInputRef={this.searchInput}
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
                                        aria-label='Teams suchen'
                                        title='Mit Cmd+K oder Ctrl+K fokussieren'
                                        innerRef={this.searchInput}
                                        data-testid='mission-control-search'
                                    />
                                    <div className='mission-search-hint'>
                                        <FaKeyboard aria-hidden='true' /> Cmd+K
                                    </div>
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
        this.state = {beamers: [], name: '', loading: false, savingById: {}, selectionsById: {}};
        this.setName = this.setName.bind(this);
        this.reload = this.reload.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.updateMode = this.updateMode.bind(this);
        this.updateMatchSelection = this.updateMatchSelection.bind(this);
        this.updateImageSelection = this.updateImageSelection.bind(this);
        this.onError = this.onError.bind(this);
    }

    componentDidMount() {
        this.reload();
    }

    reload() {
        getBeamers(this.props.tournament.id,
            beamers => this.setState({
                beamers: beamers || [],
                loading: false,
                savingById: {}
            }),
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
        this.setState({loading: true});
        createBeamer(this.props.tournament.id, {
            name: this.state.name.trim(),
            display_state: 'during_game',
            config: {}
        }, () => {
            notify.show('Beamer wurde erstellt.', 'success', 2000);
            this.setState({name: ''});
            this.reload();
        }, this.onError);
    }

    setBeamerSaving(beamerId, saving) {
        this.setState(prev => ({
            savingById: Object.assign({}, prev.savingById, {[beamerId]: saving})
        }));
    }

    update(beamer, payload) {
        this.setBeamerSaving(beamer.id, true);
        updateBeamer(this.props.tournament.id, beamer.id, payload, () => {
            notify.show('Beamer wurde aktualisiert.', 'success', 2000);
            this.reload();
        }, errorBody => this.onError(errorBody, beamer.id));
    }

    updateMode(beamer, modeValue) {
        const mode = BEAMER_MODES.find(item => item.value === modeValue);
        if (!mode) {
            return;
        }
        this.update(beamer, {
            display_state: mode.displayState,
            config: Object.assign({}, beamer.config || {})
        });
    }

    updateMatchSelection(beamer, value) {
        this.update(beamer, {
            config: Object.assign({}, beamer.config || {}, {match_filter: value})
        });
    }

    updateImageSelection(beamer, value) {
        this.update(beamer, {
            display_state: 'static_image',
            config: Object.assign({}, beamer.config || {}, {image_key: value})
        });
    }

    remove(beamer) {
        this.setBeamerSaving(beamer.id, true);
        deleteBeamer(this.props.tournament.id, beamer.id, () => {
            notify.show('Beamer wurde gelöscht.', 'success', 2000);
            this.reload();
        }, errorBody => this.onError(errorBody, beamer.id));
    }

    onError(errorBody, beamerId) {
        notify.show(errorMessage(errorBody, 'Beamer konnte nicht aktualisiert werden.'), 'error', 3000);
        if (beamerId) {
            this.setBeamerSaving(beamerId, false);
        } else {
            this.setState({loading: false});
        }
    }

    render() {
        const matchFilters = beamerMatchFilterOptions(this.props.tournament);
        return (
            <section className='mission-control-section mission-pane-beamer' data-testid='mission-beamer-control'>
                <h3 className='h5 mission-pane-heading'>Aktive Beamer</h3>
                <div className='mission-beamer-list'>
                    {this.state.beamers.map(beamer => {
                        const config = beamer.config || {};
                        const mode = beamerModeFor(beamer);
                        const saving = Boolean(this.state.savingById[beamer.id]);
                        const disabled = saving || this.props.disabled;
                        const matchSelection = config.match_filter || '';
                        const imageSelection = config.image_key || STATIC_IMAGE_OPTIONS[0].value;

                        return (
                            <div className='mission-beamer-card' key={beamer.id}
                                data-testid={'mission-beamer-card-' + beamer.id}>
                                <div className='mission-beamer-card-header'>
                                    <div>
                                        <div className='mission-beamer-name'>{beamer.name}</div>
                                        <div className='mission-beamer-current'>
                                            {beamerModeLabel(mode)} · {displayStateLabel(beamer.display_state)}
                                        </div>
                                    </div>
                                    <div className='mission-beamer-actions'>
                                        {saving && <span className='mission-beamer-saving'>Speichert...</span>}
                                        <Button color='link'
                                            href={'/t/' + this.props.tournament.id +
                                            '/fullscreen?beamer=' + encodeURIComponent(beamer.name)}
                                            target='_blank'>
                                            Anzeigen
                                        </Button>
                                        <Button outline color='danger'
                                            disabled={disabled}
                                            data-testid={'mission-beamer-delete-' + beamer.id}
                                            onClick={() => this.remove(beamer)}>
                                            <FaTrash aria-hidden='true' /> Löschen
                                        </Button>
                                    </div>
                                </div>
                                <div className='mission-beamer-display'>
                                    <FormGroup>
                                        <Label for={'missionBeamerMode' + beamer.id}>Modus</Label>
                                        <Input
                                            id={'missionBeamerMode' + beamer.id}
                                            type='select'
                                            value={mode}
                                            disabled={disabled}
                                            data-testid={'mission-beamer-mode-' + beamer.id}
                                            onChange={event => this.updateMode(beamer, event.target.value)}>
                                            {BEAMER_MODES.map(item => (
                                                <option key={item.value} value={item.value}>{item.label}</option>
                                            ))}
                                        </Input>
                                    </FormGroup>

                                    {(mode === 'during_game' || mode === 'between_games') &&
                                        <FormGroup>
                                            <Label for={'missionBeamerMatch' + beamer.id}>Matchauswahl</Label>
                                            <Input
                                                id={'missionBeamerMatch' + beamer.id}
                                                type='select'
                                                value={matchSelection}
                                                disabled={disabled}
                                                data-testid={'mission-beamer-match-' + beamer.id}
                                                onChange={event => this.updateMatchSelection(
                                                    beamer,
                                                    event.target.value
                                                )}>
                                                {matchFilters.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </Input>
                                        </FormGroup>}

                                    {mode === 'static_image' &&
                                        <FormGroup>
                                            <Label for={'missionBeamerImage' + beamer.id}>Bild</Label>
                                            <Input
                                                id={'missionBeamerImage' + beamer.id}
                                                type='select'
                                                value={imageSelection}
                                                disabled={disabled}
                                                data-testid={'mission-beamer-image-' + beamer.id}
                                                onChange={event => this.updateImageSelection(
                                                    beamer,
                                                    event.target.value
                                                )}>
                                                {STATIC_IMAGE_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </Input>
                                        </FormGroup>}
                                </div>
                            </div>
                        );
                    })}
                    {this.state.beamers.length === 0 &&
                        <div className='text-muted mission-beamer-empty'>Keine Beamer vorhanden.</div>}
                </div>

                <hr className='my-4' />

                <form onSubmit={this.create} className='mission-beamer-create'>
                    <h3 className='h5 mission-pane-heading'>Neuen Beamer erstellen</h3>
                    <Label for='missionBeamerName'>Name</Label>
                    <Input id='missionBeamerName'
                        value={this.state.name}
                        onChange={this.setName}
                        disabled={this.state.loading || this.props.disabled}
                        placeholder='z. B. Hauptbeamer'
                        data-testid='mission-beamer-name' />
                    <Button type='submit' color='primary' className='mt-3'
                        disabled={this.state.loading || this.props.disabled || !this.state.name.trim()}
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
        this.state = {minutes: 20, seconds: '00', timestamp: '', running: false};
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
        if (this.props.disabled || this.state.running) {
            return;
        }
        const minutes = parseInt(this.state.minutes || 0, 10);
        const remainderSeconds = parseInt(this.state.seconds || 0, 10);
        const seconds = (minutes * 60) + remainderSeconds;
        this.patchTimer({timestamp_seconds: seconds, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    setQuickCountdown(seconds) {
        if (this.props.disabled || this.state.running) {
            return;
        }
        this.patchTimer({timestamp_seconds: seconds, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    setCountdownTimestamp() {
        if (this.props.disabled || this.state.running || !this.state.timestamp) {
            return;
        }
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
                <div className='mission-current-timer mb-3'>
                    <div>
                        <h3 className='h5 mission-pane-heading mb-1'>Countdown starten</h3>
                        <span className='text-muted small'>{currentTimer}</span>
                    </div>
                    <div className='mission-current-timer-display' data-testid='mission-current-timer-display'>
                        <Timer timerState={this.props.timerState} />
                    </div>
                </div>
                <Row className='g-3'>
                    <Col lg='4'>
                        <div className='mission-control-panel'>
                            <h4>Schnellstart</h4>
                            <p>Starte einen Countdown mit vordefinierter Dauer.</p>
                            <div className='mission-quick-grid'>
                                <button type='button' className='mission-quick-button'
                                    disabled={this.props.disabled || this.state.running}
                                    data-testid='mission-timer-quick-20s'
                                    onClick={() => this.setQuickCountdown(20)}>
                                    <strong>00:20</strong>
                                    <span>20 Sekunden</span>
                                </button>
                                <button type='button' className='mission-quick-button'
                                    disabled={this.props.disabled || this.state.running}
                                    data-testid='mission-timer-quick-2015'
                                    onClick={() => this.setQuickCountdown((20 * 60) + 15)}>
                                    <strong>20:15</strong>
                                    <span>20 Minuten 15 Sekunden</span>
                                </button>
                            </div>
                        </div>
                    </Col>
                    <Col lg='4'>
                        <form className='mission-control-panel' onSubmit={event => {
                            event.preventDefault();
                            this.setCountdownMinutes();
                        }}>
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
                                type='submit'
                                data-testid='mission-timer-countdown-minutes'
                                disabled={this.props.disabled || this.state.running}>
                                Countdown starten
                            </Button>
                        </form>
                    </Col>
                    <Col lg='4'>
                        <form className='mission-control-panel' onSubmit={event => {
                            event.preventDefault();
                            this.setCountdownTimestamp();
                        }}>
                            <h4>Bis Zeitpunkt</h4>
                            <p>Starte einen Countdown bis zu einem bestimmten Zeitpunkt.</p>
                            <Input id='missionTimerTimestamp' type='datetime-local'
                                value={this.state.timestamp} onChange={this.setTimestamp}/>
                            <Button color='primary' className='w-100 mt-3'
                                type='submit'
                                data-testid='mission-timer-countdown-timestamp'
                                disabled={this.props.disabled || this.state.running || !this.state.timestamp}>
                                Countdown bis Zeitpunkt starten
                            </Button>
                        </form>
                    </Col>
                </Row>

                <div className='mission-control-panel mt-3'>
                    <h3 className='h5 mission-pane-heading'>Countup starten</h3>
                    <p>Starte einen aufwärtszählenden Timer.</p>
                    <Button color='info' className='mission-countup-button'
                        disabled={this.props.disabled || this.state.running}
                        data-testid='mission-timer-countup'
                        onClick={this.startCountup}>
                        Countup starten
                    </Button>
                </div>

                <div className='mission-control-panel mt-3'>
                    <h3 className='h5 mission-pane-heading'>Timer verwalten</h3>
                    <p>Alle aktiven Timer stoppen und zurücksetzen.</p>
                    <Button outline color='danger' className='w-100'
                        disabled={this.props.disabled || this.state.running}
                        data-testid='mission-timer-clear'
                        onClick={this.clearTimer}>
                        Timer löschen
                    </Button>
                </div>
            </section>
        );
    }
}

function MissionNextMatches(props) {
    const groupStage = props.tournament.groupStage;
    const stagesWithReadyMatches = props.tournament.playoffStages
        .map(stage => ({
            stage: stage,
            readyCount: stage.matches.filter(match => match.state === 'not_started').length
        }))
        .filter(stageInfo => stageInfo.readyCount > 0);

    return (
        <section className='mission-control-section mission-pane-starts' data-testid='mission-match-control'>
            <h3 className='h5 mission-pane-heading'>Bulk Match-Starts</h3>
            <p className='text-muted'>
                Startet jeweils die nächsten startbaren Matches gesammelt. Ergebnis- und Scorepflege liegt im
                Ergebnisse-Tab.
            </p>
            <div className='mission-bulk-start-grid'>
                {groupStage && groupStage.state !== 'finished' ?
                    <div className='mission-control-panel'>
                        <h4>Gruppenphase</h4>
                        <p>Startet das nächste offene Match pro Gruppe.</p>
                        <MissionStartConfirmButton
                            testId='mission-start-next-groups'
                            color='success'
                            disabled={props.disabled || props.actionRunning === 'group'}
                            onConfirm={props.onStartGroupMatches}
                            title='Match-Starts bestätigen'
                            message='Nächste offene Gruppenmatches werden erst nach OK gestartet.'>
                            Nächste Gruppenmatches starten
                        </MissionStartConfirmButton>
                    </div> :
                    <div className='mission-control-panel'>
                        <h4>Gruppenphase</h4>
                        <p>Gruppenphase ist abgeschlossen.</p>
                    </div>}
                {stagesWithReadyMatches.map(stageInfo => (
                    <div key={stageInfo.stage.id} className='mission-control-panel'>
                        <h4>{stageName(stageInfo.stage.level)}</h4>
                        <p>{stageInfo.readyCount} startbare Matches.</p>
                        <MissionStartConfirmButton
                            testId={'mission-start-stage-' + stageInfo.stage.id}
                            color='success'
                            outline
                            disabled={props.disabled || props.actionRunning === 'stage-' + stageInfo.stage.id}
                            onConfirm={() => props.onStartStageMatches(stageInfo.stage)}
                            title='Match-Starts bestätigen'
                            message={stageName(stageInfo.stage.level) + ' startet ' + stageInfo.readyCount +
                                ' startbare Matches erst nach OK.'}>
                            {stageName(stageInfo.stage.level)} starten
                        </MissionStartConfirmButton>
                    </div>
                ))}
                {stagesWithReadyMatches.length === 0 && (!groupStage || groupStage.state === 'finished') &&
                    <div className='mission-control-panel'>
                        <h4>Playoffs</h4>
                        <p>Keine startbaren Playoff-Matches vorhanden.</p>
                    </div>}
            </div>
        </section>
    );
}

class MissionStartConfirmButton extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            holding: false,
            holdProgress: 0,
            confirmOpen: false
        };
        this.startHold = this.startHold.bind(this);
        this.cancelHold = this.cancelHold.bind(this);
        this.updateHoldProgress = this.updateHoldProgress.bind(this);
        this.openConfirm = this.openConfirm.bind(this);
        this.closeConfirm = this.closeConfirm.bind(this);
        this.confirm = this.confirm.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.disabled && this.props.disabled) {
            this.cancelHold();
        }
    }

    componentWillUnmount() {
        this.cancelHold(false);
    }

    startHold(event) {
        if (this.props.disabled) {
            return;
        }

        event.preventDefault();
        this.cancelHold();
        this.holdStartedAt = window.performance.now();
        this.setState({holding: true, holdProgress: 0});
        this.holdTimer = window.setTimeout(this.openConfirm, START_HOLD_DURATION_MS);
        this.holdFrame = window.requestAnimationFrame(this.updateHoldProgress);
    }

    cancelHold(resetState = true) {
        if (this.holdTimer) {
            window.clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }
        if (this.holdFrame) {
            window.cancelAnimationFrame(this.holdFrame);
            this.holdFrame = null;
        }
        this.holdStartedAt = null;
        if (resetState !== false && (this.state.holding || this.state.holdProgress !== 0)) {
            this.setState({holding: false, holdProgress: 0});
        }
    }

    updateHoldProgress(timestamp) {
        if (!this.holdTimer || !this.holdStartedAt) {
            return;
        }

        const elapsed = timestamp - this.holdStartedAt;
        const progress = Math.min(1, elapsed / START_HOLD_DURATION_MS);
        this.setState({holdProgress: progress});
        if (progress < 1) {
            this.holdFrame = window.requestAnimationFrame(this.updateHoldProgress);
        }
    }

    openConfirm() {
        this.holdTimer = null;
        if (this.holdFrame) {
            window.cancelAnimationFrame(this.holdFrame);
            this.holdFrame = null;
        }
        this.holdStartedAt = null;
        this.setState({holding: false, holdProgress: 0, confirmOpen: true});
    }

    closeConfirm() {
        this.setState({confirmOpen: false});
    }

    confirm() {
        if (this.props.disabled) {
            return;
        }
        this.closeConfirm();
        this.props.onConfirm();
    }

    onKeyDown(event) {
        if (event.key !== ' ' && event.key !== 'Spacebar' && event.code !== 'Space' && event.key !== 'Enter') {
            return;
        }
        if (event.repeat || this.holdTimer) {
            event.preventDefault();
            return;
        }
        this.startHold(event);
    }

    onKeyUp(event) {
        if (event.key !== ' ' && event.key !== 'Spacebar' && event.code !== 'Space' && event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        this.cancelHold();
    }

    render() {
        const holdProgress = Math.round(this.state.holdProgress * 100);
        const className = 'mission-hold-start-button' + (this.state.holding ? ' is-holding' : '');

        return (
            <>
                <Button color={this.props.color}
                    outline={this.props.outline}
                    className={className}
                    data-testid={this.props.testId}
                    disabled={this.props.disabled}
                    onPointerDown={this.startHold}
                    onPointerUp={this.cancelHold}
                    onPointerLeave={this.cancelHold}
                    onPointerCancel={this.cancelHold}
                    onKeyDown={this.onKeyDown}
                    onKeyUp={this.onKeyUp}
                    onBlur={this.cancelHold}
                    title='Gedrückt halten, um Start zu bestätigen'>
                    <span>{this.props.children}</span>
                    <span
                        className='mission-lock-progress'
                        data-testid='mission-start-hold-progress'
                        role='progressbar'
                        aria-valuemin='0'
                        aria-valuemax='100'
                        aria-valuenow={holdProgress}>
                        <span className='mission-lock-progress-bar' style={{width: `${holdProgress}%`}} />
                    </span>
                </Button>
                <Modal isOpen={this.state.confirmOpen} toggle={this.closeConfirm}
                    fade={false} data-testid='mission-start-confirm-modal'>
                    <ModalHeader toggle={this.closeConfirm}>{this.props.title}</ModalHeader>
                    <ModalBody>
                        <p className='mb-0'>{this.props.message}</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button color='success' onClick={this.confirm} disabled={this.props.disabled}
                            data-testid='mission-start-confirm-ok'>
                            OK
                        </Button>
                        <Button color='secondary' onClick={this.closeConfirm}>Abbrechen</Button>
                    </ModalFooter>
                </Modal>
            </>
        );
    }
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
        <section className='mission-control-section mission-pane-scores' data-testid='mission-score-control'>
            <div className='mission-match-toolbar'>
                <div className='mission-match-search'>
                    <FaSearch aria-hidden='true' />
                    <Input
                        type='search'
                        value={props.search}
                        onChange={props.onSearchChange}
                        placeholder='Gruppen, Teams, Matches suchen...'
                        aria-label='Scores suchen'
                        title='Mit Cmd+K oder Ctrl+K fokussieren'
                        innerRef={props.searchInputRef}
                        data-testid='mission-control-search'
                    />
                </div>
                <div className='mission-search-hint'>
                    <FaKeyboard aria-hidden='true' /> Cmd+K
                </div>
                <Button color='link' className='mission-filter-reset'
                    onClick={() => props.onSearchChange({target: {value: ''}})}>
                    x Filter zurücksetzen
                </Button>
            </div>
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
            const haystack = [
                props.title,
                match.team1.name,
                match.team2.name,
                match.state,
                matchStateLabel(match.state),
                'spiel ' + match.position,
                'sp. ' + match.position,
                'tisch ' + match.position,
                match.group ? 'gruppe ' + match.group.number : '',
                match.group ? 'g' + match.group.number : '',
                'g' + (match.group ? match.group.number : Math.max(1, match.position)) + '-s' + match.position
            ].join(' ').toLowerCase();
            return haystack.indexOf(search) !== -1;
        })
        .sort(sortMatchesByPositionAscending());

    if (matches.length === 0) {
        return null;
    }

    return (
        <div className='mission-match-stage'>
            <h3 className='h5 mission-pane-heading'>
                {props.title}
                <Badge color='light' className='mission-stage-badge'>{matches.length} Matches</Badge>
            </h3>
            {props.group && <MissionGroupTable group={props.group}/>}
            <div className='mission-match-grid mission-score-grid'>
                {matches.map(match => (
                    <MissionMatchCard
                        key={match.id}
                        match={match}
                        playoff={!props.group}
                        disabled={props.disabled}
                        onTournamentChange={props.onTournamentChange}
                    />
                ))}
            </div>
        </div>
    );
}

function MissionGroupTable(props) {
    return (
        <Table size='sm' bordered responsive className='mission-control-group-table'
            style={{tableLayout: 'fixed', width: '100%'}}>
            <thead>
                <tr>
                    <th style={{width: '3rem'}}>#</th>
                    <th>Team</th>
                    <th style={{width: '5rem'}}>Punkte</th>
                    <th style={{width: '5rem'}}>Differenz</th>
                </tr>
            </thead>
            <tbody>
                {props.group.scores.map(score => (
                    <tr key={score.id}>
                        <td>{score.position}</td>
                        <td><TeamName name={score.team.name}/></td>
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
        this.onFormKeyDown = this.onFormKeyDown.bind(this);
        this.startUnlockHold = this.startUnlockHold.bind(this);
        this.cancelUnlockHold = this.cancelUnlockHold.bind(this);
        this.updateUnlockHoldProgress = this.updateUnlockHoldProgress.bind(this);
        this.onUnlockKeyDown = this.onUnlockKeyDown.bind(this);
        this.onUnlockKeyUp = this.onUnlockKeyUp.bind(this);
        this.unlockTemporarily = this.unlockTemporarily.bind(this);
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
            temporaryUnlocked: false,
            unlockHolding: false,
            unlockHoldProgress: 0,
            running: false
        };
    }

    componentWillUnmount() {
        this.cancelUnlockHold(false);
        if (this.unlockResetTimer) {
            window.clearTimeout(this.unlockResetTimer);
        }
    }

    componentDidUpdate(prevProps) {
        const scoreChanged = scoreFor(prevProps.match, 'team1') !== scoreFor(this.props.match, 'team1') ||
            scoreFor(prevProps.match, 'team2') !== scoreFor(this.props.match, 'team2');
        if (prevProps.match.id !== this.props.match.id || prevProps.match.state !== this.props.match.state) {
            this.setState(this.scoreStateFromProps(this.props));
        } else if (scoreChanged) {
            this.setState({
                score1: scoreFor(this.props.match, 'team1'),
                score2: scoreFor(this.props.match, 'team2')
            });
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
        const form = event.currentTarget;
        const score1Input = form.querySelector('[data-score-field="score1"]');
        const score2Input = form.querySelector('[data-score-field="score2"]');
        const liveInput = form.querySelector('[data-score-field="live"]');
        const score1 = score1Input ? score1Input.value : this.state.score1;
        const score2 = score2Input ? score2Input.value : this.state.score2;
        this.submittedLive = liveInput ? liveInput.checked : this.state.live;
        const submitScores = this.props.match.decider ? submitDeciderMatchScores : submitMatchScores;
        this.setState({score1, score2, live: this.submittedLive, running: true});
        submitScores(
            score1,
            this.props.match.team1.scoreId,
            score2,
            this.props.match.team2.scoreId,
            this.onScoresSuccess,
            this.onActionError
        );
    }

    onFormKeyDown(event) {
        if (event.key !== 'Enter') {
            return;
        }

        if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        if (event.currentTarget.requestSubmit) {
            event.currentTarget.requestSubmit();
            return;
        }
        event.currentTarget.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
    }

    canUnlockFinishedMatch() {
        return !this.props.disabled && this.props.match.state === 'finished' && !this.state.temporaryUnlocked;
    }

    startUnlockHold(event) {
        if (!this.canUnlockFinishedMatch()) {
            return;
        }

        event.preventDefault();
        this.cancelUnlockHold();
        this.unlockHoldStartedAt = window.performance.now();
        this.setState({unlockHolding: true, unlockHoldProgress: 0});
        this.unlockHoldTimer = window.setTimeout(this.unlockTemporarily, UNLOCK_HOLD_DURATION_MS);
        this.unlockHoldFrame = window.requestAnimationFrame(this.updateUnlockHoldProgress);
    }

    cancelUnlockHold(resetState = true) {
        if (this.unlockHoldTimer) {
            window.clearTimeout(this.unlockHoldTimer);
            this.unlockHoldTimer = null;
        }
        if (this.unlockHoldFrame) {
            window.cancelAnimationFrame(this.unlockHoldFrame);
            this.unlockHoldFrame = null;
        }
        this.unlockHoldStartedAt = null;
        if (resetState !== false && (this.state.unlockHolding || this.state.unlockHoldProgress !== 0)) {
            this.setState({unlockHolding: false, unlockHoldProgress: 0});
        }
    }

    updateUnlockHoldProgress(timestamp) {
        if (!this.unlockHoldTimer || !this.unlockHoldStartedAt) {
            return;
        }

        const elapsed = timestamp - this.unlockHoldStartedAt;
        const progress = Math.min(1, elapsed / UNLOCK_HOLD_DURATION_MS);
        this.setState({unlockHoldProgress: progress});
        if (progress < 1) {
            this.unlockHoldFrame = window.requestAnimationFrame(this.updateUnlockHoldProgress);
        }
    }

    onUnlockKeyDown(event) {
        if (event.key !== ' ' && event.key !== 'Spacebar' && event.code !== 'Space') {
            return;
        }
        if (event.repeat || this.unlockHoldTimer) {
            event.preventDefault();
            return;
        }
        this.startUnlockHold(event);
    }

    onUnlockKeyUp(event) {
        if (event.key !== ' ' && event.key !== 'Spacebar' && event.code !== 'Space') {
            return;
        }
        event.preventDefault();
        this.cancelUnlockHold();
    }

    unlockTemporarily() {
        this.unlockHoldTimer = null;
        if (this.unlockHoldFrame) {
            window.cancelAnimationFrame(this.unlockHoldFrame);
            this.unlockHoldFrame = null;
        }
        this.unlockHoldStartedAt = null;
        this.setState({temporaryUnlocked: true, unlockHolding: false, unlockHoldProgress: 0});
        if (this.unlockResetTimer) {
            window.clearTimeout(this.unlockResetTimer);
        }
        this.unlockResetTimer = window.setTimeout(() => {
            this.unlockResetTimer = null;
            this.setState({temporaryUnlocked: false});
        }, UNLOCK_RESET_MS);
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
        if (this.submittedLive || this.state.temporaryUnlocked) {
            notify.show('Score wurde gespeichert.', 'success', 2000);
            this.setState({temporaryUnlocked: false, running: false});
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
        const editable = (match.state === 'in_progress' || this.state.temporaryUnlocked) && !this.props.disabled;
        const canStart = match.state === 'not_started' && !this.props.disabled;
        const showUnlockButton = match.state === 'finished' && !this.props.disabled;
        const showStaticLock = match.state === 'not_started' || match.state === 'not_ready' ||
            (match.state === 'finished' && this.props.disabled);
        const unlockProgress = Math.round(this.state.unlockHoldProgress * 100);
        const stateClass = matchStateClass(match.state);
        const stateLabel = match.state === 'in_progress' ? 'Live' : matchStateLabel(match.state);
        return (
            <form onSubmit={this.submit} className={'mission-control-match mission-start-card ' + stateClass}
                onKeyDown={this.onFormKeyDown}
                data-testid='mission-match-card'>
                {match.decider &&
                    <div className='mission-start-table'>
                        <Badge color='warning'>Entscheidung</Badge>
                    </div>}
                <div className='mission-start-row'>
                    <Label className='mission-match-team-label mb-0'>
                        <FaUsers aria-hidden='true' />
                        <TeamName name={match.team1.name} className='mission-match-team-name'
                            testId='mission-match-team-name'/>
                    </Label>
                    <Input type='number' name='score1' data-score-field='score1'
                        value={this.state.score1} onChange={this.setScore1}
                        disabled={!editable} aria-label={match.team1.name + ' score'} />
                </div>
                <div className='mission-start-row'>
                    <Label className='mission-match-team-label mb-0'>
                        <FaUsers aria-hidden='true' />
                        <TeamName name={match.team2.name} className='mission-match-team-name'
                            testId='mission-match-team-name'/>
                    </Label>
                    <Input type='number' name='score2' data-score-field='score2'
                        value={this.state.score2} onChange={this.setScore2}
                        disabled={!editable} aria-label={match.team2.name + ' score'} />
                </div>
                <div className='mission-start-meta'>
                    <FormGroup check className='mb-0'>
                        <Input
                            id={`mission-match-live-${match.id}`}
                            name='live'
                            data-score-field='live'
                            type='checkbox'
                            checked={this.state.live}
                            onChange={this.setLive}
                            disabled={!editable}
                        />
                        <Label check for={`mission-match-live-${match.id}`}>
                            <i className={stateClass}></i>{stateLabel}
                        </Label>
                    </FormGroup>
                    {showStaticLock &&
                        <span className='mission-lock-status' data-testid='mission-match-lock' aria-label='Locked'>
                            <span className='mission-lock-label'>
                                <FaLock aria-hidden='true' />
                                Locked
                            </span>
                        </span>}
                    {showUnlockButton &&
                        <button type='button'
                            className={'mission-lock-button' + (this.state.unlockHolding ? ' is-holding' : '')}
                            data-testid='mission-match-lock'
                            onPointerDown={this.startUnlockHold}
                            onPointerUp={this.cancelUnlockHold}
                            onPointerLeave={this.cancelUnlockHold}
                            onPointerCancel={this.cancelUnlockHold}
                            onKeyDown={this.onUnlockKeyDown}
                            onKeyUp={this.onUnlockKeyUp}
                            onBlur={this.cancelUnlockHold}
                            aria-pressed={this.state.temporaryUnlocked}
                            title='Gedrückt halten, um Ergebnis kurz zu entsperren'>
                            <span className='mission-lock-label'>
                                <FaLock aria-hidden='true' />
                                {this.state.temporaryUnlocked ? 'Kurz entsperrt' : 'Locked'}
                            </span>
                            <span
                                className='mission-lock-progress'
                                data-testid='mission-match-unlock-progress'
                                role='progressbar'
                                aria-valuemin='0'
                                aria-valuemax='100'
                                aria-valuenow={unlockProgress}>
                                <span className='mission-lock-progress-bar' style={{width: `${unlockProgress}%`}} />
                            </span>
                        </button>}
                </div>
                {this.props.playoff &&
                    <div className='mission-next-table'>
                        Tisch {match.position} <span>-&gt;</span> Tisch {nextPlayoffTable(match)}
                    </div>}
                <div className='mission-score-actions'>
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
        if (this.props.disabled || this.state.savingTeamId === team.id) {
            return;
        }
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
                            <form className='d-flex gap-2' onSubmit={event => {
                                event.preventDefault();
                                this.saveTeamName(team);
                            }}>
                                <Input value={this.state.teamNames[team.id] || team.name}
                                    onChange={event => this.setTeamName(team.id, event.target.value)}
                                    disabled={this.props.disabled}/>
                                <Button color='secondary' outline
                                    type='submit'
                                    data-testid='mission-team-save'
                                    disabled={this.props.disabled || this.state.savingTeamId === team.id}>
                                    Speichern
                                </Button>
                            </form>
                        </Col>
                    ))}
                </Row>
            </section>
        );
    }
}
