import {Alert, Badge, Button, Card, CardBody, Col, Collapse, Row, Table} from 'reactstrap';
import {Match} from './Match';
import React, {Component} from 'react';
import {getGroup} from '../redux/tournamentApi';
import {notify} from 'react-notify-toast';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {FaChevronDown} from 'react-icons/fa6';
import {createDeciderMatch, finishGroupStage} from '../api';

export default class GroupStage extends Component {
    constructor(props) {
        super(props);
        this.groupRefs = this.props.groups.reduce((acc, group) => {
            acc[group.id] = React.createRef();
            return acc;
        }, {});
        this.state = {
            blockingTies: [],
            finishingStage: false
        };
        this.finishStage = this.finishStage.bind(this);
        this.onFinishStageSuccess = this.onFinishStageSuccess.bind(this);
        this.onFinishStageError = this.onFinishStageError.bind(this);
        this.clearBlockingTies = this.clearBlockingTies.bind(this);
    }

    finishStage() {
        this.setState({finishingStage: true});
        finishGroupStage(this.props.stageId, this.onFinishStageSuccess, this.onFinishStageError);
    }

    onFinishStageSuccess() {
        this.setState({blockingTies: [], finishingStage: false});
        notify.show('Playoffs wurden generiert.', 'success', 2500);
        this.props.onTournamentChange !== undefined && this.props.onTournamentChange();
    }

    onFinishStageError(errorBody) {
        const blockingTies = errorBody && Array.isArray(errorBody.blocking_ties) ? errorBody.blocking_ties : [];
        this.setState({blockingTies: blockingTies, finishingStage: false});
        if (blockingTies.length > 0) {
            notify.show('Ein Entscheidungsmatch ist noch nötig, bevor die Playoffs starten können.', 'warning', 4000);
        } else {
            notify.show('Die Gruppenphase konnte nicht beendet werden.', 'error', 3000);
        }
    }

    clearBlockingTies() {
        if (this.state.blockingTies.length > 0) {
            this.setState({blockingTies: []});
        }
    }

    render() {
        return (
            <div className='py-2 px-1'>
                <h1 className='custom-font'>
                    <span className='px-2'>Gruppenphase</span>
                </h1>
                {this.props.isSignedIn && this.props.isOwner && this.props.stageState !== 'finished' &&
                    <div className='px-2 mt-3'>
                        <Button color='success' onClick={this.finishStage} disabled={this.state.finishingStage}
                            data-testid='finish-group-stage'>
                            {this.state.finishingStage ? 'Playoffs werden generiert...' : 'Playoffs starten'}
                        </Button>
                    </div>}
                {this.state.blockingTies.length > 0 &&
                    <Alert color='warning' className='mx-2 mt-3' data-testid='blocking-ties-alert'>
                        <div><strong>Playoffs können noch nicht gestartet werden.</strong></div>
                        {this.state.blockingTies.map((tie, index) => (
                            <div key={index}>
                                Gruppe {tie.group_number}: {tie.team_names.join(' vs. ')}
                                {' '}brauchen ein Entscheidungsmatch.
                            </div>
                        ))}
                    </Alert>}
                <Row className='mt-3 gx-0'>
                    {this.props.groups.map(group => (
                        <Group
                            group={group}
                            key={group.id}
                            isSignedIn={this.props.isSignedIn}
                            isOwner={this.props.isOwner}
                            groupRef={this.groupRefs[group.id]}
                            teams={this.props.teams}
                            blockingTies={this.state.blockingTies}
                            onGroupReload={this.clearBlockingTies}
                        />
                    ))}
                </Row>
            </div>
        );
    }
}

function ShowMatchesToggleChevron(props) {
    const toggleClass = props.show ? 'rotate' : '';
    return (
        <Button
            color="link"
            onClick={props.toggle}
            className="position-absolute top-0 end-0 m-2 mt-1 button-no-focus"
            title={props.show ? 'Matches ausblenden' : 'Matches einblenden'}
        >
            <FaChevronDown className={`my-chevron ${toggleClass}`}/>
        </Button>
    );
}

export class Group extends Component {
    constructor(props) {
        super(props);
        this.state = {
            ...props.group,
            showMatches: false,
            creatingDeciderKey: null
        };
        this.reload = this.reload.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.onReloadSuccess = this.onReloadSuccess.bind(this);
        this.onReloadError = this.onReloadError.bind(this);
        this.createDecider = this.createDecider.bind(this);
        this.onCreateDeciderSuccess = this.onCreateDeciderSuccess.bind(this);
        this.onCreateDeciderError = this.onCreateDeciderError.bind(this);
    }

    handleToggle() {
        this.setState(prevState => ({showMatches: !prevState.showMatches}));
        if (this.props.groupRef.current) {
            this.props.groupRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }

    reload() {
        getGroup(this.state.id, this.onReloadSuccess, this.onReloadError);
    }

    onReloadSuccess(status, updatedGroup) {
        this.setState(updatedGroup);
        this.props.onGroupReload !== undefined && this.props.onGroupReload(updatedGroup);
    }

    onReloadError() {
        notify.show('Die Gruppe konnte nicht aktualisiert werden.', 'warning', 2000);
    }

    createDecider(teamIds) {
        this.setState({creatingDeciderKey: teamIds.join('-')});
        createDeciderMatch(this.state.id, teamIds, this.onCreateDeciderSuccess, this.onCreateDeciderError);
    }

    onCreateDeciderSuccess() {
        notify.show('Das Entscheidungsmatch wurde angelegt.', 'success', 2500);
        this.setState({creatingDeciderKey: null, showMatches: true});
        this.reload();
    }

    onCreateDeciderError() {
        notify.show('Das Entscheidungsmatch konnte nicht angelegt werden.', 'error', 3000);
        this.setState({creatingDeciderKey: null});
    }

    render() {
        const teamIds = new Set();
        this.state.matches.forEach(match => {
            teamIds.add(match.team1.id);
            teamIds.add(match.team2.id);
        });
        const teamIdsString = Array.from(teamIds).join(',');
        return (
            <Col className="minw-25 py-2">
                <Card ref={this.props.groupRef} data-teams={teamIdsString}>
                    <CardBody className="position-relative">
                        <h3 className="custom-font">
                            Gruppe {this.state.number}
                        </h3>
                        <ShowMatchesToggleChevron
                            show={this.state.showMatches}
                            toggle={this.handleToggle}
                        />
                        <Collapse isOpen={this.state.showMatches}>
                            {this.state.matches.sort(sortMatchesByPositionAscending()).map(match => (
                                <Match
                                    match={match}
                                    isSignedIn={this.props.isSignedIn}
                                    isOwner={this.props.isOwner}
                                    onChange={this.reload}
                                    onFinish={this.reload}
                                    key={match.id}
                                />
                            ))}
                        </Collapse>
                        <GroupScoresTable scores={this.state.scores} teams={this.props.teams} groupId={this.state.id}
                            isOwner={this.props.isOwner} isSignedIn={this.props.isSignedIn}
                            onCreateDecider={this.createDecider} creatingDeciderKey={this.state.creatingDeciderKey}/>
                    </CardBody>
                </Card>
            </Col>
        );
    }
}

function GroupScoresTable(props) {
    return (
        <Table className="mt-4" striped size="sm" responsive>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th><span title="Punkte">Pkt.</span></th>
                    <th><span title="Becherdifferenz">Dif.</span></th>
                    <th><span title="Getroffene Becher (Geworfen)">Gew.</span></th>
                    <th>Entscheidung</th>
                </tr>
            </thead>
            <tbody>
                {props.scores.map(groupScore => (
                    <GroupScoresTableRow
                        score={groupScore}
                        key={groupScore.id}
                        teams={props.teams}
                        groupId={props.groupId}
                        isOwner={props.isOwner}
                        isSignedIn={props.isSignedIn}
                        onCreateDecider={props.onCreateDecider}
                        creatingDeciderKey={props.creatingDeciderKey}
                    />
                ))}
            </tbody>
        </Table>
    );
}

function GroupScoresTableRow(props) {
    const teams = props.teams || [];
    const advancingTeam = teams.find(team => team.id === props.score.team.id && team.advancing_from_group_stage);
    const rowClass = advancingTeam ? 'table-success' : '';
    const teamId = `favorite-team-groupstage-${props.score.team.id}`;
    const rankingDecision = props.score.ranking_decision;
    const createButton = renderCreateDeciderButton(props, rankingDecision);

    return (
        <tr className={rowClass} id={teamId}>
            <td>{props.score.position}</td>
            <td>
                {props.score.team.name}
                {rankingDecision && rankingDecision.needs_decider_match &&
                    <Badge color='warning' className='ms-2'>Tie-Break nötig</Badge>}
            </td>
            <td>{props.score.group_points}</td>
            <td>{props.score.difference_in_points}</td>
            <td>{props.score.scored_points}</td>
            <td data-ranking-decision={props.score.team.id}>
                {renderRankingDecision(rankingDecision)}
                {createButton}
            </td>
        </tr>
    );
}

function renderCreateDeciderButton(props, rankingDecision) {
    if (!props.isOwner || !props.isSignedIn || !rankingDecision || !rankingDecision.needs_decider_match) {
        return null;
    }
    if (rankingDecision.decider_match_id) {
        return <div className='mt-2'><Badge color='info'>Entscheidungsmatch angelegt</Badge></div>;
    }
    if (props.score.team.id > rankingDecision.compared_with_team_id) {
        return null;
    }
    const teamIds = [props.score.team.id, rankingDecision.compared_with_team_id];
    const createKey = teamIds.join('-');
    return (
        <div className='mt-2'>
            <Button size='sm' color='warning' data-create-decider={createKey}
                disabled={props.creatingDeciderKey === createKey}
                onClick={() => props.onCreateDecider(teamIds)}>
                {props.creatingDeciderKey === createKey ? 'Wird angelegt...' : 'Entscheidungsmatch anlegen'}
            </Button>
        </div>
    );
}

function renderRankingDecision(rankingDecision) {
    if (!rankingDecision) {
        return <span className='text-muted'>-</span>;
    }

    if (rankingDecision.needs_decider_match) {
        return (
            <div className='text-warning'>
                Entscheidungsmatch gegen {rankingDecision.compared_with_team_name} erforderlich
            </div>
        );
    }

    switch (rankingDecision.resolved_by) {
    case 'direct_comparison':
        return (
            <div>
                Direkter Vergleich gegen {rankingDecision.compared_with_team_name}
                {' '}{translateResult(rankingDecision.direct_comparison_result)}
            </div>
        );
    case 'hidden_points':
        return (
            <div>
                Entscheidungsmatch gegen {rankingDecision.compared_with_team_name}
                {' '}{translateResult(rankingDecision.hidden_points_result)}
            </div>
        );
    case 'tie':
        return <div className='text-muted'>Weiterhin gleichauf mit {rankingDecision.compared_with_team_name}</div>;
    default:
        return <span className='text-muted'>-</span>;
    }
}

function translateResult(result) {
    switch (result) {
    case 'won':
        return 'gewonnen';
    case 'lost':
        return 'verloren';
    case 'draw':
        return 'unentschieden';
    case 'not_played':
        return 'noch nicht gespielt';
    default:
        return '';
    }
}
