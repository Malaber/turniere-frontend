import {Button, Card, CardBody, Col, Collapse, Row, Table} from 'reactstrap';
import {Match} from './Match';
import React, {Component} from 'react';
import {getGroup} from '../redux/tournamentApi';
import {notify} from 'react-notify-toast';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {FaChevronDown, FaChevronUp} from 'react-icons/fa6';

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
            </h1>
            <Row className='mt-3'>
                {this.props.groups.map(group => <Group
                    group={group}
                    key={group.id}
                    isSignedIn={this.props.isSignedIn}
                    isOwner={this.props.isOwner}
                    showMatches={this.state.showMatches}
                    showMatchesToggle={this.toggleShowMatches}
                />)}
            </Row>
        </div>);
    }
}

function ShowMatchesToggleChevron(props) {
    return (<Button color='link' onClick={props.toggle} className="position-absolute top-0 end-0 m-2">
        {props.show ? <FaChevronUp /> : <FaChevronDown />}
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
                <CardBody className="position-relative">
                    <h3 className='custom-font'>
                        Gruppe {this.state.number}
                    </h3>
                    <ShowMatchesToggleChevron show={this.props.showMatches} toggle={this.props.showMatchesToggle}/>
                    <Collapse isOpen={this.props.showMatches}>
                        {this.state.matches.sort(sortMatchesByPositionAscending()).map((match => (
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
                <th>#</th>
                <th>Team</th>
                <th><span title="Punkte">Pkt.</span></th>
                <th><span title="Becherdifferenz">Dif.</span></th>
                <th><span title="Getroffene Becher (Geworfen)">Gew.</span></th>
            </tr>
        </thead>
        <tbody>
            {props.scores.map(groupScore => <GroupScoresTableRow score={groupScore} key={groupScore.id}/>)}
        </tbody>
    </Table>);
}


function GroupScoresTableRow(props) {
    const teamId = `favorite-team-groupstage-${props.score.team.id}`;
    return (
        <tr id={teamId}>
            <td>{props.score.position}</td>
            <td>{props.score.team.name}</td>
            <td>{props.score.group_points}</td>
            <td>{props.score.difference_in_points}</td>
            <td>{props.score.scored_points}</td>
        </tr>
    );
}
