import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {notify} from 'react-notify-toast';
import {
    Container, Button, Card, CardBody, Table
} from 'reactstrap';

import {requestTournament} from '../js/api';
import {TurniereNavigation} from '../js/components/Navigation';
import {BigImage} from '../js/components/BigImage';
import {UserRestrictor, Option} from '../js/components/UserRestrictor';
import {Footer} from '../js/components/Footer';
import {Login} from '../js/components/Login';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {updateTeamName} from '../js/api';

import 'bootstrap/dist/css/bootstrap.min.css';

import {LoadingPage} from '../js/components/LoadingPage';

class EditTournamentPage extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);

        this.state = {
            validCode: false,
            loaded: false
        };
    }

    componentDidMount() {
        requestTournament(this.props.query.code, () => {
            this.setState({validCode: true, loaded: true});

            if (this._edittournamentcontent != null) {
                this._edittournamentcontent.notifyOfContentUpdate();
            }
        }, () => {
            this.setState({validCode: false, loaded: true});
        });
    }

    render() {
        const {validCode, loaded} = this.state;
        const {tournamentname, ownerUsername, isSignedIn, username} = this.props;

        if (!loaded) {
            return <LoadingPage title='turnie.re' text='Turnier-Einstellungen werden geladen...'/>;
        }

        return (<UserRestrictor>
            <Option condition={validCode && isSignedIn && ownerUsername === username}>
                <div className='pb-5'>
                    <Head>
                        <title>Turnie.re - Turnier bearbeiten</title>
                    </Head>
                    <TurniereNavigation/>

                    <BigImage text={tournamentname}/>
                    <EditTournamentContent ref={edittournamentcontent => {
                        this._edittournamentcontent = edittournamentcontent;
                    }}/>
                    <Footer/>
                </div>
            </Option>
            <Option condition={validCode && isSignedIn}>
                <ErrorPageComponent statusCode={403}/>
            </Option>
            <Option condition={!isSignedIn}>
                <div className="main generic-fullpage-bg">
                    <Head>
                        <title>Turnie.re - Turnier bearbeiten</title>
                    </Head>
                    <TurniereNavigation/>

                    <div>
                        <Login hint="Sie müssen angemeldet sein, um ein Turnier zu bearbeiten."/>
                    </div>
                    <Footer/>
                </div>
            </Option>
            <Option condition={true}>
                <ErrorPageComponent statusCode={404}/>
            </Option>
        </UserRestrictor>);
    }
}

function mapStateToTournamentInfo(state) {
    const {tournamentname, ownerUsername} = state.tournamentinfo;
    const {isSignedIn, username} = state.userinfo;
    return {tournamentname, ownerUsername, isSignedIn, username};
}

export default connect(mapStateToTournamentInfo)(EditTournamentPage);

class EditTournamentContent extends React.Component {
    render() {
        return (<div className='mb-5'>
            <ReturnToTournamentButton/>
            <EditTournamentPropertiesField ref={field => {
                this._edittournamentpropertiesfield = field;
            }}/>
            <EditTeamField ref={field => {
                this._editteamfield = field;
            }}/>
        </div>);
    }

    notifyOfContentUpdate() {
        this._edittournamentpropertiesfield.notifyOfContentUpdate();
        this._editteamfield.notifyOfContentUpdate();
    }
}

function ReturnToTournamentButton() {
    return (<Container className="px-0">
        <Button color="secondary" className="mb-5 w-100" href="./">Zurück zum Turnier</Button>
    </Container>);
}

class EditTournamentPropertiesField extends React.Component {
    render() {
        return (<Card className="container">
            <CardBody>
                <h2>Turnier-Eigenschaften ändern</h2>
                <VisibleEditTournamentForm ref={form => {
                    this._visibleedittournamentform = form;
                }}/>
            </CardBody>
        </Card>);
    }

    notifyOfContentUpdate() {
        this._visibleedittournamentform.getWrappedInstance().notifyOfContentUpdate();
    }
}

class EditTournamentForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            name: '', description: '', isPublic: false
        };
    }

    render() {
        const {name, description, isPublic} = this.state;

        return (<div>
            <div className="form-group">
                <label htmlFor="name">Turnier-Name</label>
                <input className="form-control" type="text" name="name" id="edittournament-textfield-name"
                    value={name} placeholder={name} onChange={this.handleNameInput.bind(this)}/>
            </div>
            <div className="form-group">
                <label htmlFor="name">Turnier-Beschreibung</label>
                <input className="form-control" type="text" name="name" id="edittournament-textfield-description"
                    value={description} placeholder={description}
                    onChange={this.handleDescriptionInput.bind(this)}/>
            </div>
            <div className="form-group custom-control custom-checkbox">
                <input className="custom-control-input" type="checkbox" name="isPublic"
                    id="edittournament-checkbox-isPublic" value={isPublic}
                    onChange={this.handlePublicInput.bind(this)}/>
                <label htmlFor="isPublic" className="custom-control-label">Das Turnier öffentlich anzeigen</label>
            </div>
            <div className="form-group">
                <div className="input-group">
                    <Button color="success" className="px-5" id="edittournament-button"
                        onClick={this.handleClick.bind(this)}>Ändern</Button>
                </div>
            </div>
        </div>);
    }

    notifyOfContentUpdate() {
        const {name, description, isPublic} = this.props;

        this.setState({
            name: name ? name : '', description: description ? description : '', isPublic: isPublic
        });
    }

    handleClick() {
        // TODO: Apply changes to the tournament properties
    }

    handleNameInput(input) {
        this.setState({name: input.target.value});
    }

    handleDescriptionInput(input) {
        this.setState({description: input.target.value});
    }

    handlePublicInput(input) {
        this.setState({public: input.target.value});
    }
}

function mapStateToTournamentFormProps(state) {
    const {name, description, isPublic} = state.tournamentinfo;
    return {name, description, isPublic};
}

const VisibleEditTournamentForm = connect(mapStateToTournamentFormProps, null, null,
    {withRef: true})(EditTournamentForm);

class EditTeamField extends React.Component {
    render() {
        return (<Card className="container my-4">
            <CardBody>
                <h2>Team-Namen ändern</h2>
                <VisibleEditTeamNamesForm ref={form => {
                    this._visibleeditteamnamesform = form;
                }}/>
            </CardBody>
        </Card>);
    }

    notifyOfContentUpdate() {
        this._visibleeditteamnamesform.getWrappedInstance().notifyOfContentUpdate();
    }
}

class EditTeamNamesForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            teams: []
        };
    }

    render() {
        const {teams} = this.state;

        return (<div>
            <Table className="table-striped mt-3">
                <tbody>
                    {teams.map((team, index) => <tr key={index}>
                        <td><Button outline size="sm" className="changeTeamnameButton"
                            id={'editteam-button-team_' + team.id}
                            onClick={this.handleClick.bind(this, index)}>Ändern</Button></td>
                        <td className="w-100"><input className="form-control" type="text"
                            id={'editteam-textfield-team_' + team.id} value={team.name}
                            placeholder={team.name}
                            onChange={this.handleNameInput.bind(this, index)}/></td>
                    </tr>)}
                </tbody>
            </Table>
        </div>);
    }

    notifyOfContentUpdate() {
        const {teams} = this.props;

        this.setState({
            teams: teams
        });
    }

    handleNameInput(index, input) {
        const team = this.state.teams.slice();

        team[index].name = input.target.value;

        this.setState({
            teams: team
        });
    }

    handleClick(index) {
        updateTeamName(this.state.teams[index], () => {
            notify.show('Team Name wurde erfolgreich geändert.', 'success', 5000);
        }, () => {
            notify.show('Team Name konnte nicht geändert werden.', 'warning', 5000);
        });
    }
}

function mapStateToTeamFormProps(state) {
    const {teams} = state.tournamentinfo;
    return {teams};
}

const VisibleEditTeamNamesForm = connect(mapStateToTeamFormProps, null, null, {withRef: true})(EditTeamNamesForm);

