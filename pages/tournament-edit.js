import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {notify} from 'react-notify-toast';
import Router from 'next/router';
import {
    Alert, Container, Button, Card, CardBody, Input, Label, Table
} from 'reactstrap';

import {requestTournament} from '../js/api';
import {TurniereNavigation} from '../js/components/Navigation';
import {BigImage} from '../js/components/BigImage';
import {UserRestrictor, Option} from '../js/components/UserRestrictor';
import {Footer} from '../js/components/Footer';
import {Login} from '../js/components/Login';
import {ErrorPageComponent} from '../js/components/ErrorComponents';
import {updateTeamName, updateTournament} from '../js/api';

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
        requestTournament(getTournamentIdentifier(this.props.query), () => {
            this.setState({validCode: true, loaded: true});
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
    const {name, ownerUsername} = state.tournamentinfo;
    const {isSignedIn, username} = state.userinfo;
    return {tournamentname: name, ownerUsername, isSignedIn, username};
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

function ReturnToTournamentButtonBase(props) {
    const tournamentIdentifier = props.id || props.code;

    return (<Container className="px-0">
        <Button color="secondary" className="mb-5 w-100" href={'/t/' + tournamentIdentifier}>Zurück zum Turnier</Button>
    </Container>);
}

const ReturnToTournamentButton = connect(state => ({
    code: state.tournamentinfo.code,
    id: state.tournamentinfo.id
}))(ReturnToTournamentButtonBase);

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
            ...buildEditTournamentFormState(props),
            saving: false,
            lastLoadedKey: buildEditTournamentFormKey(props)
        };
        this.handleClick = this.handleClick.bind(this);
    }

    static getDerivedStateFromProps(props, state) {
        const nextLoadedKey = buildEditTournamentFormKey(props);
        if (state.lastLoadedKey === nextLoadedKey) {
            return null;
        }
        return {
            ...buildEditTournamentFormState(props),
            saving: false,
            lastLoadedKey: nextLoadedKey
        };
    }

    render() {
        const {
            name, description, isPublic, readOnlyMode, syncTargetUrl,
            syncAuthToken, syncLastPushedAt, syncLastPushError, saving
        } = this.state;
        const currentlyReadOnly = this.props.readOnlyMode === true;

        return (<div>
            {readOnlyMode &&
                <Alert color="warning" data-testid="readonly-edit-alert">
                    Dieses Turnier ist als Follower schreibgeschützt. Auf dieser Seite sind nur Sync-Konfiguration und
                    Takeover erlaubt.
                </Alert>}
            <div className="form-group">
                <label htmlFor="name">Turnier-Name</label>
                <input className="form-control" type="text" name="name" id="edittournament-textfield-name"
                    disabled={currentlyReadOnly}
                    value={name} placeholder={name} onChange={this.handleNameInput.bind(this)}/>
            </div>
            <div className="form-group">
                <label htmlFor="name">Turnier-Beschreibung</label>
                <input className="form-control" type="text" name="name" id="edittournament-textfield-description"
                    disabled={currentlyReadOnly}
                    value={description} placeholder={description}
                    onChange={this.handleDescriptionInput.bind(this)}/>
            </div>
            <div className="form-group custom-control custom-checkbox">
                <input className="custom-control-input" type="checkbox" name="isPublic"
                    disabled={currentlyReadOnly}
                    checked={isPublic}
                    id="edittournament-checkbox-isPublic" value={isPublic}
                    onChange={this.handlePublicInput.bind(this)}/>
                <label htmlFor="isPublic" className="custom-control-label">Das Turnier öffentlich anzeigen</label>
            </div>
            <div className="form-group custom-control custom-checkbox mt-4">
                <input className="custom-control-input" type="checkbox" name="readOnlyMode"
                    id="edittournament-checkbox-readOnlyMode" checked={readOnlyMode}
                    onChange={this.handleReadOnlyModeInput.bind(this)}/>
                <label htmlFor="readOnlyMode" className="custom-control-label">
                    Follower-Modus aktivieren
                </label>
            </div>
            <div className="form-group mt-3">
                <Label htmlFor="edittournament-textfield-syncTargetUrl">Sync-Ziel-URL</Label>
                <Input type="text" id="edittournament-textfield-syncTargetUrl"
                    value={syncTargetUrl} onChange={this.handleSyncTargetUrlInput.bind(this)}
                    placeholder="https://remote.example/tournaments/123/sync_state"/>
            </div>
            <div className="form-group">
                <Label htmlFor="edittournament-textfield-syncAuthToken">Sync-Token</Label>
                <Input type="text" id="edittournament-textfield-syncAuthToken"
                    value={syncAuthToken} onChange={this.handleSyncAuthTokenInput.bind(this)}
                    placeholder="gemeinsames secret"/>
            </div>
            <div className="form-group">
                <h5 className="mb-2">Sync-Status</h5>
                <div data-testid="sync-last-pushed-at">
                    Letzter erfolgreicher Push: {formatSyncTimestamp(syncLastPushedAt)}
                </div>
                <div data-testid="sync-last-push-error">
                    Letzter Fehler: {syncLastPushError ? syncLastPushError : 'Kein Fehler gespeichert'}
                </div>
            </div>
            <div className="form-group">
                <div className="input-group">
                    <Button color="success" className="px-5" id="edittournament-button"
                        disabled={saving}
                        onClick={this.handleClick}>{saving ? 'Speichert...' : 'Ändern'}</Button>
                </div>
            </div>
        </div>);
    }

    notifyOfContentUpdate() {
        this.setState({
            ...buildEditTournamentFormState(this.props),
            saving: false,
            lastLoadedKey: buildEditTournamentFormKey(this.props)
        });
    }

    handleClick() {
        const {tournamentId, readOnlyMode: currentlyReadOnly} = this.props;
        const payload = {
            read_only_mode: this.state.readOnlyMode,
            sync_target_url: this.state.syncTargetUrl.trim(),
            sync_auth_token: this.state.syncAuthToken.trim()
        };

        if (!currentlyReadOnly) {
            payload.name = this.state.name;
            payload.description = this.state.description;
            payload.public = this.state.isPublic;
        }

        this.setState({saving: true});
        updateTournament(tournamentId, payload, updatedTournament => {
            this.setState({
                name: updatedTournament.name || '',
                description: updatedTournament.description || '',
                isPublic: updatedTournament.public === true,
                readOnlyMode: updatedTournament.read_only_mode === true,
                syncTargetUrl: updatedTournament.sync_target_url || '',
                syncAuthToken: updatedTournament.sync_auth_token || '',
                syncLastPushedAt: updatedTournament.sync_last_pushed_at ?
                    new Date(updatedTournament.sync_last_pushed_at) : null,
                syncLastPushError: updatedTournament.sync_last_push_error || '',
                saving: false
            });
            notify.show('Turnier-Einstellungen wurden gespeichert.', 'success', 4000);
            Router.push('/t/' + updatedTournament.id);
        }, errorBody => {
            const firstError = extractFirstErrorMessage(errorBody);
            this.setState({saving: false});
            notify.show(firstError, 'warning', 5000);
        });
    }

    handleNameInput(input) {
        this.setState({name: input.target.value});
    }

    handleDescriptionInput(input) {
        this.setState({description: input.target.value});
    }

    handlePublicInput(input) {
        this.setState({isPublic: input.target.checked});
    }

    handleReadOnlyModeInput(input) {
        this.setState({readOnlyMode: input.target.checked});
    }

    handleSyncTargetUrlInput(input) {
        this.setState({syncTargetUrl: input.target.value});
    }

    handleSyncAuthTokenInput(input) {
        this.setState({syncAuthToken: input.target.value});
    }
}

function mapStateToTournamentFormProps(state) {
    const {
        id, name, description, isPublic, readOnlyMode,
        syncTargetUrl, syncAuthToken, syncLastPushedAt, syncLastPushError
    } = state.tournamentinfo;
    return {
        tournamentId: id,
        name,
        description,
        isPublic,
        readOnlyMode,
        syncTargetUrl,
        syncAuthToken,
        syncLastPushedAt,
        syncLastPushError
    };
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
            teams: buildEditTeamNamesState(props),
            lastLoadedKey: buildEditTeamNamesKey(props)
        };
    }

    static getDerivedStateFromProps(props, state) {
        const nextLoadedKey = buildEditTeamNamesKey(props);
        if (state.lastLoadedKey === nextLoadedKey) {
            return null;
        }
        return {
            teams: buildEditTeamNamesState(props),
            lastLoadedKey: nextLoadedKey
        };
    }

    render() {
        const {teams} = this.state;
        const readOnlyMode = this.props.readOnlyMode === true;

        return (<div>
            {readOnlyMode &&
                <Alert color="info" data-testid="readonly-team-lock">
                    Team-Namen bleiben gesperrt, solange Follower-Modus aktiv ist.
                </Alert>}
            <Table className="table-striped mt-3">
                <tbody>
                    {teams.map((team, index) => <tr key={index}>
                        <td><Button outline size="sm" className="changeTeamnameButton"
                            disabled={readOnlyMode}
                            id={'editteam-button-team_' + team.id}
                            onClick={this.handleClick.bind(this, index)}>Ändern</Button></td>
                        <td className="w-100"><input className="form-control" type="text"
                            disabled={readOnlyMode}
                            id={'editteam-textfield-team_' + team.id} value={team.name}
                            placeholder={team.name}
                            onChange={this.handleNameInput.bind(this, index)}/></td>
                    </tr>)}
                </tbody>
            </Table>
        </div>);
    }

    notifyOfContentUpdate() {
        this.setState({
            teams: buildEditTeamNamesState(this.props),
            lastLoadedKey: buildEditTeamNamesKey(this.props)
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
    const {teams, readOnlyMode} = state.tournamentinfo;
    return {teams, readOnlyMode};
}

const VisibleEditTeamNamesForm = connect(mapStateToTeamFormProps, null, null, {withRef: true})(EditTeamNamesForm);

function extractFirstErrorMessage(errorBody) {
    if (errorBody && Array.isArray(errorBody.full_messages) && errorBody.full_messages.length > 0) {
        return errorBody.full_messages[0];
    }
    if (errorBody && Array.isArray(errorBody.errors) && errorBody.errors.length > 0) {
        return errorBody.errors[0];
    }
    if (errorBody && typeof errorBody.error === 'string' && errorBody.error.length > 0) {
        return errorBody.error;
    }
    return 'Turnier-Einstellungen konnten nicht gespeichert werden.';
}

function formatSyncTimestamp(value) {
    if (!value) {
        return 'Noch kein erfolgreicher Push';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unbekannter Zeitpunkt';
    }
    return date.toLocaleString('de-DE');
}

function getTournamentIdentifier(query) {
    if (query && query.id !== undefined) {
        return query.id;
    }
    if (query && query.code !== undefined) {
        return query.code;
    }
    return undefined;
}

function buildEditTournamentFormState(props) {
    return {
        name: props.name ? props.name : '',
        description: props.description ? props.description : '',
        isPublic: props.isPublic,
        readOnlyMode: props.readOnlyMode === true,
        syncTargetUrl: props.syncTargetUrl || '',
        syncAuthToken: props.syncAuthToken || '',
        syncLastPushedAt: props.syncLastPushedAt || null,
        syncLastPushError: props.syncLastPushError || ''
    };
}

function buildEditTournamentFormKey(props) {
    return JSON.stringify({
        name: props.name || '',
        description: props.description || '',
        isPublic: props.isPublic === true,
        readOnlyMode: props.readOnlyMode === true,
        syncTargetUrl: props.syncTargetUrl || '',
        syncAuthToken: props.syncAuthToken || '',
        syncLastPushedAt: props.syncLastPushedAt instanceof Date ?
            props.syncLastPushedAt.toISOString() :
            props.syncLastPushedAt || null,
        syncLastPushError: props.syncLastPushError || ''
    });
}

function buildEditTeamNamesState(props) {
    return (props.teams || []).map(team => ({...team}));
}

function buildEditTeamNamesKey(props) {
    return JSON.stringify({
        readOnlyMode: props.readOnlyMode === true,
        teams: (props.teams || []).map(team => ({
            id: team.id,
            name: team.name
        }))
    });
}
