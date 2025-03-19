import {Button, Card, CardBody, Col, Collapse, Row, Table} from 'reactstrap';
import {Match} from './Match';
import React, {Component} from 'react';
import {getGroup} from '../redux/tournamentApi';
import {notify} from 'react-notify-toast';
import {sortMatchesByPositionAscending} from '../utils/sorting';
import {FaChevronDown} from 'react-icons/fa6';

export default class GroupStage extends Component {
    constructor(props) {
        super(props);
        this.groupRefs = this.props.groups.reduce((acc, group) => {
            acc[group.id] = React.createRef();
            return acc;
        }, {});
    }

    render() {
        return (
            <div className='py-2 px-1'>
                <h1 className='custom-font'>
                    <span className='px-2'>Gruppenphase</span>
                </h1>
                <Row className='mt-3 gx-0'>
                    {this.props.groups.map(group => (
                        <Group
                            group={group}
                            key={group.id}
                            isSignedIn={this.props.isSignedIn}
                            isOwner={this.props.isOwner}
                            groupRef={this.groupRefs[group.id]}
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
            showMatches: false
        };
        this.reload = this.reload.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
        this.onReloadSuccess = this.onReloadSuccess.bind(this);
        this.onReloadError = this.onReloadError.bind(this);
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
    }

    onReloadError() {
        notify.show('Die Gruppe konnte nicht aktualisiert werden.', 'warning', 2000);
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
                                    key={match.id}
                                />
                            ))}
                        </Collapse>
                        <GroupScoresTable scores={this.state.scores}/>
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
            </tr>
            </thead>
            <tbody>
            {props.scores.map(groupScore => <GroupScoresTableRow score={groupScore} key={groupScore.id}/>)}
            </tbody>
        </Table>
    );
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
