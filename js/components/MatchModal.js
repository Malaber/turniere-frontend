import {Button, Input, Modal, ModalBody, ModalFooter, ModalHeader} from 'reactstrap';
import React, {Component} from 'react';
import {EditableMatchTable} from './EditableMatchTable';
import {MatchTable} from './MatchTable';
import {TeamName} from './TeamName';
import {submitDeciderMatchScores, submitMatchScores} from '../api';
import {notify} from 'react-notify-toast';

export class MatchModal extends Component {
    constructor(props) {
        super(props);
        this.state = {
            scoreTeam1: this.initialScoreFor(this.props.match.team1),
            scoreTeam2: this.initialScoreFor(this.props.match.team2),
            swapTargetId: this.initialSwapTargetId(this.props.swapTargets),
            swapControlsExpanded: false
        };
        this.updateScoreTeam1 = this.updateScoreTeam1.bind(this);
        this.updateScoreTeam2 = this.updateScoreTeam2.bind(this);
        this.submitScores = this.submitScores.bind(this);
        this.onSubmitScoresError = this.onSubmitScoresError.bind(this);
        this.onSubmitScoresSuccess = this.onSubmitScoresSuccess.bind(this);
        this.initialScoreFor = this.initialScoreFor.bind(this);
        this.initialSwapTargetId = this.initialSwapTargetId.bind(this);
        this.updateSwapTargetId = this.updateSwapTargetId.bind(this);
        this.swapMatchPosition = this.swapMatchPosition.bind(this);
        this.toggleSwapControls = this.toggleSwapControls.bind(this);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.match.id !== this.props.match.id || prevProps.match.state !== this.props.match.state) {
            this.setState({
                scoreTeam1: this.initialScoreFor(this.props.match.team1),
                scoreTeam2: this.initialScoreFor(this.props.match.team2),
                swapTargetId: this.initialSwapTargetId(this.props.swapTargets),
                swapControlsExpanded: false
            });
        }
        const previousTargets = prevProps.swapTargets || [];
        const nextTargets = this.props.swapTargets || [];
        if (previousTargets !== nextTargets && nextTargets.length > 0 &&
            !nextTargets.some(target => String(target.id) === this.state.swapTargetId)) {
            this.setState({swapTargetId: this.initialSwapTargetId(nextTargets)});
        }
    }

    initialScoreFor(team) {
        return this.props.match.decider ? team.hiddenScore : team.score;
    }

    initialSwapTargetId(swapTargets) {
        if (!Array.isArray(swapTargets) || swapTargets.length === 0) {
            return '';
        }
        return String(swapTargets[0].id);
    }

    updateScoreTeam1(newScore) {
        this.setState({scoreTeam1: newScore});
    }

    updateScoreTeam2(newScore) {
        this.setState({scoreTeam2: newScore});
    }

    updateSwapTargetId(event) {
        this.setState({swapTargetId: event.target.value});
    }

    submitScores() {
        const match = this.props.match;
        const submit = match.decider ? submitDeciderMatchScores : submitMatchScores;
        submit(this.state.scoreTeam1, match.team1.scoreId, this.state.scoreTeam2, match.team2.scoreId,
            this.onSubmitScoresSuccess, this.onSubmitScoresError);
    }

    onSubmitScoresError() {
        this.props.toggle();
        notify.show(this.props.match.decider ?
            'Die Tie-Breaker Punkte konnten nicht geändert werden.' :
            'Der Spielstand konnte nicht geändert werden.', 'error', 2500);
    }

    onSubmitScoresSuccess() {
        this.props.toggle();
        this.props.changeScores(this.state.scoreTeam1, this.state.scoreTeam2);
        notify.show(this.props.match.decider ?
            'Die Tie-Breaker Punkte wurden geändert.' :
            'Der Spielstand wurde geändert.', 'success', 2000);
    }

    swapMatchPosition() {
        if (typeof this.props.onSwapMatchPosition !== 'function' || this.state.swapTargetId === '') {
            return;
        }
        const otherMatchId = Number(this.state.swapTargetId);
        if (!Number.isFinite(otherMatchId)) {
            return;
        }
        this.props.toggle();
        this.props.onSwapMatchPosition(this.props.match.id, otherMatchId);
    }

    toggleSwapControls() {
        this.setState(prevState => ({
            swapControlsExpanded: !prevState.swapControlsExpanded
        }));
    }

    render() {
        let title;
        let actionButton = '';
        let submitScoresButton = '';
        let matchTable = <MatchTable match={this.props.match} matchStatus={this.props.match.state}/>;
        let scoreHint = null;
        const canSwapMatchPosition = this.props.canSwapMatchPosition &&
            Array.isArray(this.props.swapTargets) && this.props.swapTargets.length > 0;
        const selectedSwapTarget = canSwapMatchPosition ?
            this.props.swapTargets.find(target => String(target.id) === this.state.swapTargetId) :
            null;
        let swapControls = null;
        // possible states: single_team not_ready not_started in_progress finished
        switch (this.props.match.state) {
        case 'in_progress':
            title = this.props.match.decider ? 'Entscheidungsmatch läuft' : 'Spiel läuft';
            submitScoresButton = <Button color='primary' onClick={this.submitScores}>
                {this.props.match.decider ? 'Tie-Breaker Punkte ändern' : 'Spielstand ändern'}
            </Button>;
            if (!this.props.match.allowUndecided && this.state.scoreTeam1 === this.state.scoreTeam2) {
                actionButton = <Button color='primary' disabled>Spiel beenden</Button>;
            } else {
                actionButton = <Button color='primary' onClick={this.props.endMatch}>Spiel beenden</Button>;
            }
            if (this.props.match.decider) {
                scoreHint = (
                    <small className='text-muted'>
                        Dieses Match zählt nur über verdeckte Tie-Breaker Punkte.
                    </small>
                );
            }
            matchTable = <EditableMatchTable match={this.props.match} updateScoreTeam1={this.updateScoreTeam1}
                updateScoreTeam2={this.updateScoreTeam2}/>;
            break;
        case 'finished':
            title = this.props.match.decider ? 'Entscheidungsmatch beendet' : 'Spiel beendet';
            break;
        case 'single_team':
            title = 'kein Gegner, Team kommt weiter';
            break;
        case 'not_ready':
            title = this.props.match.decider ?
                'Entscheidungsmatch kann noch nicht gestartet werden' :
                'Spiel kann noch nicht gestartet werden';
            break;
        case 'not_started':
            title = this.props.match.decider ?
                'Entscheidungsmatch kann gestartet werden' :
                'Spiel kann gestartet werden';
            actionButton = <Button color='primary' onClick={this.props.startMatch}>Spiel starten</Button>;
            break;
        }
        if (canSwapMatchPosition) {
            swapControls = (
                <div className='me-auto d-flex align-items-end gap-2' data-testid='swap-match-position-controls'>
                    <Button
                        color='link'
                        className='p-0 text-muted text-decoration-none'
                        onClick={this.toggleSwapControls}
                        data-testid='swap-match-position-toggle'
                    >
                        {this.state.swapControlsExpanded ? 'Tauschoptionen ausblenden' : 'Position tauschen'}
                    </Button>
                    {this.state.swapControlsExpanded && (
                        <div className='d-flex align-items-center gap-2'>
                            <span className='text-muted'>mit</span>
                            <Input type='select' value={this.state.swapTargetId} onChange={this.updateSwapTargetId}
                                disabled={this.props.swapInProgress} data-testid='swap-match-position-select'>
                                {this.props.swapTargets.map(target => (
                                    <option key={target.id} value={target.id}>
                                        {target.position}
                                    </option>
                                ))}
                            </Input>
                            {selectedSwapTarget &&
                                <div className='text-muted small' style={{minWidth: 0, maxWidth: '16rem'}}>
                                    <TeamName name={selectedSwapTarget.team1.name}/>
                                    <TeamName name={selectedSwapTarget.team2.name}/>
                                </div>}
                            <Button color='secondary' onClick={this.swapMatchPosition}
                                disabled={this.props.swapInProgress}
                                data-testid='swap-match-position-button'>
                                {this.props.swapInProgress ? 'Tauscht...' : 'Tauschen'}
                            </Button>
                        </div>
                    )}
                </div>
            );
        }
        return (<Modal isOpen={this.props.isOpen} toggle={this.props.toggle}
            fade={false} contentClassName='match-modal-content'>
            <ModalHeader toggle={this.props.toggle}>{title}</ModalHeader>
            <ModalBody>
                {matchTable}
                {scoreHint}
            </ModalBody>
            <ModalFooter>
                {swapControls}
                {submitScoresButton}
                {actionButton}
                <Button color='secondary' onClick={this.props.toggle}>Abbrechen</Button>
            </ModalFooter>
        </Modal>);
    }
}
