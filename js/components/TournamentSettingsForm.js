import React from 'react';
import {Alert, Button, Input, Label} from 'reactstrap';
import {notify} from 'react-notify-toast';
import {testTournamentSync, updateTournament} from '../api';

export class TournamentSettingsForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            ...buildEditTournamentFormState(props.tournament),
            saving: false,
            testingSync: false,
            syncTestMessage: '',
            syncTestStatus: '',
            lastLoadedKey: buildEditTournamentFormKey(props.tournament)
        };
        this.handleClick = this.handleClick.bind(this);
        this.handleTestSyncClick = this.handleTestSyncClick.bind(this);
    }

    static getDerivedStateFromProps(props, state) {
        const nextLoadedKey = buildEditTournamentFormKey(props.tournament);
        if (state.lastLoadedKey === nextLoadedKey) {
            return null;
        }
        return {
            ...buildEditTournamentFormState(props.tournament),
            saving: false,
            testingSync: false,
            syncTestMessage: '',
            syncTestStatus: '',
            lastLoadedKey: nextLoadedKey
        };
    }

    render() {
        const {
            name, description, isPublic, readOnlyMode, syncTargetUrl,
            syncAuthToken, syncLastPushedAt, syncLastPushError, saving,
            testingSync, syncTestMessage, syncTestStatus
        } = this.state;
        const currentlyReadOnly = this.props.tournament.readOnlyMode === true;
        const syncTestConfigured = !readOnlyMode && syncTargetUrl.trim().length > 0 && syncAuthToken.trim().length > 0;

        return (<div>
            {readOnlyMode &&
                <Alert color="warning" data-testid="readonly-edit-alert" className="mt-2">
                    Dieses Turnier ist als Follower schreibgeschützt. Auf dieser Seite sind nur Sync-Konfiguration und
                    Takeover erlaubt.
                </Alert>}
            <div className="form-group mb-3">
                <label htmlFor="edittournament-textfield-name">Turnier-Name</label>
                <input className="form-control" type="text" name="name" id="edittournament-textfield-name"
                    disabled={currentlyReadOnly || this.props.disabled}
                    value={name} placeholder={name} onChange={this.handleNameInput.bind(this)}/>
            </div>
            <div className="form-group mb-3">
                <label htmlFor="edittournament-textfield-description">Turnier-Beschreibung</label>
                <input className="form-control" type="text" name="name" id="edittournament-textfield-description"
                    disabled={currentlyReadOnly || this.props.disabled}
                    value={description} placeholder={description}
                    onChange={this.handleDescriptionInput.bind(this)}/>
            </div>
            <div className="form-group mb-3 form-check">
                <input className="form-check-input" type="checkbox" name="isPublic"
                    disabled={currentlyReadOnly || this.props.disabled}
                    checked={isPublic}
                    id="edittournament-checkbox-isPublic"
                    onChange={this.handlePublicInput.bind(this)}/>
                <label htmlFor="edittournament-checkbox-isPublic" className="form-check-label">
                    Das Turnier öffentlich anzeigen
                </label>
            </div>
            <div className="form-group mb-3 form-check mt-4">
                <input className="form-check-input" type="checkbox" name="readOnlyMode"
                    disabled={this.props.disabled}
                    id="edittournament-checkbox-readOnlyMode" checked={readOnlyMode}
                    onChange={this.handleReadOnlyModeInput.bind(this)}/>
                <label htmlFor="edittournament-checkbox-readOnlyMode" className="form-check-label">
                    Follower-Modus aktivieren
                </label>
            </div>
            <div className="form-group mb-3 mt-3">
                <Label htmlFor="edittournament-textfield-syncTargetUrl">Sync-Ziel-URL</Label>
                <Input type="text" id="edittournament-textfield-syncTargetUrl"
                    disabled={this.props.disabled}
                    value={syncTargetUrl} onChange={this.handleSyncTargetUrlInput.bind(this)}
                    placeholder="https://remote.example/tournaments/123/sync_state"/>
            </div>
            <div className="form-group mb-3">
                <Label htmlFor="edittournament-textfield-syncAuthToken">Sync-Token</Label>
                <Input type="text" id="edittournament-textfield-syncAuthToken"
                    disabled={this.props.disabled}
                    value={syncAuthToken} onChange={this.handleSyncAuthTokenInput.bind(this)}
                    placeholder="gemeinsames secret"/>
            </div>
            <div className="form-group mb-3">
                <h5 className="mb-2">Sync-Status</h5>
                <div data-testid="sync-last-pushed-at">
                    Letzter erfolgreicher Push: {formatSyncTimestamp(syncLastPushedAt)}
                </div>
                <div data-testid="sync-last-push-error">
                    Letzter Fehler: {syncLastPushError ? syncLastPushError : 'Kein Fehler gespeichert'}
                </div>
            </div>
            {!readOnlyMode &&
                <div className="form-group mb-3">
                    <Button color="info" outline id="edittournament-button-test-sync"
                        data-testid="sync-test-button"
                        disabled={testingSync || !syncTestConfigured || this.props.disabled}
                        onClick={this.handleTestSyncClick}>
                        {testingSync ? 'Teste Sync...' : 'Sync testen'}
                    </Button>
                    <div className="mt-2 text-muted" data-testid="sync-test-hint">
                        Test macht sofort echten Roundtrip zum konfigurierten Follower.
                    </div>
                    {syncTestStatus &&
                        <Alert className="mt-3 mb-0" color={syncTestStatus === 'success' ? 'success' : 'danger'}
                            data-testid="sync-test-result">
                            {syncTestMessage}
                        </Alert>}
                </div>}
            <div className="form-group">
                <Button color="success" className="px-5" id="edittournament-button"
                    disabled={saving || this.props.disabled}
                    onClick={this.handleClick}>{saving ? 'Speichert...' : 'Ändern'}</Button>
            </div>
        </div>);
    }

    handleClick() {
        const {tournament, disabled} = this.props;
        if (disabled) return;

        const payload = {
            read_only_mode: this.state.readOnlyMode,
            sync_target_url: this.state.syncTargetUrl.trim(),
            sync_auth_token: this.state.syncAuthToken.trim()
        };

        if (!tournament.readOnlyMode) {
            payload.name = this.state.name;
            payload.description = this.state.description;
            payload.public = this.state.isPublic;
        }

        this.setState({saving: true});
        updateTournament(tournament.id, payload, updatedTournament => {
            this.setState({
                ...buildEditTournamentFormState(updatedTournament),
                saving: false,
                syncTestMessage: '',
                syncTestStatus: ''
            });
            notify.show('Turnier-Einstellungen wurden gespeichert.', 'success', 4000);
            this.props.onTournamentChange();
        }, errorBody => {
            const firstError = extractFirstErrorMessage(errorBody);
            this.setState({saving: false});
            notify.show(firstError, 'warning', 5000);
        });
    }

    handleTestSyncClick() {
        const {tournament, disabled} = this.props;
        if (disabled) return;

        this.setState({
            testingSync: true,
            syncTestMessage: '',
            syncTestStatus: ''
        });

        testTournamentSync(tournament.id, updatedTournament => {
            this.setState({
                ...buildEditTournamentFormState(updatedTournament),
                testingSync: false,
                syncTestMessage: 'Sync-Test erfolgreich.',
                syncTestStatus: 'success'
            });
            notify.show('Sync-Test erfolgreich.', 'success', 4000);
            this.props.onTournamentChange();
        }, errorBody => {
            const firstError = extractFirstErrorMessage(errorBody);
            this.setState(prevState => ({
                testingSync: false,
                syncLastPushError: errorBody && errorBody.tournament ?
                    (errorBody.tournament.sync_last_push_error || prevState.syncLastPushError) :
                    prevState.syncLastPushError,
                syncTestMessage: firstError,
                syncTestStatus: 'error'
            }));
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

function buildEditTournamentFormState(tournament) {
    return {
        name: tournament.name || '',
        description: tournament.description || '',
        isPublic: tournament.public === true,
        readOnlyMode: tournament.readOnlyMode === true,
        syncTargetUrl: tournament.syncTargetUrl || '',
        syncAuthToken: tournament.syncAuthToken || '',
        syncLastPushedAt: tournament.syncLastPushedAt || null,
        syncLastPushError: tournament.syncLastPushError || ''
    };
}

function buildEditTournamentFormKey(tournament) {
    return JSON.stringify({
        name: tournament.name || '',
        description: tournament.description || '',
        isPublic: tournament.public === true,
        readOnlyMode: tournament.readOnlyMode === true,
        syncTargetUrl: tournament.syncTargetUrl || '',
        syncAuthToken: tournament.syncAuthToken || '',
        syncLastPushedAt: tournament.syncLastPushedAt || null,
        syncLastPushError: tournament.syncLastPushError || ''
    });
}
