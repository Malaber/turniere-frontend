import {Card, CardBody} from 'reactstrap';
import React from 'react';
import {endMatch, startMatch} from '../api';
import {notify} from 'react-notify-toast';
import {MatchModal} from './MatchModal';
import {MatchTable} from './MatchTable';

import styles from './Match.module.css';


export class Match extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            modal: false,
            match: this.props.match
        };
        this.toggleModal = this.toggleModal.bind(this);
        this.startMatch = this.startMatch.bind(this);
        this.onStartMatchSuccess = this.onStartMatchSuccess.bind(this);
        this.onStartMatchError = this.onStartMatchError.bind(this);
        this.endMatch = this.endMatch.bind(this);
        this.onEndMatchSuccess = this.onEndMatchSuccess.bind(this);
        this.onEndMatchError = this.onEndMatchError.bind(this);
        this.getMatchFinishedMessage = this.getMatchFinishedMessage.bind(this);
        this.changeScores = this.changeScores.bind(this);
    }

    toggleModal() {
        const {isSignedIn, isOwner} = this.props;

        if (isSignedIn && isOwner) {
            this.setState({modal: !this.state.modal});
        }
    }

    startMatch() {
        startMatch(this.state.match.id, this.onStartMatchSuccess, this.onStartMatchError);
    }

    onStartMatchSuccess() {
        const updatedMatch = this.state.match;
        updatedMatch.state = 'in_progress';
        this.setState({match: updatedMatch});
        this.toggleModal();
    }

    onStartMatchError() {
        this.toggleModal();
        notify.show('Das Match konnte nicht gestartet werden.', 'error', 3000);
    }

    endMatch() {
        endMatch(this.state.match.id, this.onEndMatchSuccess, this.onEndMatchError);
    }

    onEndMatchSuccess(winner) {
        const updatedMatch = this.state.match;
        updatedMatch.state = 'finished';
        updatedMatch.winnerTeamId = winner === null ? null : winner.id;
        this.setState({match: updatedMatch});
        this.toggleModal();
        this.props.onFinish !== undefined && this.props.onFinish();
    }

    onEndMatchError() {
        this.toggleModal();
        notify.show('Das Match konnte nicht beendet werden.', 'error', 3000);
    }

    changeScores(scoreTeam1, scoreTeam2) {
        const updatedMatch = this.state.match;
        updatedMatch.team1.score = scoreTeam1;
        updatedMatch.team2.score = scoreTeam2;
        this.setState({match: updatedMatch});
        this.props.onChange !== undefined && this.props.onChange();
    }

    getMatchFinishedMessage() {
        const match = this.state.match;
        if (match.winnerTeamId === null) {
            return 'Spiel beendet, unentschieden';
        }
        if (match.winnerTeamId === match.team1.id) {
            return 'Gewinner: ' + match.team1.name;
        }
        if (match.winnerTeamId === match.team2.id) {
            return 'Gewinner: ' + match.team2.name;
        }
        return 'Spiel beendet';
    }

    render() {
        let cardClass = '';
        let smallMessage;
        let borderClass = '';
        // possible states: single_team not_ready not_started in_progress finished
        switch (this.state.match.state) {
        case 'in_progress':
            cardClass = 'bg-warning';
            borderClass = 'border-warning';
            smallMessage = 'Spiel läuft';
            break;
        case 'finished':
            cardClass = 'bg-success';
            borderClass = 'border-success';
            smallMessage = this.getMatchFinishedMessage();
            break;
        case 'single_team':
            cardClass = 'bg-success';
            borderClass = 'border-success';
            smallMessage = 'kein Gegner, Team kommt weiter';
            break;
        case 'not_ready':
            smallMessage = 'Spiel kann noch nicht gestartet werden';
            break;
        case 'not_started':
            smallMessage = 'Spiel kann gestartet werden';
            break;
        }

        const groupInformation = this.state.match.group ?
            <div className="mb-2 mt-2">Gr. {this.state.match.group.number}</div> :
            '';

        return (<div className='mb-3'>
            <Card className={'shadow-sm match '} onClick={this.toggleModal}>
                <div className="d-flex flex-row">
                    <CardBody className={borderClass + ' border py-2 ' + cardClass + ' ' + styles.match_bg}>
                        <MatchTable
                            match={this.state.match}
                            stageLevel={this.props.stageLevel}
                            borderColor={borderClass}
                        />
                    </CardBody>
                    <span className="badge bg-secondary align-items-center">
                        {groupInformation}
                        <div className="mb-2 mt-2">Sp. {this.state.match.position}</div>
                    </span>
                </div>
            </Card>
            <small className='text-muted'>{smallMessage}</small>
            <MatchModal title='Match' isOpen={this.state.modal} toggle={this.toggleModal} match={this.state.match}
                startMatch={this.startMatch} endMatch={this.endMatch} changeScores={this.changeScores}/>
        </div>);
    }
}
