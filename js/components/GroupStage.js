import {
    Alert, Button, Card, CardBody, Col, Collapse, Modal, ModalBody, ModalFooter, ModalHeader, Row, Table
} from 'reactstrap';
import {Match} from './Match';
import React, {Component} from 'react';
import {getGroup} from '../redux/tournamentApi';
import {notify} from './Notifications';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {
    FaChevronDown, FaCircleExclamation, FaCircleInfo
} from 'react-icons/fa6';
import {createDeciderMatch, finishGroupStage, swapMatchPositions as apiSwapMatchPositions} from '../api';
import {TeamName} from './TeamName';

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
        const canEdit = this.props.isSignedIn && this.props.isOwner && !this.props.readOnlyMode;
        return (
            <div className='py-2 px-1'>
                <h1 className='custom-font'>
                    <span className='px-2'>Gruppenphase</span>
                </h1>
                {canEdit && this.props.stageState !== 'finished' &&
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
                                Gruppe {tie.group_number}: {tie.team_names.map((teamName, teamIndex) => (
                                    <React.Fragment key={teamName}>
                                        {teamIndex > 0 && ' vs. '}
                                        <TeamName name={teamName} inline/>
                                    </React.Fragment>
                                ))}
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
                            readOnlyMode={this.props.readOnlyMode}
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
            creatingDeciderKey: null,
            decisionModalScore: null,
            swappingMatchId: null
        };
        this.reload = this.reload.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.onReloadSuccess = this.onReloadSuccess.bind(this);
        this.onReloadError = this.onReloadError.bind(this);
        this.createDecider = this.createDecider.bind(this);
        this.onCreateDeciderSuccess = this.onCreateDeciderSuccess.bind(this);
        this.onCreateDeciderError = this.onCreateDeciderError.bind(this);
        this.openDecisionModal = this.openDecisionModal.bind(this);
        this.closeDecisionModal = this.closeDecisionModal.bind(this);
        this.swapMatchPositions = this.swapMatchPositions.bind(this);
        this.onSwapMatchPositionsSuccess = this.onSwapMatchPositionsSuccess.bind(this);
        this.onSwapMatchPositionsError = this.onSwapMatchPositionsError.bind(this);
        this.latestReloadRequestId = 0;
    }

    handleToggle() {
        this.setState(prevState => ({showMatches: !prevState.showMatches}));
        if (this.props.groupRef.current) {
            this.props.groupRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.group !== this.props.group) {
            this.setState(prevState => ({
                ...this.props.group,
                showMatches: prevState.showMatches,
                creatingDeciderKey: prevState.creatingDeciderKey,
                decisionModalScore: prevState.decisionModalScore
            }));
        }
    }

    reload() {
        const reloadRequestId = this.latestReloadRequestId + 1;
        this.latestReloadRequestId = reloadRequestId;
        getGroup(
            this.state.id,
            (status, updatedGroup) => this.onReloadSuccess(reloadRequestId, status, updatedGroup),
            () => this.onReloadError(reloadRequestId)
        );
    }

    onReloadSuccess(reloadRequestId, status, updatedGroup) {
        if (reloadRequestId !== this.latestReloadRequestId) {
            return;
        }
        this.setState(updatedGroup);
        this.props.onGroupReload !== undefined && this.props.onGroupReload(updatedGroup);
    }

    onReloadError(reloadRequestId) {
        if (reloadRequestId !== this.latestReloadRequestId) {
            return;
        }
        notify.show('Die Gruppe konnte nicht aktualisiert werden.', 'warning', 2000);
    }

    createDecider(teamIds) {
        this.setState({creatingDeciderKey: teamIds.join('-')});
        createDeciderMatch(this.state.id, teamIds, this.onCreateDeciderSuccess, this.onCreateDeciderError);
    }

    onCreateDeciderSuccess() {
        notify.show('Das Entscheidungsmatch wurde angelegt.', 'success', 2500);
        this.setState({creatingDeciderKey: null, showMatches: true, decisionModalScore: null});
        this.reload();
    }

    onCreateDeciderError() {
        notify.show('Das Entscheidungsmatch konnte nicht angelegt werden.', 'error', 3000);
        this.setState({creatingDeciderKey: null});
    }

    openDecisionModal(score) {
        this.setState({decisionModalScore: score});
    }

    closeDecisionModal() {
        this.setState({decisionModalScore: null});
    }

    swapMatchPositions(matchId, otherMatchId) {
        this.setState({swappingMatchId: matchId});
        apiSwapMatchPositions(matchId, otherMatchId, this.onSwapMatchPositionsSuccess, this.onSwapMatchPositionsError);
    }

    onSwapMatchPositionsSuccess() {
        notify.show('Die Positionen wurden getauscht.', 'success', 2500);
        this.setState({swappingMatchId: null});
        this.reload();
    }

    onSwapMatchPositionsError(errorBody, statusCode) {
        let errorMessage = 'Die Match-Positionen konnten nicht getauscht werden.';
        if (statusCode === 422 && errorBody && typeof errorBody.error === 'string') {
            errorMessage = errorBody.error;
        } else if (statusCode === 404) {
            errorMessage = 'Das Ziel-Match wurde nicht gefunden.';
        }
        notify.show(errorMessage, 'error', 3000);
        this.setState({swappingMatchId: null});
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
                            {this.state.matches.sort(sortMatchesByPositionAscending()).map(match => {
                                const swapTargets = this.state.matches
                                    .filter(otherMatch => otherMatch.id !== match.id)
                                    .sort(sortMatchesByPositionAscending());
                                return (
                                    <Match
                                        match={match}
                                        isSignedIn={this.props.isSignedIn}
                                        isOwner={this.props.isOwner}
                                        readOnlyMode={this.props.readOnlyMode}
                                        allowReadOnlyModal
                                        onChange={this.reload}
                                        onFinish={this.reload}
                                        key={match.id}
                                        canSwapMatchPosition={this.props.isSignedIn && this.props.isOwner &&
                                            !this.props.readOnlyMode}
                                        swapTargets={swapTargets}
                                        swapInProgress={this.state.swappingMatchId === match.id}
                                        onSwapMatchPosition={this.swapMatchPositions}
                                    />
                                );
                            })}
                        </Collapse>
                        <GroupScoresTable scores={this.state.scores} teams={this.props.teams} groupId={this.state.id}
                            isOwner={this.props.isOwner} isSignedIn={this.props.isSignedIn}
                            readOnlyMode={this.props.readOnlyMode}
                            onCreateDecider={this.createDecider} creatingDeciderKey={this.state.creatingDeciderKey}
                            onDecisionClick={this.openDecisionModal}/>
                        <RankingDecisionModal
                            score={this.state.decisionModalScore}
                            isOpen={this.state.decisionModalScore !== null}
                            toggle={this.closeDecisionModal}
                            isOwner={this.props.isOwner}
                            isSignedIn={this.props.isSignedIn}
                            readOnlyMode={this.props.readOnlyMode}
                            onCreateDecider={this.createDecider}
                            creatingDeciderKey={this.state.creatingDeciderKey}
                        />
                    </CardBody>
                </Card>
            </Col>
        );
    }
}

function GroupScoresTable(props) {
    return (
        <Table className="mt-4 mb-0" striped size="sm" style={{tableLayout: 'fixed', width: '100%'}}>
            <thead>
                <tr>
                    <th style={{width: '2.5rem'}}>#</th>
                    <th>Team</th>
                    <th style={{width: '3.2rem'}}><span title="Punkte">Pkt.</span></th>
                    <th style={{width: '3.2rem'}}><span title="Becherdifferenz">Dif.</span></th>
                    <th style={{width: '3.4rem'}}><span title="Getroffene Becher (Geworfen)">Gew.</span></th>
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
                        onDecisionClick={props.onDecisionClick}
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
    const decisionButton = renderDecisionButton(props, rankingDecision);

    return (
        <tr className={rowClass} id={teamId}>
            <td>{props.score.position}</td>
            <td>
                <div className='d-flex align-items-center justify-content-between gap-2'>
                    <TeamName name={props.score.team.name}/>
                    {decisionButton}
                </div>
            </td>
            <td>{props.score.group_points}</td>
            <td>{props.score.difference_in_points}</td>
            <td>{props.score.scored_points}</td>
        </tr>
    );
}

function renderDecisionButton(props, rankingDecision) {
    if (!shouldRenderDecisionIcon(rankingDecision)) {
        return null;
    }
    const Icon = rankingDecision.needs_decider_match ? FaCircleExclamation : FaCircleInfo;
    const color = rankingDecision.needs_decider_match ? '#dc3545' : '#0d6efd';
    const label = rankingDecision.needs_decider_match ? 'Tie-Break nötig' : 'Tie-Break erklärt';

    return (
        <Button color='link' className='p-0 border-0 text-decoration-none flex-shrink-0'
            title={label} aria-label={label} data-ranking-decision-trigger={props.score.team.id}
            onClick={() => props.onDecisionClick(props.score)}>
            <Icon style={{color: color}}/>
        </Button>
    );
}

function shouldRenderDecisionIcon(rankingDecision) {
    if (!rankingDecision) {
        return false;
    }
    if (rankingDecision.needs_decider_match) {
        return true;
    }
    return ['direct_comparison', 'hidden_points', 'tie'].includes(rankingDecision.resolved_by);
}

function RankingDecisionModal(props) {
    if (!props.score || !props.score.ranking_decision) {
        return null;
    }

    const rankingDecision = props.score.ranking_decision;
    const canCreateDecider = props.isOwner && props.isSignedIn && !props.readOnlyMode &&
        rankingDecision.needs_decider_match && !rankingDecision.decider_match_id &&
        props.score.team.id < rankingDecision.compared_with_team_id;
    const teamIds = [props.score.team.id, rankingDecision.compared_with_team_id];
    const createKey = teamIds.join('-');

    return (
        <Modal isOpen={props.isOpen} toggle={props.toggle}
            fade={false} contentClassName='ranking-decision-modal-content'>
            <ModalHeader toggle={props.toggle}>
                {modalTitleFor(rankingDecision)}
            </ModalHeader>
            <ModalBody data-ranking-decision={props.score.team.id}>
                <p className='mb-3'>
                    {modalExplanationFor(props.score, rankingDecision)}
                </p>
                {rankingDecision.resolved_by === 'direct_comparison' &&
                    <p className='mb-3'>
                        Direkter Vergleich gegen <TeamName name={rankingDecision.compared_with_team_name} inline/>:{' '}
                        {translateResult(rankingDecision.direct_comparison_result)}.
                    </p>}
                {rankingDecision.resolved_by === 'hidden_points' &&
                    <p className='mb-3'>
                        Entscheidungsmatch gegen <TeamName name={rankingDecision.compared_with_team_name} inline/>:{' '}
                        {translateResult(rankingDecision.hidden_points_result)}.
                    </p>}
                {rankingDecision.needs_decider_match && rankingDecision.decider_match_id &&
                    <p className='mb-0 text-muted'>
                        Das Entscheidungsmatch ist bereits angelegt und erscheint in den Gruppen-Matches.
                    </p>}
            </ModalBody>
            <ModalFooter>
                {canCreateDecider &&
                    <Button color='warning' data-create-decider={createKey}
                        disabled={props.creatingDeciderKey === createKey}
                        onClick={() => props.onCreateDecider(teamIds)}>
                        {props.creatingDeciderKey === createKey ? 'Wird angelegt...' : 'Entscheidungsmatch anlegen'}
                    </Button>}
                <Button color='secondary' onClick={props.toggle}>Schließen</Button>
            </ModalFooter>
        </Modal>
    );
}

function modalTitleFor(rankingDecision) {
    if (rankingDecision.needs_decider_match) {
        return 'Tie-Break nötig';
    }
    if (rankingDecision.resolved_by === 'direct_comparison') {
        return 'Direkter Vergleich entscheidet';
    }
    if (rankingDecision.resolved_by === 'hidden_points') {
        return 'Entscheidungsmatch entscheidet';
    }
    return 'Tie-Break Information';
}

function modalExplanationFor(score, rankingDecision) {
    if (rankingDecision.needs_decider_match) {
        return (<>
            <TeamName name={score.team.name} inline/> und{' '}
            <TeamName name={rankingDecision.compared_with_team_name} inline/>
            {' '}sind nach Punkten, Differenz, geworfenen Bechern und direktem Vergleich weiterhin gleichauf.
            Deshalb braucht es ein Entscheidungsmatch.
        </>);
    }
    if (rankingDecision.resolved_by === 'direct_comparison') {
        return (<>
            <TeamName name={score.team.name} inline/>
            {' '}wurde über den direkten Vergleich gegen{' '}
            <TeamName name={rankingDecision.compared_with_team_name} inline/> einsortiert.
        </>);
    }
    if (rankingDecision.resolved_by === 'hidden_points') {
        return (<>
            <TeamName name={score.team.name} inline/>
            {' '}hat das Entscheidungsmatch gegen{' '}
            <TeamName name={rankingDecision.compared_with_team_name} inline/>
            {' '}{translateResult(rankingDecision.hidden_points_result)}.
        </>);
    }
    if (rankingDecision.resolved_by === 'tie') {
        return (<>
            <TeamName name={score.team.name} inline/> bleibt mit{' '}
            <TeamName name={rankingDecision.compared_with_team_name} inline/> gleichauf.
            {' '}Dieser Gleichstand blockiert die Playoffs nicht.
        </>);
    }
    return 'Die Platzierung wurde über zusätzliche Tie-Break Informationen entschieden.';
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
