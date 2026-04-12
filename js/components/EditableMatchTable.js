import React from 'react';
import {Button, Input, InputGroup, Table} from 'reactstrap';

export function EditableMatchTable(props) {
    const team1Score = props.match.decider ? props.match.team1.hiddenScore : props.match.team1.score;
    const team2Score = props.match.decider ? props.match.team2.hiddenScore : props.match.team2.score;

    return (<Table className='mb-0'>
        <tbody>
            <tr>
                <td className='scoreInput border-top-0'>
                    <ScoreInput score={team1Score} update={props.updateScoreTeam1}/>
                </td>
                <td className='align-middle border-top-0'>{props.match.team1.name}</td>
            </tr>
            <tr>
                <td className='scoreInput'>
                    <ScoreInput score={team2Score} update={props.updateScoreTeam2}/>
                </td>
                <td className='align-middle'>{props.match.team2.name}</td>
            </tr>
        </tbody>
    </Table>);
}

class ScoreInput extends React.Component {
    constructor(props) {
        super(props);
        this.state = {score: this.props.score};
        this.inputScore = this.inputScore.bind(this);
        this.increaseScore = this.increaseScore.bind(this);
        this.decreaseScore = this.decreaseScore.bind(this);
    }

    inputScore(event) {
        const newScore = event.target.value;
        this.setState({score: newScore});
        this.props.update(newScore);
    }

    increaseScore() {
        const newScore = Number(this.state.score) + 1;
        this.setState({score: newScore});
        this.props.update(newScore);
    }

    decreaseScore() {
        const newScore = Number(this.state.score) - 1;
        this.setState({score: newScore});
        this.props.update(newScore);
    }

    render() {
        return (<InputGroup>
            <Button onClick={this.decreaseScore} color='danger' outline={true}>-1</Button>
            <Input className='font-weight-bold' value={this.state.score} onChange={this.inputScore} type='number'
                step='1' placeholder='0'/>
            <Button onClick={this.increaseScore} color='success'>+1</Button>
        </InputGroup>);
    }
}
