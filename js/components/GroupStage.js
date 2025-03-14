import {Button, Card, CardBody, Col, Collapse, Row, Table} from 'reactstrap';
import {Match} from './Match';
import React, {Component} from 'react';
import {getGroup} from '../redux/tournamentApi';
import {notify} from 'react-notify-toast';
import {sortMatchesByPositionAscending} from '../utils/sorting';

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
        return (<div className='py-2 px-1'>
            <h1 className='custom-font'>
                <span className='px-2'>Gruppenphase</span>
                <ShowMatchesToggleButton show={this.state.showMatches} toggle={this.toggleShowMatches}/>
            </h1>
            <Row className='mt-3'>
                {this.props.groups.map(group => (
                    <Group
                        group={group}
                        key={group.id}
                        isSignedIn={this.props.isSignedIn}
                        isOwner={this.props.isOwner}
                        showMatches={this.state.showMatches}
                        teams={this.props.teams}
                    />
                ))}
            </Row>
        </div>);
    }
}

function ShowMatchesToggleButton(props) {
    return (<Button onClick={props.toggle} className='float-right default-font-family'>
        {props.show ? 'Spiele ausblenden' : 'Spiele anzeigen'}
    </Button>);
}


export class Group extends Component {
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
        return (<Col className='minw-25 py-2'>
            <Card>
                <CardBody>
                    <h3 className='custom-font'>Gruppe {this.state.number}</h3>
                    <Collapse isOpen={this.props.showMatches}>
                        {this.state.matches.sort(sortMatchesByPositionAscending()).map(match => (
                            <Match
                                match={match}
                                isSignedIn={this.props.isSignedIn}
                                isOwner={this.props.isOwner}
                                onChange={this.reload}
                                key={match.id}
                            />
                        ))}
                    </Collapse>
                    <GroupScoresTable scores={this.state.scores} teams={this.props.teams} />
                </CardBody>
            </Card>
        </Col>);
    }
}

function GroupScoresTable(props) {
    return (
        <Table className='mt-4' striped size='sm' responsive>
            <thead>
            <tr>
                <th>#</th>
                <th>Team</th>
                <th><span title="Punkte">Pkt.</span></th>
                <th><span title="Becherdifferenz">Dif.</span></th>
                <th><span title="Getroffene Becher (Geworfen)">Gew.</span></th>
            </tr>
            </thead>
            <tbody>
            {props.scores.map(groupScore => (
                <GroupScoresTableRow
                    score={groupScore}
                    key={groupScore.id}
                    teams={props.teams}
                />
            ))}
            </tbody>
        </Table>
    );
}

function GroupScoresTableRow(props) {
    const advancingTeam = props.teams?.find(team => team.id === props.score.team.id && team.advancing_from_group_stage);
    const rowClass = advancingTeam ? 'table-success' : '';

    return (
        <tr className={rowClass}>
            <td>{props.score.position}</td>
            <td>{props.score.team.name}</td>
            <td>{props.score.group_points}</td>
            <td>{props.score.difference_in_points}</td>
            <td>{props.score.scored_points}</td>
        </tr>
    );
}
