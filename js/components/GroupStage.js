import {Button, Card, CardBody, Col, Collapse, Row, Table} from 'reactstrap';
import {Match} from './Match';
import React, {Component} from 'react';
import {getGroup} from '../redux/tournamentApi';
import {notify} from 'react-notify-toast';

export default class GroupStage extends Component {
    constructor(props) {
        super(props);
        this.state = {showMatches: this.props.showMatches};
        this.toggleShowMatches = this.toggleShowMatches.bind(this);
    }

    toggleShowMatches() {
        this.setState({showMatches: !this.state.showMatches});
    }

    render() {
        return (<div className='py-5 px-5'>
            <h1 className='custom-font'>
                Gruppenphase
                <ShowMatchesToggleButton show={this.state.showMatches} toggle={this.toggleShowMatches}/>
            </h1>
            <Row className='mt-3'>
                {this.props.groups.map(group => <Group group={group} key={group.id} isSignedIn={this.props.isSignedIn}
                    isOwner={this.props.isOwner} showMatches={this.state.showMatches}/>)}
            </Row>
        </div>);
    }
}

function ShowMatchesToggleButton(props) {
    return (<Button onClick={props.toggle} className='float-right default-font-family'>
        {props.show ? 'Spiele ausblenden' : 'Spiele anzeigen'}
    </Button>);
}

class Group extends Component {
    constructor(props) {
        super(props);
        this.state = props.group;
        this.reload = this.reload.bind(this);
        this.onReloadSuccess = this.onReloadSuccess.bind(this);
        this.onReloadError = this.onReloadError.bind(this);
    }

    reload() {
        getGroup(this.state.id, this.onReloadSuccess, this.onReloadError);
    }

    onReloadSuccess(status, updatedGroup) {
        this.setState(updatedGroup);
    }

    onReloadError() {
        notify.show('Die Gruppe konnte nicht aktualisiert werden.', 'warning', 2000);
    }

    render() {
        return (<Col className='minw-25'>
            <Card>
                <CardBody>
                    <h3 className='custom-font'>Gruppe {this.state.number}</h3>
                    <Collapse isOpen={this.props.showMatches}>
                        {this.state.matches.map((match => (
                            <Match match={match} isSignedIn={this.props.isSignedIn} isOwner={this.props.isOwner}
                                onChange={this.reload} key={match.id}/>)))}
                    </Collapse>
                    <GroupScoresTable scores={this.state.scores}/>
                </CardBody>
            </Card>
        </Col>);
    }
}

function GroupScoresTable(props) {
    return (<Table className='mt-4' striped size='sm' responsive>
        <thead>
            <tr>
                <th>Team</th>
                <th>Punkte</th>
                <th>erzielt</th>
                <th>kassiert</th>
            </tr>
        </thead>
        <tbody>
            {props.scores.map(groupScore => <GroupScoresTableRow score={groupScore} key={groupScore.id}/>)}
        </tbody>
    </Table>);
}


function GroupScoresTableRow(props) {
    return (<tr>
        <td>{props.score.team.name}</td>
        <td>{props.score.group_points}</td>
        <td>{props.score.scored_points}</td>
        <td>{props.score.received_points}</td>
    </tr>);
}
