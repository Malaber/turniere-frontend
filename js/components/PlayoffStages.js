import {Stage} from './Stage';
import React, {Component} from 'react';
import {getStage} from '../redux/tournamentApi';
import {notify} from 'react-notify-toast';

export class PlayoffStages extends Component {
    constructor(props) {
        super(props);
        this.state = {stages: this.props.playoffStages};

        this.updateStage = this.updateStage.bind(this);
        this.updateNextStage = this.updateNextStage.bind(this);
        this.onUpdateStageSuccess = this.onUpdateStageSuccess.bind(this);
        this.onUpdateStageError = this.onUpdateStageError.bind(this);
    }

    updateStage(id) {
        getStage(id, this.onUpdateStageSuccess, this.onUpdateStageError);
    }

    updateNextStage(changedStageId) {
        let found = false;
        for (const stage of this.state.stages) {
            if (found) {
                this.updateStage(stage.id);
                return;
            }
            if (stage.id === changedStageId) {
                found = true;
            }
        }
    }

    onUpdateStageSuccess(status, updatedStage) {
        const updatedStageIndex = this.state.stages.findIndex(stage => stage.id === updatedStage.id);
        if (updatedStageIndex === -1) {
            this.onUpdateStageError();
            return;
        }
        const updatedStages = this.state.stages;
        updatedStages[updatedStageIndex] = updatedStage;
        this.setState({stages: updatedStages});
    }

    onUpdateStageError() {
        notify.show('Die nachfolgende Stage konnte nicht aktualisiert werden.', 'error', 2500);
    }

    render() {
        return (<div>
            {this.state.stages.flatMap(stage => getStageSections(stage)).map(section =>
                <Stage isSignedIn={this.props.isSignedIn}
                    isOwner={this.props.isOwner} updateNextStage={() => this.updateNextStage(section.stage.id)}
                    readOnlyMode={this.props.readOnlyMode}
                    level={section.name} matches={section.matches} stageLevel={section.stage.level}
                    key={section.key}/>)}
        </div>);
    }
}

function getStageSections(stage) {
    if (stage.level !== 0 || stage.matches.length <= 1) {
        return [{
            stage: stage,
            key: stage.level,
            name: getLevelName(stage.level),
            matches: stage.matches
        }];
    }

    return stage.matches.map(match => ({
        stage: stage,
        key: `${stage.level}-${match.position}`,
        name: getFinalMatchName(match),
        matches: [match]
    }));
}

function getFinalMatchName(match) {
    if (match.position === 2) {
        return 'Spiel um Platz 3';
    }
    return 'Finale';
}

function getLevelName(levelNumber) {
    const names = ['Finale', 'Halbfinale', 'Viertelfinale', 'Achtelfinale'];
    if (levelNumber < names.length) {
        return names[levelNumber];
    } else {
        return Math.pow(2, levelNumber) + 'tel-Finale';
    }
}
