import {Button, Modal, ModalBody, ModalFooter, ModalHeader} from 'reactstrap';
import React, {Component} from 'react';
import {EditableMatchTable} from './EditableMatchTable';
import {MatchTable} from './MatchTable';
import {submitDeciderMatchScores, submitMatchScores} from '../api';
import {notify} from 'react-notify-toast';

export class MatchModal extends Component {
    constructor(props) {
        super(props);
        this.state = {
            scoreTeam1: this.initialScoreFor(this.props.match.team1),
            scoreTeam2: this.initialScoreFor(this.props.match.team2)
        };
        this.updateScoreTeam1 = this.updateScoreTeam1.bind(this);
        this.updateScoreTeam2 = this.updateScoreTeam2.bind(this);
        this.submitScores = this.submitScores.bind(this);
        this.onSubmitScoresError = this.onSubmitScoresError.bind(this);
        this.onSubmitScoresSuccess = this.onSubmitScoresSuccess.bind(this);
        this.initialScoreFor = this.initialScoreFor.bind(this);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.match.id !== this.props.match.id || prevProps.match.state !== this.props.match.state) {
            this.setState({
                scoreTeam1: this.initialScoreFor(this.props.match.team1),
                scoreTeam2: this.initialScoreFor(this.props.match.team2)
            });
        }
    }

    initialScoreFor(team) {
        return this.props.match.decider ? team.hiddenScore : team.score;
    }

    updateScoreTeam1(newScore) {
        this.setState({scoreTeam1: newScore});
    }

    updateScoreTeam2(newScore) {
        this.setState({scoreTeam2: newScore});
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

    render() {
        let title;
        let actionButton = '';
        let submitScoresButton = '';
        let matchTable = <MatchTable match={this.props.match} matchStatus={this.props.match.state}/>;
        let scoreHint = null;
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
        return (<Modal isOpen={this.props.isOpen} toggle={this.props.toggle}>
            <ModalHeader toggle={this.props.toggle}>{title}</ModalHeader>
            <ModalBody>
                {matchTable}
                {scoreHint}
            </ModalBody>
            <ModalFooter>
                {submitScoresButton}
                {actionButton}
                <Button color='secondary' onClick={this.props.toggle}>Abbrechen</Button>
            </ModalFooter>
        </Modal>);
    }
}
