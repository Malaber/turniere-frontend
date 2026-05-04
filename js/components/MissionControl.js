import React from 'react';
import {
    Alert, Badge, Button, Card, CardBody, Col, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader,
    Nav, NavItem, NavLink, Row, Table, TabContent, TabPane
} from 'reactstrap';
import {
    FaChevronRight, FaClock, FaExternalLinkAlt, FaHistory, FaKeyboard, FaLock, FaPlay, FaSearch, FaStop, FaSyncAlt,
    FaTrash, FaUser, FaUsers
} from 'react-icons/fa';
import {notify} from './Notifications';
import {
    createBeamer,
    deleteBeamer,
    endMatch,
    getBeamers,
    getTournamentTransactionLog,
    setTournamentTimer,
    startMatch,
    startNextGroupMatches,
    startNextStageMatches,
    stopMatch,
    submitDeciderMatchScores,
    submitMatchScores,
    updateBeamer,
    updateTeamName
} from '../api';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {BEAMER_SOUND_EFFECTS} from '../utils/soundEffects';
import {
    getTimerReasonLabel,
    TIMER_MODE_COUNTDOWN,
    TIMER_MODE_COUNTUP,
    TIMER_REASON_CUSTOM,
    TIMER_REASON_OPTIONS
} from '../utils/timerState';
import {TournamentSettingsForm} from './TournamentSettingsForm';
import {TeamName} from './TeamName';
import {Timer} from './Timer';
import {BeamerMediaSelection} from './BeamerMediaSelection';
import {
    allBeamerMediaImageKeys,
    BEAMER_MEDIA_IMAGES,
    DEFAULT_BEAMER_MEDIA_IMAGE_KEY,
    sanitizeBeamerMediaImageKeys,
    sanitizeWerbungImageKeys,
    STATIC_IMAGE_KEY_CONFIG_KEY,
    WERBUNG_DISPLAY_MODE,
    WERBUNG_IMAGE_KEYS_CONFIG_KEY
} from '../utils/beamerMedia';

const NEXT_MATCHES_DISPLAY_MODE = 'next_matches';

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
    {value: 'next_matches', label: 'Nächste Spiele'},
    {value: 'timer_only', label: 'Nur Timer'},
    {value: 'group_tables', label: 'Gruppenstand'},
    {value: 'static_image', label: 'Statisches Bild'},
    {value: 'werbung', label: 'Werbung'}
];

const BEAMER_MODES = [
    {value: 'group_tables', label: 'Group Tables', displayState: 'group_tables'},
    {value: 'during_game', label: 'Matches with Timer', displayState: 'during_game'},
    {value: 'next_matches', label: 'Next Matches', displayState: 'between_games',
        configDisplayMode: NEXT_MATCHES_DISPLAY_MODE},
    {value: 'timer_only', label: 'Timer Only', displayState: 'during_game', configDisplayMode: 'timer_only'},
    {value: 'between_games', label: 'Matches Only', displayState: 'between_games'},
    {value: 'static_image', label: 'Static Image', displayState: 'static_image'},
    {value: 'werbung', label: 'Werbung', displayState: 'static_image', configDisplayMode: WERBUNG_DISPLAY_MODE}
];

const BEAMER_MATCH_STATES = [
    {value: '', label: 'Alle Status'},
    {value: 'in_progress', label: 'Laufend'},
    {value: 'not_started', label: 'Nicht gestartet'},
    {value: 'finished', label: 'Beendet'}
];

const TAB_IDS = ['timer', 'beamer', 'starts', 'scores', 'checklists', 'teams', 'history', 'settings'];
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
    const configDisplayMode = beamer.config && beamer.config.display_mode;
    if (configDisplayMode) {
        const configMode = BEAMER_MODES.find(item => item.configDisplayMode === configDisplayMode);
        if (configMode) {
            return configMode.value;
        }
    }

    const mode = BEAMER_MODES.find(item => item.displayState === beamer.display_state && !item.configDisplayMode);
    return mode ? mode.value : 'during_game';
}

function beamerModeLabel(value) {
    const mode = BEAMER_MODES.find(item => item.value === value);
    return mode ? mode.label : value;
}

function beamerDisplayStateFor(beamer) {
    if (beamer.config && beamer.config.display_mode === 'timer_only') {
        return 'timer_only';
    }
    if (beamer.config && beamer.config.display_mode === NEXT_MATCHES_DISPLAY_MODE) {
        return 'next_matches';
    }
    if (beamer.config && beamer.config.display_mode === WERBUNG_DISPLAY_MODE) {
        return 'werbung';
    }
    return beamer.display_state;
}

function compareBeamersByName(left, right) {
    const nameResult = (left.name || '').localeCompare(right.name || '', 'de', {
        numeric: true,
        sensitivity: 'base'
    });
    if (nameResult !== 0) {
        return nameResult;
    }
    return String(left.id || '').localeCompare(String(right.id || ''), 'de', {numeric: true});
}

function sortBeamersByName(beamers) {
    return (beamers || []).slice().sort(compareBeamersByName);
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

function soundEffectCommand(action, soundKey = null) {
    const command = {
        action,
        id: Date.now() + '-' + Math.random().toString(36).slice(2)
    };
    if (soundKey) {
        command.sound_key = soundKey;
    }
    return command;
}

export class MissionControl extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            activeTab: 'timer',
            search: '',
            actionRunning: null,
            transactionLogEntries: [],
            transactionLogLoaded: false,
            transactionLogLoading: false,
            transactionLogErrorStatus: null,
            transactionLogErrorMessage: ''
        };
        this.searchInput = React.createRef();
        this.setActiveTab = this.setActiveTab.bind(this);
        this.setSearch = this.setSearch.bind(this);
        this.handleLocationChange = this.handleLocationChange.bind(this);
        this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
        this.focusSearch = this.focusSearch.bind(this);
        this.updateStickyOffset = this.updateStickyOffset.bind(this);
        this.startGroupMatches = this.startGroupMatches.bind(this);
        this.startStageMatches = this.startStageMatches.bind(this);
        this.onActionSuccess = this.onActionSuccess.bind(this);
        this.onActionError = this.onActionError.bind(this);
        this.handleTournamentChange = this.handleTournamentChange.bind(this);
        this.loadTransactionLogIfNeeded = this.loadTransactionLogIfNeeded.bind(this);
        this.reloadTransactionLog = this.reloadTransactionLog.bind(this);
        this.onTransactionLogSuccess = this.onTransactionLogSuccess.bind(this);
        this.onTransactionLogError = this.onTransactionLogError.bind(this);
    }

    componentDidMount() {
        const initialTab = tabFromLocation();
        if (initialTab) {
            this.setActiveTab(initialTab, false);
        }
        window.addEventListener('popstate', this.handleLocationChange);
        window.addEventListener('hashchange', this.handleLocationChange);
        window.addEventListener('keydown', this.handleGlobalKeyDown);
        window.addEventListener('resize', this.updateStickyOffset);
        this.updateStickyOffset();
        const navbar = document.querySelector('.navbar.sticky-top');
        if (navbar && typeof window.ResizeObserver === 'function') {
            this.navbarResizeObserver = new window.ResizeObserver(this.updateStickyOffset);
            this.navbarResizeObserver.observe(navbar);
        }
    }

    componentDidUpdate(prevProps) {
        this.updateStickyOffset();
        if (prevProps.tournament.id !== this.props.tournament.id) {
            this.setState({
                transactionLogEntries: [],
                transactionLogLoaded: false,
                transactionLogLoading: false,
                transactionLogErrorStatus: null,
                transactionLogErrorMessage: ''
            }, () => {
                if (this.state.activeTab === 'history') {
                    this.loadTransactionLogIfNeeded();
                }
            });
        }
        this.handleLocationChange();
    }

    componentWillUnmount() {
        window.removeEventListener('popstate', this.handleLocationChange);
        window.removeEventListener('hashchange', this.handleLocationChange);
        window.removeEventListener('keydown', this.handleGlobalKeyDown);
        window.removeEventListener('resize', this.updateStickyOffset);
        if (this.navbarResizeObserver) {
            this.navbarResizeObserver.disconnect();
            this.navbarResizeObserver = null;
        }
        document.documentElement.style.removeProperty('--mission-control-navbar-offset');
    }

    setActiveTab(tab, updateUrl = true, callback = null) {
        if (TAB_IDS.indexOf(tab) === -1) {
            return;
        }

        this.setState({activeTab: tab}, () => {
            if (callback) {
                callback();
            }
            if (tab === 'history') {
                this.loadTransactionLogIfNeeded();
            }
        });
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

    updateStickyOffset() {
        const navbar = document.querySelector('.navbar.sticky-top');
        const height = navbar ? Math.ceil(navbar.getBoundingClientRect().height) : 0;
        document.documentElement.style.setProperty('--mission-control-navbar-offset', height + 'px');
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
        this.handleTournamentChange();
    }

    onActionError(errorBody) {
        notify.show(errorMessage(errorBody, 'Die Matches konnten nicht gestartet werden.'), 'error', 3000);
        this.setState({actionRunning: null});
        this.handleTournamentChange();
    }

    handleTournamentChange() {
        this.props.onTournamentChange();
        if (this.state.transactionLogLoaded && !this.state.transactionLogLoading) {
            this.reloadTransactionLog();
        }
    }

    loadTransactionLogIfNeeded() {
        if (this.state.transactionLogLoaded || this.state.transactionLogLoading) {
            return;
        }
        this.reloadTransactionLog();
    }

    reloadTransactionLog() {
        if (!this.props.tournament || !this.props.tournament.id || this.state.transactionLogLoading) {
            return;
        }
        this.setState({
            transactionLogLoading: true,
            transactionLogErrorStatus: null,
            transactionLogErrorMessage: ''
        });
        getTournamentTransactionLog(
            this.props.tournament.id,
            this.onTransactionLogSuccess,
            this.onTransactionLogError
        );
    }

    onTransactionLogSuccess(entries) {
        this.setState({
            transactionLogEntries: entries,
            transactionLogLoaded: true,
            transactionLogLoading: false,
            transactionLogErrorStatus: null,
            transactionLogErrorMessage: ''
        });
    }

    onTransactionLogError(errorBody, status) {
        this.setState({
            transactionLogLoading: false,
            transactionLogErrorStatus: status,
            transactionLogErrorMessage: errorMessage(errorBody, 'Verlauf konnte nicht geladen werden.')
        });
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
                                <NavLink href='#checklists' active={this.state.activeTab === 'checklists'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('checklists');
                                    }}>
                                    Checklisten
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink href='#history' active={this.state.activeTab === 'history'}
                                    onClick={event => {
                                        event.preventDefault();
                                        this.setActiveTab('history');
                                    }}>
                                    Verlauf
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
                                    onTournamentChange={this.handleTournamentChange}
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
                                    onTournamentChange={this.handleTournamentChange}
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
                                    onTournamentChange={this.handleTournamentChange}
                                />
                            </TabPane>

                            <TabPane tabId='checklists'>
                                <MissionChecklists
                                    tournamentId={tournament.id}
                                    teamActionLists={tournament.teamActionLists}
                                    disabled={!canControl}
                                    onSetTeamActionItemState={this.props.onSetTeamActionItemState}
                                    onCreateTeamActionList={this.props.onCreateTeamActionList}
                                />
                            </TabPane>

                            <TabPane tabId='history'>
                                <MissionTransactionLog
                                    entries={this.state.transactionLogEntries}
                                    loaded={this.state.transactionLogLoaded}
                                    loading={this.state.transactionLogLoading}
                                    errorStatus={this.state.transactionLogErrorStatus}
                                    errorMessage={this.state.transactionLogErrorMessage}
                                    onRefresh={this.reloadTransactionLog}
                                />
                            </TabPane>

                            <TabPane tabId='settings'>
                                <MissionTournamentSettings
                                    tournament={tournament}
                                    disabled={!canEditSettings}
                                    onTournamentChange={this.handleTournamentChange}
                                />
                            </TabPane>
                        </TabContent>
                    </CardBody>
                </Card>
            </div>
        );
    }
}

function MissionTransactionLog(props) {
    const entries = (Array.isArray(props.entries) ? props.entries : []).slice().sort((left, right) => {
        const leftSequence = Number(left.sequence || 0);
        const rightSequence = Number(right.sequence || 0);
        if (leftSequence !== rightSequence) {
            return leftSequence - rightSequence;
        }
        return Number(left.id || 0) - Number(right.id || 0);
    });
    const isInitialLoading = props.loading && !props.loaded;

    return (
        <section className='mission-control-section mission-transaction-log'
            data-testid='mission-transaction-log'>
            <div className='mission-transaction-log-header'>
                <div>
                    <h3 className='h5 mission-pane-heading mb-1'>
                        <FaHistory aria-hidden='true' /> Verlauf
                    </h3>
                    <div className='text-muted'>
                        Chronologischer Turnierverlauf für Owner, sortiert nach Sequenz.
                    </div>
                </div>
                <Button outline color='secondary'
                    disabled={props.loading}
                    data-testid='mission-transaction-log-refresh'
                    onClick={props.onRefresh}>
                    <FaSyncAlt aria-hidden='true' /> {props.loading ? 'Lädt...' : 'Aktualisieren'}
                </Button>
            </div>

            {!props.loaded && !props.loading && !props.errorMessage &&
                <Alert color='light' className='mb-0' data-testid='mission-transaction-log-idle'>
                    Verlauf wird erst beim Öffnen dieses Tabs geladen.
                </Alert>}

            {isInitialLoading &&
                <Alert color='info' className='mb-0' data-testid='mission-transaction-log-loading'>
                    Verlauf wird geladen...
                </Alert>}

            {props.errorMessage &&
                <Alert color='danger' className='mb-3' data-testid='mission-transaction-log-error'>
                    {transactionLogErrorMessage(props.errorStatus, props.errorMessage)}
                </Alert>}

            {props.loaded && entries.length === 0 && !props.errorMessage &&
                <Alert color='light' className='mb-0' data-testid='mission-transaction-log-empty'>
                    Noch keine Verlaufseinträge vorhanden.
                </Alert>}

            {entries.length > 0 &&
                <ol className='mission-transaction-log-list'>
                    {entries.map(entry => (
                        <TransactionLogEntry entry={entry} key={entry.id || entry.sequence}/>
                    ))}
                </ol>}
        </section>
    );
}

function TransactionLogEntry(props) {
    const entry = props.entry || {};
    const userLabel = entry.user && entry.user.username ? entry.user.username : 'System';
    const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
    const chips = transactionMetadataChips(metadata);

    return (
        <li className='mission-transaction-log-entry' data-testid='mission-transaction-log-entry'>
            <div className='mission-transaction-log-entry-meta'>
                <Badge color='primary' pill data-testid='mission-transaction-log-sequence'>
                    #{entry.sequence}
                </Badge>
                <Badge color='light' className='mission-transaction-log-action'>
                    {entry.action || 'unknown'}
                </Badge>
                <span className='mission-transaction-log-detail'>
                    <FaUser aria-hidden='true' /> {userLabel}
                </span>
                <time className='mission-transaction-log-detail' dateTime={entry.created_at || ''}>
                    <FaClock aria-hidden='true' /> {formatTransactionLogTime(entry.created_at)}
                </time>
            </div>
            <div className='mission-transaction-log-message' data-testid='mission-transaction-log-message'>
                {entry.message || entry.action || 'Unbekannter Verlaufseintrag'}
            </div>
            {chips.length > 0 &&
                <div className='mission-transaction-log-chips' data-testid='mission-transaction-log-chips'>
                    {chips.map(chip => chip.href ?
                        <a href={chip.href} className='mission-transaction-log-chip' key={chip.key}>
                            {chip.label}
                        </a> :
                        <span className='mission-transaction-log-chip' key={chip.key}>
                            {chip.label}
                        </span>
                    )}
                </div>}
        </li>
    );
}

function transactionLogErrorMessage(status, fallback) {
    if (status === 401) {
        return 'Nicht eingeloggt.';
    }
    if (status === 403) {
        return 'Nur Turnier-Owner darf den Verlauf lesen.';
    }
    if (status === 404) {
        return 'Turnier nicht gefunden.';
    }
    return fallback;
}

function formatTransactionLogTime(value) {
    if (!value) {
        return 'Zeit unbekannt';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function transactionMetadataChips(metadata) {
    const chips = [];
    pushMetadataChip(chips, metadata.match_id, 'Match ', '#scores', 'match');
    pushMetadataChip(chips, metadata.stage_id, 'Stage ', null, 'stage');
    pushMetadataChip(chips, metadata.group_id, 'Gruppe ', null, 'group');
    appendIdListChips(chips, metadata.advanced_match_ids, 'Ziel-Match ', '#scores', 'advanced-match');
    pushMetadataChip(chips, metadata.team_id, 'Team ', '#teams', 'team-id');
    pushMetadataChip(chips, metadata.winner_team_id, 'Gewinner-Team ', '#teams', 'winner-team');
    appendIdListChips(chips, metadata.team_ids, 'Team ', '#teams', 'team-id');
    appendIdListChips(chips, metadata.advancing_team_ids, 'Team ', '#teams', 'advancing-team');
    appendTeamChips(chips, metadata.teams || metadata.advancing_teams);
    return chips;
}

function pushMetadataChip(chips, value, prefix, href, keyPrefix) {
    if (value === null || value === undefined || value === '') {
        return;
    }
    chips.push({
        key: keyPrefix + '-' + value,
        label: prefix + value,
        href
    });
}

function appendIdListChips(chips, values, prefix, href, keyPrefix) {
    if (!Array.isArray(values)) {
        return;
    }
    values.forEach(value => pushMetadataChip(chips, value, prefix, href, keyPrefix));
}

function appendTeamChips(chips, teams) {
    if (!Array.isArray(teams)) {
        return;
    }
    teams.forEach(team => {
        if (!team || team.id === null || team.id === undefined) {
            return;
        }
        chips.push({
            key: 'team-' + team.id,
            label: (team.name || 'Team') + ' #' + team.id,
            href: '#teams'
        });
    });
}

class MissionBeamer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            beamers: [],
            name: '',
            loading: false,
            savingById: {},
            selectionsById: {},
            mediaSelectionsById: {}
        };
        this.setName = this.setName.bind(this);
        this.reload = this.reload.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.updateMode = this.updateMode.bind(this);
        this.updateMatchSelection = this.updateMatchSelection.bind(this);
        this.updateStaticImageSelection = this.updateStaticImageSelection.bind(this);
        this.updateWerbungImageSelection = this.updateWerbungImageSelection.bind(this);
        this.updateTimerOnlyReason = this.updateTimerOnlyReason.bind(this);
        this.playSoundEffect = this.playSoundEffect.bind(this);
        this.stopSoundEffect = this.stopSoundEffect.bind(this);
        this.onError = this.onError.bind(this);
    }

    componentDidMount() {
        this.reload();
    }

    reload() {
        getBeamers(this.props.tournament.id,
            beamers => this.setState({
                beamers: sortBeamersByName(beamers),
                loading: false,
                savingById: {},
                selectionsById: {},
                mediaSelectionsById: {}
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

    setMediaSelection(beamerId, selection, callback) {
        this.setState(prev => ({
            mediaSelectionsById: Object.assign({}, prev.mediaSelectionsById, {
                [beamerId]: Object.assign({}, prev.mediaSelectionsById[beamerId] || {}, selection)
            })
        }), callback);
    }

    update(beamer, payload, successMessage = 'Beamer wurde aktualisiert.') {
        this.setBeamerSaving(beamer.id, true);
        updateBeamer(this.props.tournament.id, beamer.id, payload, () => {
            notify.show(successMessage, 'success', 2000);
            this.reload();
        }, errorBody => this.onError(errorBody, beamer.id));
    }

    updateMode(beamer, modeValue) {
        const mode = BEAMER_MODES.find(item => item.value === modeValue);
        if (!mode) {
            return;
        }
        const currentConfig = beamer.config || {};
        const config = Object.assign({}, currentConfig);
        if (mode.value === 'timer_only') {
            config.display_mode = 'timer_only';
            config.show_timer_reason = currentConfig.show_timer_reason !== false;
        } else if (mode.value === 'werbung') {
            config.display_mode = WERBUNG_DISPLAY_MODE;
            config[WERBUNG_IMAGE_KEYS_CONFIG_KEY] =
                sanitizeWerbungImageKeys(currentConfig[WERBUNG_IMAGE_KEYS_CONFIG_KEY]);
            if (config[WERBUNG_IMAGE_KEYS_CONFIG_KEY].length === 0) {
                config[WERBUNG_IMAGE_KEYS_CONFIG_KEY] = allBeamerMediaImageKeys();
            }
            delete config.show_timer_reason;
        } else if (mode.configDisplayMode) {
            config.display_mode = mode.configDisplayMode;
            delete config.show_timer_reason;
        } else {
            delete config.display_mode;
            delete config.show_timer_reason;
        }
        this.update(beamer, {
            display_state: mode.displayState,
            config
        });
    }

    updateMatchSelection(beamer, value) {
        const config = Object.assign({}, beamer.config || {}, {match_filter: value});
        if (beamerModeFor(beamer) !== 'next_matches') {
            delete config.display_mode;
        }
        delete config.show_timer_reason;
        this.update(beamer, {
            config
        });
    }

    updateStaticImageSelection(beamer, imageKeys) {
        const nextKeys = sanitizeBeamerMediaImageKeys(imageKeys);
        const config = Object.assign({}, beamer.config || {}, {
            [STATIC_IMAGE_KEY_CONFIG_KEY]: nextKeys[0] || DEFAULT_BEAMER_MEDIA_IMAGE_KEY
        });
        delete config.display_mode;
        delete config.show_timer_reason;
        this.setMediaSelection(beamer.id, {staticImageKeys: nextKeys}, () => {
            this.update(beamer, {
                display_state: 'static_image',
                config
            });
        });
    }

    updateWerbungImageSelection(beamer, imageKeys) {
        const currentConfig = beamer.config || {};
        const nextKeys = sanitizeWerbungImageKeys(imageKeys);
        const config = Object.assign({}, currentConfig, {
            display_mode: WERBUNG_DISPLAY_MODE,
            [WERBUNG_IMAGE_KEYS_CONFIG_KEY]: nextKeys
        });
        delete config.show_timer_reason;
        this.setMediaSelection(beamer.id, {werbungImageKeys: nextKeys}, () => {
            this.update(beamer, {
                display_state: 'static_image',
                config
            });
        });
    }

    updateTimerOnlyReason(beamer, checked) {
        const config = Object.assign({}, beamer.config || {}, {
            display_mode: 'timer_only',
            show_timer_reason: checked
        });
        this.setState(prev => ({
            selectionsById: Object.assign({}, prev.selectionsById, {[beamer.id]: checked})
        }), () => {
            this.update(beamer, {
                display_state: 'during_game',
                config
            });
        });
    }

    playSoundEffect(beamer, effect) {
        const config = Object.assign({}, beamer.config || {}, {
            sound_effect_command: soundEffectCommand('play', effect.key)
        });
        this.update(beamer, {config}, 'Sound wurde gesendet.');
    }

    stopSoundEffect(beamer) {
        const config = Object.assign({}, beamer.config || {}, {
            sound_effect_command: soundEffectCommand('stop')
        });
        this.update(beamer, {config}, 'Sound wurde gestoppt.');
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
                        const imageSelection = sanitizeBeamerMediaImageKeys([
                            config[STATIC_IMAGE_KEY_CONFIG_KEY] || DEFAULT_BEAMER_MEDIA_IMAGE_KEY
                        ])[0] || DEFAULT_BEAMER_MEDIA_IMAGE_KEY;
                        const mediaSelection = this.state.mediaSelectionsById[beamer.id] || {};
                        const staticImageKeys = mediaSelection.staticImageKeys || [imageSelection];
                        const werbungImageKeys = mediaSelection.werbungImageKeys || sanitizeWerbungImageKeys(
                            config[WERBUNG_IMAGE_KEYS_CONFIG_KEY]
                        );
                        const timerReasonSelection = this.state.selectionsById[beamer.id];
                        const showTimerReason = timerReasonSelection === undefined ?
                            config.show_timer_reason !== false :
                            timerReasonSelection;

                        return (
                            <div className='mission-beamer-card' key={beamer.id}
                                data-testid={'mission-beamer-card-' + beamer.id}>
                                <div className='mission-beamer-card-header'>
                                    <div>
                                        <div className='mission-beamer-name'>{beamer.name}</div>
                                        <div className='mission-beamer-current'>
                                            {beamerModeLabel(mode)} · {displayStateLabel(beamerDisplayStateFor(beamer))}
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

                                    {(mode === 'during_game' || mode === 'between_games' ||
                                        mode === 'next_matches') &&
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
                                        <BeamerMediaSelection
                                            images={BEAMER_MEDIA_IMAGES}
                                            label='Statisches Bild'
                                            type='radio'
                                            selectedKeys={staticImageKeys}
                                            disabled={disabled}
                                            idPrefix={'missionBeamerStaticImage' + beamer.id}
                                            name={'missionBeamerStaticImage' + beamer.id}
                                            testId={'mission-beamer-static-image-list-' + beamer.id}
                                            testIdPrefix={'mission-beamer-static-image-' + beamer.id + '-'}
                                            onChange={keys => this.updateStaticImageSelection(beamer, keys)}
                                        />}

                                    {mode === 'werbung' &&
                                        <React.Fragment>
                                            <BeamerMediaSelection
                                                images={BEAMER_MEDIA_IMAGES}
                                                label='Werbebilder'
                                                type='checkbox'
                                                selectedKeys={werbungImageKeys}
                                                disabled={disabled}
                                                idPrefix={'missionBeamerWerbungImage' + beamer.id}
                                                testId={'mission-beamer-werbung-checklist-' + beamer.id}
                                                testIdPrefix={'mission-beamer-werbung-image-' + beamer.id + '-'}
                                                onChange={keys => this.updateWerbungImageSelection(beamer, keys)}
                                            />
                                            {werbungImageKeys.length === 0 &&
                                                <Alert color='warning' className='mt-2 mb-0'>
                                                    Keine Bilder ausgewählt. Werbung zeigt nur Timer-Hinweis.
                                                </Alert>}
                                        </React.Fragment>}

                                    {mode === 'timer_only' &&
                                        <FormGroup check>
                                            <Input
                                                id={'missionBeamerTimerReason' + beamer.id}
                                                type='checkbox'
                                                checked={showTimerReason}
                                                disabled={disabled}
                                                data-testid={'mission-beamer-timer-reason-' + beamer.id}
                                                onChange={event => this.updateTimerOnlyReason(
                                                    beamer,
                                                    event.target.checked
                                                )}
                                            />
                                            <Label check for={'missionBeamerTimerReason' + beamer.id}>
                                                Timer-Grund anzeigen
                                            </Label>
                                        </FormGroup>}

                                    <div className='mission-beamer-soundboard'
                                        data-testid={'mission-beamer-soundboard-' + beamer.id}>
                                        <div className='mission-beamer-soundboard-label'>Soundboard</div>
                                        <div className='mission-beamer-sounds'>
                                            {BEAMER_SOUND_EFFECTS.map(effect => (
                                                <Button outline color='secondary'
                                                    key={effect.key}
                                                    disabled={disabled}
                                                    data-testid={'mission-sound-play-' + beamer.id + '-' + effect.key}
                                                    onClick={() => this.playSoundEffect(beamer, effect)}>
                                                    <FaPlay aria-hidden='true' /> {effect.label}
                                                </Button>
                                            ))}
                                            <Button outline color='danger'
                                                disabled={disabled}
                                                data-testid={'mission-sound-stop-' + beamer.id}
                                                onClick={() => this.stopSoundEffect(beamer)}>
                                                <FaStop aria-hidden='true' /> Stop
                                            </Button>
                                        </div>
                                    </div>
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

class MissionChecklists extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pendingByItemKey: {},
            errorMessage: ''
        };
        this.onChange = this.onChange.bind(this);
    }

    onChange(list, item, event) {
        if (this.props.disabled || typeof this.props.onSetTeamActionItemState !== 'function') {
            return;
        }

        const nextCompleted = event.target.checked === true;
        const pendingKey = buildTeamActionItemPendingKey(list.key, item);

        this.setState(prevState => ({
            pendingByItemKey: Object.assign({}, prevState.pendingByItemKey, {[pendingKey]: true}),
            errorMessage: ''
        }));

        this.props.onSetTeamActionItemState({
            tournamentId: this.props.tournamentId,
            listKey: list.key,
            teamId: item.team ? item.team.id : null,
            itemId: item.id,
            completed: nextCompleted,
            onSuccess: () => {
                this.setState(prevState => ({
                    pendingByItemKey: Object.assign({}, prevState.pendingByItemKey, {[pendingKey]: false})
                }));
            },
            onError: status => {
                this.setState(prevState => ({
                    pendingByItemKey: Object.assign({}, prevState.pendingByItemKey, {[pendingKey]: false}),
                    errorMessage: buildTeamActionListsErrorMessage(status)
                }));
            }
        });
    }

    render() {
        const teamActionLists = Array.isArray(this.props.teamActionLists) ? this.props.teamActionLists : [];
        const canMutate = !this.props.disabled;

        return (<section className='mission-control-section' data-testid='mission-checklists-control'>
            <h3 className='h5'>Checklisten</h3>
            <p className='text-muted mb-3'>
                Team-Checklisten werden live synchronisiert, zum Beispiel für Token, Unterlagen oder Material.
            </p>
            {canMutate &&
                <CreateTeamActionListForm
                    tournamentId={this.props.tournamentId}
                    onCreateTeamActionList={this.props.onCreateTeamActionList}
                />}
            {!canMutate &&
                <Alert color='secondary' className='mb-3'>
                    Follower-Modus aktiv. Checklisten sind gesperrt.
                </Alert>}
            {this.state.errorMessage &&
                <Alert color='danger' className='mb-3'>
                    {this.state.errorMessage}
                </Alert>}
            {teamActionLists.length === 0 &&
                <Alert color='light' className='mb-0'>
                    Keine Checklisten verfügbar.
                </Alert>}
            {teamActionLists.map(list => (
                <div key={list.id} className='mission-control-panel mb-3' data-testid='team-action-list-card'>
                    <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
                        <h4 className='h6 mb-0'>{list.name}</h4>
                        <Badge color='info' pill>{list.key}</Badge>
                    </div>
                    <div className='text-muted small mb-2'>{list.actionName}</div>
                    {list.teamActionItems.map(item => {
                        const pendingKey = buildTeamActionItemPendingKey(list.key, item);
                        const disabled = !canMutate || this.state.pendingByItemKey[pendingKey] === true;
                        return (
                            <div key={item.id || pendingKey} className='form-check mb-2'>
                                <input
                                    id={'team-action-item-' + pendingKey}
                                    className='form-check-input'
                                    type='checkbox'
                                    checked={item.completed === true}
                                    disabled={disabled}
                                    onChange={event => this.onChange(list, item, event)}
                                />
                                <label className='form-check-label' htmlFor={'team-action-item-' + pendingKey}>
                                    {item.team ? <TeamName name={item.team.name} inline /> : 'Unbekanntes Team'}
                                    {item.completedAt &&
                                        <span className='text-muted ms-2'>
                                            ({formatTeamActionCompletedAt(item.completedAt)})
                                        </span>}
                                </label>
                            </div>
                        );
                    })}
                </div>
            ))}
        </section>);
    }
}

class CreateTeamActionListForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: '',
            key: '',
            actionName: '',
            source: 'group_stage_survivors',
            creating: false,
            errorMessage: ''
        };
        this.onCreate = this.onCreate.bind(this);
    }

    onCreate(event) {
        event.preventDefault();
        if (!this.state.name.trim() || !this.state.key.trim() || !this.state.actionName.trim()) {
            this.setState({errorMessage: 'Bitte Name, Schlüssel und Aktionsname ausfüllen.'});
            return;
        }

        this.setState({creating: true, errorMessage: ''});
        this.props.onCreateTeamActionList({
            tournamentId: this.props.tournamentId,
            payload: {
                name: this.state.name.trim(),
                key: this.state.key.trim(),
                action_name: this.state.actionName.trim(),
                source: this.state.source
            },
            onSuccess: () => {
                this.setState({
                    name: '',
                    key: '',
                    actionName: '',
                    creating: false,
                    errorMessage: ''
                });
            },
            onError: status => {
                this.setState({
                    creating: false,
                    errorMessage: buildTeamActionListCreateErrorMessage(status)
                });
            }
        });
    }

    render() {
        return (<form className='mission-control-panel mb-3' onSubmit={this.onCreate}
            data-testid='create-team-action-list-form'>
            <h4 className='h6 mb-3'>Neue Checkliste anlegen</h4>
            {this.state.errorMessage &&
                <Alert color='danger' className='mb-3'>
                    {this.state.errorMessage}
                </Alert>}
            <Row className='g-2'>
                <Col xs='12' md='4'>
                    <Label className='mb-1' for='team-action-list-name'>Name</Label>
                    <Input id='team-action-list-name'
                        value={this.state.name}
                        onChange={event => this.setState({name: event.target.value})}
                        placeholder='Playoff-Tokens einsammeln' />
                </Col>
                <Col xs='12' md='4'>
                    <Label className='mb-1' for='team-action-list-key'>Schlüssel</Label>
                    <Input id='team-action-list-key'
                        value={this.state.key}
                        onChange={event => this.setState({key: event.target.value})}
                        placeholder='playoff_tokens_einsammeln' />
                </Col>
                <Col xs='12' md='4'>
                    <Label className='mb-1' for='team-action-list-action-name'>Aktionsname</Label>
                    <Input id='team-action-list-action-name'
                        value={this.state.actionName}
                        onChange={event => this.setState({actionName: event.target.value})}
                        placeholder='Token abgegeben' />
                </Col>
                <Col xs='12' md='6'>
                    <Label className='mb-1' for='team-action-list-source'>Quelle</Label>
                    <Input id='team-action-list-source' type='select'
                        value={this.state.source}
                        onChange={event => this.setState({source: event.target.value})}>
                        <option value='group_stage_survivors'>Teams aus der Gruppenphase (Playoff-Teilnehmer)</option>
                    </Input>
                </Col>
                <Col xs='12' md='6' className='d-flex align-items-end'>
                    <Button type='submit' color='primary' className='w-100'
                        disabled={this.state.creating}
                        data-testid='create-team-action-list-button'>
                        {this.state.creating ? 'Erstellt...' : 'Checkliste anlegen'}
                    </Button>
                </Col>
            </Row>
        </form>);
    }
}

function buildTeamActionItemPendingKey(listKey, item) {
    const teamId = item.team ? item.team.id : 'unknown-team';
    return listKey + '-' + teamId;
}

function formatTeamActionCompletedAt(value) {
    if (!(value instanceof Date)) {
        return '';
    }
    return value.toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildTeamActionListsErrorMessage(status) {
    if (status === 401) {
        return 'Nicht eingeloggt.';
    }
    if (status === 403) {
        return 'Nur Turnier-Owner darf Team-Action-Items ändern.';
    }
    if (status === 404) {
        return 'Team-Action-Item nicht gefunden.';
    }
    if (status === 423) {
        return 'Follower-Modus: Änderungen gesperrt.';
    }
    return 'Änderung fehlgeschlagen. Bitte erneut versuchen.';
}

function buildTeamActionListCreateErrorMessage(status) {
    if (status === 401) {
        return 'Nicht eingeloggt.';
    }
    if (status === 403) {
        return 'Nur Turnier-Owner darf Checklisten anlegen.';
    }
    if (status === 404) {
        return 'Erstellen nicht verfügbar.';
    }
    if (status === 409) {
        return 'Schlüssel bereits vergeben.';
    }
    if (status === 422) {
        return 'Eingaben ungültig oder Schlüssel bereits vergeben.';
    }
    if (status === 423) {
        return 'Follower-Modus: Erstellen gesperrt.';
    }
    return 'Checkliste konnte nicht angelegt werden.';
}

class MissionTimer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            minutes: 20,
            seconds: '00',
            timestamp: '',
            timerReason: '',
            timerReasonText: '',
            running: false
        };
        this.setMinutes = this.setMinutes.bind(this);
        this.setSeconds = this.setSeconds.bind(this);
        this.setTimestamp = this.setTimestamp.bind(this);
        this.setTimerReason = this.setTimerReason.bind(this);
        this.setTimerReasonText = this.setTimerReasonText.bind(this);
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

    setTimerReason(event) {
        this.setState({timerReason: event.target.value});
    }

    setTimerReasonText(event) {
        this.setState({timerReasonText: event.target.value});
    }

    reasonTextMissing() {
        return this.state.timerReason === TIMER_REASON_CUSTOM &&
            !this.state.timerReasonText.trim();
    }

    canStartTimer() {
        return !this.props.disabled && !this.state.running && !this.reasonTextMissing();
    }

    timerReasonPayload() {
        if (!this.state.timerReason) {
            return {};
        }

        if (this.state.timerReason === TIMER_REASON_CUSTOM) {
            return {
                timer_reason: TIMER_REASON_CUSTOM,
                timer_reason_text: this.state.timerReasonText.trim()
            };
        }

        return {timer_reason: this.state.timerReason};
    }

    setCountdownMinutes() {
        if (!this.canStartTimer()) {
            return;
        }
        const minutes = parseInt(this.state.minutes || 0, 10);
        const remainderSeconds = parseInt(this.state.seconds || 0, 10);
        const seconds = (minutes * 60) + remainderSeconds;
        this.patchTimer({timestamp_seconds: seconds, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    setQuickCountdown(seconds) {
        if (!this.canStartTimer()) {
            return;
        }
        this.patchTimer({timestamp_seconds: seconds, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    setCountdownTimestamp() {
        if (!this.canStartTimer() || !this.state.timestamp) {
            return;
        }
        this.patchTimer({timestamp: this.state.timestamp, timer_mode: TIMER_MODE_COUNTDOWN});
    }

    startCountup() {
        if (!this.canStartTimer()) {
            return;
        }
        this.patchTimer({timer_mode: TIMER_MODE_COUNTUP});
    }

    clearTimer() {
        if (this.props.disabled || this.state.running) {
            return;
        }
        this.patchTimer({clear_timer: true});
    }

    patchTimer(payload) {
        this.setState({running: true});
        const requestPayload = payload.clear_timer ?
            payload :
            Object.assign({}, payload, this.timerReasonPayload());
        setTournamentTimer(this.props.tournamentId, requestPayload, this.onSuccess, this.onError);
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
        const currentTimerReason = this.props.timerState && this.props.timerState.mode ?
            getTimerReasonLabel(this.props.timerState) :
            null;
        const reasonTextMissing = this.reasonTextMissing();
        const canStart = this.canStartTimer();
        return (
            <section className='mission-control-section mission-pane-timer' data-testid='mission-timer-control'>
                <div className='mission-current-timer mb-3'>
                    <div>
                        <h3 className='h5 mission-pane-heading mb-1'>Countdown starten</h3>
                        <span className='text-muted small'>{currentTimer}</span>
                        {currentTimerReason &&
                            <div className='text-muted small' data-testid='mission-current-timer-reason'>
                                {currentTimerReason}
                            </div>}
                    </div>
                    <div className='mission-current-timer-display' data-testid='mission-current-timer-display'>
                        <Timer timerState={this.props.timerState} />
                    </div>
                </div>
                <div className='mission-control-panel mb-3' data-testid='mission-timer-reason-control'>
                    <h4>Timer-Grund</h4>
                    <p>Optional. Ohne Auswahl bleibt der Standard Spielende.</p>
                    <Row className='g-2'>
                        <Col md='4'>
                            <Label for='missionTimerReason'>Grund</Label>
                            <Input id='missionTimerReason' type='select'
                                value={this.state.timerReason}
                                data-testid='mission-timer-reason-select'
                                disabled={this.props.disabled || this.state.running}
                                onChange={this.setTimerReason}>
                                <option value=''>Standard</option>
                                {TIMER_REASON_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Input>
                        </Col>
                        {this.state.timerReason === TIMER_REASON_CUSTOM &&
                            <Col md='8'>
                                <Label for='missionTimerReasonText'>Eigener Text</Label>
                                <Input id='missionTimerReasonText' type='text'
                                    value={this.state.timerReasonText}
                                    invalid={reasonTextMissing}
                                    data-testid='mission-timer-reason-text'
                                    disabled={this.props.disabled || this.state.running}
                                    onChange={this.setTimerReasonText}/>
                            </Col>}
                    </Row>
                </div>
                <Row className='g-3'>
                    <Col lg='4'>
                        <div className='mission-control-panel'>
                            <h4>Schnellstart</h4>
                            <p>Starte einen Countdown mit vordefinierter Dauer.</p>
                            <div className='mission-quick-grid'>
                                <button type='button' className='mission-quick-button'
                                    disabled={!canStart}
                                    data-testid='mission-timer-quick-20s'
                                    onClick={() => this.setQuickCountdown(20)}>
                                    <strong>00:20</strong>
                                    <span>20 Sekunden</span>
                                </button>
                                <button type='button' className='mission-quick-button'
                                    disabled={!canStart}
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
                                disabled={!canStart}>
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
                                disabled={!canStart || !this.state.timestamp}>
                                Countdown bis Zeitpunkt starten
                            </Button>
                        </form>
                    </Col>
                </Row>

                <div className='mission-control-panel mt-3'>
                    <h3 className='h5 mission-pane-heading'>Countup starten</h3>
                    <p>Starte einen aufwärtszählenden Timer.</p>
                    <Button color='info' className='mission-countup-button'
                        disabled={!canStart}
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

function isPlayoffStageFinished(stage) {
    if (stage.state === 'finished') {
        return true;
    }
    return stage.matches.length > 0 && stage.matches.every(match => match.state === 'finished');
}

function missionStageRowsForGroupStage(groupStage) {
    return groupStage.groups.map(group => ({
        key: 'group-' + group.id,
        name: 'Gruppe ' + group.number,
        group: group,
        matches: group.matches
    }));
}

function missionScoreSections(tournament) {
    const sections = [];
    if (tournament.groupStage) {
        sections.push({
            key: 'group-stage',
            name: 'Gruppenphase',
            finished: tournament.groupStage.state === 'finished',
            rows: missionStageRowsForGroupStage(tournament.groupStage)
        });
    }
    tournament.playoffStages.forEach(stage => {
        sections.push({
            key: 'stage-' + stage.id,
            name: stageName(stage.level),
            finished: isPlayoffStageFinished(stage),
            rows: [{
                key: 'stage-' + stage.id,
                name: stageName(stage.level),
                matches: stage.matches
            }]
        });
    });
    return sections;
}

function missionMatchPassesSearch(title, match, search) {
    if (!search) {
        return true;
    }
    const haystack = [
        title,
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
}

function missionStageMatches(title, matches, search) {
    const normalizedSearch = search.trim().toLowerCase();
    return matches
        .filter(match => missionMatchPassesSearch(title, match, normalizedSearch))
        .sort(sortMatchesByPositionAscending());
}

function missionSectionMatchCount(rows, search) {
    return rows.reduce((total, row) => total + missionStageMatches(row.name, row.matches, search).length, 0);
}

function MissionMatches(props) {
    const sections = missionScoreSections(props.tournament);
    const activeSections = sections.filter(section => !section.finished);
    const finishedSections = sections.filter(section => section.finished);

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
            {activeSections.map(section => (
                <React.Fragment key={section.key}>
                    {section.rows.map(row => (
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
                </React.Fragment>
            ))}
            {finishedSections.map(section => (
                <MissionFinishedStageDetails
                    key={section.key}
                    stageKey={section.key}
                    title={section.name}
                    rows={section.rows}
                    search={props.search}
                    disabled={props.disabled}
                    onTournamentChange={props.onTournamentChange}
                />
            ))}
        </section>
    );
}

function MissionFinishedStageDetails(props) {
    const matchCount = missionSectionMatchCount(props.rows, props.search);
    if (matchCount === 0) {
        return null;
    }

    return (
        <details className='mission-finished-stage-details'
            data-testid={'mission-finished-stage-' + props.stageKey}>
            <summary className='mission-finished-stage-summary' data-testid='mission-finished-stage-summary'>
                <FaChevronRight className='mission-finished-stage-chevron'
                    data-testid='mission-finished-stage-chevron' aria-hidden='true' />
                <span className='mission-finished-stage-title'>{props.title}</span>
                <Badge color='light' className='mission-stage-badge'>{matchCount} Matches</Badge>
                <span className='mission-finished-stage-state'>abgeschlossen</span>
            </summary>
            <div className='mission-finished-stage-body'>
                {props.rows.map(row => (
                    <MissionStageBlock
                        key={row.key}
                        title={row.name}
                        group={row.group}
                        matches={row.matches}
                        search={props.search}
                        disabled={props.disabled}
                        onTournamentChange={props.onTournamentChange}
                        nested
                    />
                ))}
            </div>
        </details>
    );
}

function MissionStageBlock(props) {
    const matches = missionStageMatches(props.title, props.matches, props.search);

    if (matches.length === 0) {
        return null;
    }

    const className = 'mission-match-stage' + (props.nested ? ' mission-match-stage-nested' : '');

    return (
        <div className={className} data-testid='mission-stage-block' data-stage-title={props.title}>
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
        <Table size='sm' bordered className='mission-control-group-table' data-testid='mission-group-table'>
            <colgroup>
                <col className='mission-control-group-rank-column' />
                <col className='mission-control-group-team-column' />
                <col className='mission-control-group-stat-column' />
                <col className='mission-control-group-stat-column' />
                <col className='mission-control-group-stat-column' />
            </colgroup>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th><span title='Punkte'>Pkt.</span></th>
                    <th><span title='Becherdifferenz'>Dif.</span></th>
                    <th><span title='Getroffene Becher (Geworfen)'>Gew.</span></th>
                </tr>
            </thead>
            <tbody>
                {props.group.scores.map(score => (
                    <tr key={score.id}>
                        <td>{score.position}</td>
                        <td><TeamName name={score.team.name}/></td>
                        <td>{score.group_points}</td>
                        <td>{score.difference_in_points}</td>
                        <td>{score.scored_points}</td>
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
        this.stopMatch = this.stopMatch.bind(this);
        this.submit = this.submit.bind(this);
        this.onFormKeyDown = this.onFormKeyDown.bind(this);
        this.startUnlockHold = this.startUnlockHold.bind(this);
        this.cancelUnlockHold = this.cancelUnlockHold.bind(this);
        this.updateUnlockHoldProgress = this.updateUnlockHoldProgress.bind(this);
        this.cancelUnlockReset = this.cancelUnlockReset.bind(this);
        this.updateUnlockResetProgress = this.updateUnlockResetProgress.bind(this);
        this.onUnlockKeyDown = this.onUnlockKeyDown.bind(this);
        this.onUnlockKeyUp = this.onUnlockKeyUp.bind(this);
        this.unlockTemporarily = this.unlockTemporarily.bind(this);
        this.onStartSuccess = this.onStartSuccess.bind(this);
        this.onStartError = this.onStartError.bind(this);
        this.onStopSuccess = this.onStopSuccess.bind(this);
        this.onStopError = this.onStopError.bind(this);
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
        this.cancelUnlockReset(false);
    }

    componentDidUpdate(prevProps) {
        const scoreChanged = scoreFor(prevProps.match, 'team1') !== scoreFor(this.props.match, 'team1') ||
            scoreFor(prevProps.match, 'team2') !== scoreFor(this.props.match, 'team2');
        if (prevProps.match.id !== this.props.match.id || prevProps.match.state !== this.props.match.state) {
            this.cancelUnlockHold(false);
            this.cancelUnlockReset(false);
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

    stopMatch() {
        this.setState({running: true});
        stopMatch(this.props.match.id, this.onStopSuccess, this.onStopError);
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
        if (resetState !== false && this.state.temporaryUnlocked && this.state.unlockHolding) {
            this.setState({unlockHolding: false});
        } else if (resetState !== false && !this.state.temporaryUnlocked &&
            (this.state.unlockHolding || this.state.unlockHoldProgress !== 0)) {
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

    cancelUnlockReset(resetState = true) {
        if (this.unlockResetTimer) {
            window.clearTimeout(this.unlockResetTimer);
            this.unlockResetTimer = null;
        }
        if (this.unlockResetFrame) {
            window.cancelAnimationFrame(this.unlockResetFrame);
            this.unlockResetFrame = null;
        }
        this.unlockResetStartedAt = null;
        if (resetState !== false && (this.state.temporaryUnlocked || this.state.unlockHoldProgress !== 0)) {
            this.setState({temporaryUnlocked: false, unlockHoldProgress: 0});
        }
    }

    updateUnlockResetProgress(timestamp) {
        if (!this.unlockResetTimer || !this.unlockResetStartedAt) {
            return;
        }

        const elapsed = timestamp - this.unlockResetStartedAt;
        const progress = Math.max(0, 1 - (elapsed / UNLOCK_RESET_MS));
        this.setState({unlockHoldProgress: progress});
        if (progress > 0) {
            this.unlockResetFrame = window.requestAnimationFrame(this.updateUnlockResetProgress);
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
        this.cancelUnlockReset(false);
        this.unlockResetStartedAt = window.performance.now();
        this.setState({temporaryUnlocked: true, unlockHolding: false, unlockHoldProgress: 1});
        this.unlockResetTimer = window.setTimeout(() => {
            this.unlockResetTimer = null;
            if (this.unlockResetFrame) {
                window.cancelAnimationFrame(this.unlockResetFrame);
                this.unlockResetFrame = null;
            }
            this.unlockResetStartedAt = null;
            this.setState({temporaryUnlocked: false, unlockHoldProgress: 0});
        }, UNLOCK_RESET_MS);
        this.unlockResetFrame = window.requestAnimationFrame(this.updateUnlockResetProgress);
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

    onStopSuccess() {
        notify.show('Match wurde gestoppt.', 'success', 2000);
        this.setState({running: false, live: false});
        this.props.onTournamentChange();
    }

    onStopError() {
        notify.show('Match konnte nicht gestoppt werden.', 'error', 3000);
        this.setState({running: false});
    }

    onScoresSuccess() {
        if (this.submittedLive || this.state.temporaryUnlocked) {
            notify.show('Score wurde gespeichert.', 'success', 2000);
            this.cancelUnlockReset(false);
            this.setState({temporaryUnlocked: false, unlockHoldProgress: 0, running: false});
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
        const canStop = match.state === 'in_progress' && !this.props.disabled;
        const showUnlockButton = match.state === 'finished' && !this.props.disabled;
        const showStaticLock = match.state === 'not_started' || match.state === 'not_ready' ||
            (match.state === 'finished' && this.props.disabled);
        const unlockProgress = Math.round(this.state.unlockHoldProgress * 100);
        const stateClass = matchStateClass(match.state);
        const stateLabel = match.state === 'in_progress' ? 'Live' : matchStateLabel(match.state);
        return (
            <form onSubmit={this.submit} className={'mission-control-match mission-start-card ' + stateClass}
                onKeyDown={this.onFormKeyDown}
                data-match-id={match.id}
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
                            className={'mission-lock-button' +
                                (this.state.unlockHolding ? ' is-holding' : '') +
                                (this.state.temporaryUnlocked ? ' is-unlocked' : '')}
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
                    {canStop &&
                        <Button color='outline-danger' size='sm' type='button'
                            data-testid='mission-match-stop'
                            disabled={this.state.running} onClick={this.stopMatch}>
                            Stop
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
