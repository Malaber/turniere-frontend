import React from 'react';
import {
    Alert, Badge, Button, Card, CardBody, Col, Collapse, FormGroup, Input, Label, Row, Table
} from 'reactstrap';
import {notify} from 'react-notify-toast';
import {
    endMatch,
    setTournamentTimer,
    startMatch,
    startNextGroupMatches,
    startNextStageMatches,
    submitDeciderMatchScores,
    submitMatchScores,
    updateTeamName
} from '../api';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {TIMER_MODE_COUNTDOWN, TIMER_MODE_COUNTUP} from '../utils/timerState';

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

export class MissionControl extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            open: false,
            search: '',
            actionRunning: null
        };
        this.toggleOpen = this.toggleOpen.bind(this);
        this.setSearch = this.setSearch.bind(this);
        this.startGroupMatches = this.startGroupMatches.bind(this);
        this.startStageMatches = this.startStageMatches.bind(this);
        this.onActionSuccess = this.onActionSuccess.bind(this);
        this.onActionError = this.onActionError.bind(this);
    }

    toggleOpen() {
        this.setState(prev => ({open: !prev.open}));
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

        if (!isOwner || !isSignedIn) {
            return null;
        }

        return (
            <div className='container mb-4' data-testid='mission-control'>
                <Card className='mission-control-card'>
                    <CardBody>
                        <div className='d-flex align-items-center justify-content-between flex-wrap gap-2'>
                            <div>
                                <h2 className='h4 mb-1'>Mission Control</h2>
                                <div className='text-muted'>Live-Steuerung fuer Turnierleitung</div>
                            </div>
                            <Button color='dark' outline onClick={this.toggleOpen} data-testid='mission-control-toggle'>
                                {this.state.open ? 'Ausblenden' : 'Oeffnen'}
                            </Button>
                        </div>
                        {!canControl &&
                            <Alert color='warning' className='mt-3 mb-0'>
                                Follower-Modus aktiv. Live-Aktionen sind gesperrt.
                            </Alert>}
                        <Collapse isOpen={this.state.open}>
                            <div className='mission-control-toolbar mt-3'>
                                <Input
                                    type='search'
                                    value={this.state.search}
                                    onChange={this.setSearch}
                                    placeholder='Teams suchen'
                                    data-testid='mission-control-search'
                                />
                            </div>
                            <MissionTimer
                                tournamentId={tournament.id}
                                timerState={tournament.timerState}
                                disabled={!canControl}
                                onTournamentChange={this.props.onTournamentChange}
                            />
                            <MissionNextMatches
                                tournament={tournament}
                                disabled={!canControl}
                                actionRunning={this.state.actionRunning}
                                onStartGroupMatches={this.startGroupMatches}
                                onStartStageMatches={this.startStageMatches}
                            />
                            <MissionMatches
                                tournament={tournament}
                                search={this.state.search}
                                disabled={!canControl}
                                onTournamentChange={this.props.onTournamentChange}
                            />
                            <MissionTeams
                                teams={tournament.teams}
                                search={this.state.search}
                                disabled={!canControl}
                                onTournamentChange={this.props.onTournamentChange}
                            />
                        </Collapse>
                    </CardBody>
                </Card>
            </div>
        );
    }
}

class MissionTimer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {minutes: 15, timestamp: '', running: false};
        this.setMinutes = this.setMinutes.bind(this);
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

    setTimestamp(event) {
        this.setState({timestamp: event.target.value});
    }

    setCountdownMinutes() {
        const seconds = parseInt(this.state.minutes, 10) * 60;
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
            <section className='mission-control-section'>
                <h3 className='h5'>Timer</h3>
                <div className='text-muted mb-2'>{currentTimer}</div>
                <Row className='g-2 align-items-end'>
                    <Col md='3'>
                        <Label for='missionTimerMinutes'>Minuten</Label>
                        <Input id='missionTimerMinutes' type='number' min='1'
                            value={this.state.minutes} onChange={this.setMinutes}/>
                    </Col>
                    <Col md='3'>
                        <Button color='primary' className='w-100'
                            data-testid='mission-timer-countdown-minutes'
                            disabled={this.props.disabled || this.state.running}
                            onClick={this.setCountdownMinutes}>
                            Countdown starten
                        </Button>
                    </Col>
                    <Col md='3'>
                        <Label for='missionTimerTimestamp'>Endzeit</Label>
                        <Input id='missionTimerTimestamp' type='datetime-local'
                            value={this.state.timestamp} onChange={this.setTimestamp}/>
                    </Col>
                    <Col md='3'>
                        <Button color='secondary' className='w-100'
                            data-testid='mission-timer-countdown-timestamp'
                            disabled={this.props.disabled || this.state.running || !this.state.timestamp}
                            onClick={this.setCountdownTimestamp}>
                            Endzeit setzen
                        </Button>
                    </Col>
                </Row>
                <div className='d-flex gap-2 flex-wrap mt-2'>
                    <Button color='info' disabled={this.props.disabled || this.state.running}
                        data-testid='mission-timer-countup'
                        onClick={this.startCountup}>
                        Countup starten
                    </Button>
                    <Button color='outline-danger' disabled={this.props.disabled || this.state.running}
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
    return (
        <section className='mission-control-section'>
            <h3 className='h5'>Naechste Matches</h3>
            <div className='d-flex gap-2 flex-wrap'>
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
        </section>
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
