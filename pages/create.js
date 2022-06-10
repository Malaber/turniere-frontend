import Head from 'next/head';
import React from 'react';
import {notify} from 'react-notify-toast';
import {connect} from 'react-redux';
import {
    Button,
    Card,
    CardBody,
    Col,
    Collapse,
    Container,
    Form,
    FormGroup,
    Input,
    Label,
    Row
} from 'reactstrap';
import {TurniereNavigation} from '../js/components/Navigation';
import {Footer} from '../js/components/Footer';
import EditableStringList from '../js/components/EditableStringList';
import {createTournament} from '../js/api';
import {WarningPopup} from '../js/components/WarningPopup';
import Router from 'next/router';

import RequireLogin from '../js/components/RequireLogin';
import NumericInput from '../js/components/NumericInput';

class CreatePage extends React.Component {
    render() {
        return (<RequireLogin loginMessage='Sie müssen angemeldet sein, um ein neues Turnier zu erstellen.'>
            <div className="main generic-fullpage-bg">
                <Head>
                    <title>Turnier erstellen: turnie.re</title>
                </Head>
                <TurniereNavigation/>
                <div>
                    <CreateTournamentCard/>
                </div>
                <Footer/>
            </div>
        </RequireLogin>);
    }
}

function mapStateToCreatePageProperties(state) {
    const {isSignedIn} = state.userinfo;
    return {isSignedIn};
}

export default connect(mapStateToCreatePageProperties)(CreatePage);

function CreateTournamentCard() {
    return (<Container className="py-5">
        <Card className="shadow">
            <CardBody>
                <h1 className="custom-font">Turnier erstellen</h1>
                <CreateTournamentForm/>
            </CardBody>
        </Card>
    </Container>);
}

class CreateTournamentForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            groupPhaseEnabled: false,

            name: '', description: '', public: false,

            groupSize: 4, groupAdvance: 1, teams: [], groups: []
        };
        this.handleGroupPhaseEnabledInput = this.handleGroupPhaseEnabledInput.bind(this);
        this.teamListUpdate = this.teamListUpdate.bind(this);
        this.groupListUpdate = this.groupListUpdate.bind(this);
        this.create = this.create.bind(this);
        this.handleNameInput = this.handleNameInput.bind(this);
        this.handleDescriptionInput = this.handleDescriptionInput.bind(this);
        this.handlePublicInput = this.handlePublicInput.bind(this);
        this.increaseGroupAdvance = this.increaseGroupAdvance.bind(this);
        this.decreaseGroupAdvance = this.decreaseGroupAdvance.bind(this);
        this.increaseGroupSize = this.increaseGroupSize.bind(this);
        this.decreaseGroupSize = this.decreaseGroupSize.bind(this);
        this.generateTournamentCreationObject = this.generateTournamentCreationObject.bind(this);
        this.valuesAreCredible = this.valuesAreCredible.bind(this);

        this.create = this.create.bind(this);
    }

    render() {
        return (<div>
            <Form>
                <FormGroup>
                    <Label for="name">Name des Turniers</Label>
                    <Input type="text" name="name" size="255" required value={this.state.name}
                        onChange={this.handleNameInput}/>
                </FormGroup>
                <FormGroup>
                    <Label for="description">Beschreibung (optional)</Label>
                    <Input type="text" name="description" size="255" value={this.state.description}
                        onChange={this.handleDescriptionInput}/>
                </FormGroup>
                <FormGroup tag="fieldset">
                    <FormGroup check>
                        <Label for="public" check>Turnier öffentlich anzeigen (schreibgeschützt)</Label>
                        <Input type="checkbox" id="public"
                            checked={this.state.public}
                            onChange={this.handlePublicInput}/>
                    </FormGroup>
                    <FormGroup check>
                        <Label for="mix-teams" check>Teams mischen</Label>
                        <Input type="checkbox" id="mix-teams"/>
                    </FormGroup>
                    <FormGroup check>
                        <Label for="group-phase" check>Gruppenphase</Label>
                        <Input type="checkbox" id="group-phase"
                            checked={this.state.groupPhaseEnabled}
                            onChange={this.handleGroupPhaseEnabledInput}/>
                    </FormGroup>
                </FormGroup>
                <Collapse isOpen={this.state.groupPhaseEnabled}>
                    <FormGroup>
                        <Label for="teams-per-group">Anzahl Teams pro Gruppe</Label>
                        <Row>
                            <Col xs="3">
                                <NumericInput value={this.state.groupSize}
                                    incrementText="+1" incrementCallback={this.increaseGroupSize}
                                    decrementText="-1" decrementCallback={this.decreaseGroupSize}/>
                            </Col>
                        </Row>
                        <WarningPopup text='Es gibt noch unvollständige Gruppen.' shown={this.areGroupsIncomplete()}/>
                    </FormGroup>
                    <FormGroup>
                        <Label for="teams-group-to-playoff">Wie viele Teams sollen nach der Gruppenphase
                            weiterkommen?</Label>
                        <Row>
                            <Col xs="3">
                                <NumericInput value={this.state.groupAdvance}
                                    incrementText="&#215;2" incrementCallback={this.increaseGroupAdvance}
                                    decrementText="&#247;2" decrementCallback={this.decreaseGroupAdvance}/>
                            </Col>
                        </Row>
                        <WarningPopup
                            text={'Füge bitte noch ' + (this.state.groupAdvance - this.state.teams.length)
                            + ' Team(s) hinzu, um ' + this.state.groupAdvance + ' Team(s) im Playoff zu haben.'}
                            shown={this.state.teams.length < this.state.groupAdvance}/>
                    </FormGroup>
                </Collapse>
            </Form>
            <h3 className="custom-font mt-4">Teams</h3>
            <EditableStringList
                addButtonText="hinzufügen"
                teamPlaceholder="Keine Teams hinzugefügt!"
                groupPlaceHolder="Keine Gruppen verfügbar!"
                teams={[]}
                groups={[]}
                groupPhaseEnabled={this.state.groupPhaseEnabled}
                groupSize={this.state.groupSize}
                onTeamsChange={this.teamListUpdate}
                onGroupsChange={this.groupListUpdate}
                inputPlaceholder="Teamname"/>
            <Button color="success" size="lg" className="w-100 shadow-sm mt-4" onClick={this.create}>Turnier
                    erstellen</Button>
        </div>);
    }

    areGroupsIncomplete() {
        return this.state.groups.filter(group => group.length !== this.state.groupSize).length !== 0;
    }

    teamListUpdate(list) {
        this.setState({teams: list});
    }

    groupListUpdate(list) {
        this.setState({groups: list});
    }

    increaseGroupAdvance() {
        const newGroupAdvance = this.state.groupAdvance * 2;

        this.setState({
            groupAdvance: newGroupAdvance
        });
    }

    decreaseGroupAdvance() {
        const newGroupAdvance = Math.floor(this.state.groupAdvance / 2);

        if (newGroupAdvance >= 1) {
            this.setState({
                groupAdvance: newGroupAdvance
            });
        }
    }

    increaseGroupSize() {
        this.setState({groupSize: this.state.groupSize + 1});
    }

    decreaseGroupSize() {
        const newGroupSize = this.state.groupSize - 1;

        if (newGroupSize >= 3) {
            this.setState({groupSize: newGroupSize});
        }
    }

    handleGroupPhaseEnabledInput(input) {
        this.setState({groupPhaseEnabled: input.target.checked});
    }

    handleNameInput(input) {
        this.setState({name: input.target.value});
    }

    handleDescriptionInput(input) {
        this.setState({description: input.target.value});
    }

    handlePublicInput(input) {
        this.setState({public: input.target.checked});
    }

    create() {
        if (this.valuesAreCredible()) {
            createTournament(this.generateTournamentCreationObject(), data => {
                Router.push('/t/' + data.id);
            }, () => {
                notify.show('Das Turnier konnte nicht erstellt werden.', 'warning', 5000);
            });
        } else {
            notify.show('Bitte korrigiere deine Eingaben zuerst.', 'warning', 5000);
        }
    }

    valuesAreCredible() {
        return this.state.teams.length >= this.state.groupAdvance && !this.areGroupsIncomplete();
    }

    generateTournamentCreationObject() {
        const tournament = {
            'name': this.state.name,
            'description': this.state.description,
            'public': this.state.public,
            'group_stage': this.state.groupPhaseEnabled,
            'teams': createTeamArray(this.state.groupPhaseEnabled, this.state.groups, this.state.teams)
        };

        if (this.state.groupPhaseEnabled) {
            tournament.playoff_teams_amount = this.state.groupAdvance;
        }

        return tournament;
    }
}

/**
 * This method creates an array of team objects that conform to the currently
 * api specs available at https://apidoc.turnie.re/
 *
 * @param {boolean} groupphase Whether a group phase is to be created
 * @param {string[][]} groups The teams split into the groups that are
 *     to be used in the group phase of the tournament. Please note that
 *     according to the api every team can only occur once (not enforced
 *     by this method) and that every team from {@param teams} will have
 *     to be in one of the groups (also not enforced by this method, but
 *     might lead to inconsistencies)
 * @param {string[]} teams An array containing all names of the teams
 *     that are to be created for the tournament
 * @return {Object[]} an array of teams that can be directly sent to the
 *     backend
 */
function createTeamArray(groupphase, groups, teams) {
    const result = [];

    if (groupphase) {
        for (let groupNumber = 0; groupNumber < groups.length; groupNumber++) {
            for (let groupMember = 0; groupMember < groups[groupNumber].length; groupMember++) {
                result[result.length] = {
                    'name': groups[groupNumber][groupMember], 'group': groupNumber
                };
            }
        }
    } else {
        for (let i = 0; i < teams.length; i++) {
            result[i] = {'name': teams[i]};
        }
    }

    return result;
}
