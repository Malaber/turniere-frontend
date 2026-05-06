import Head from 'next/head';
import React from 'react';
import {Alert, Badge, Card, CardBody, Container, Spinner, Table} from 'reactstrap';

import {getAccountProfile} from '../js/api';
import {BigImage} from '../js/components/BigImage';
import {Footer} from '../js/components/Footer';
import {TurniereNavigation} from '../js/components/Navigation';

export default class AccountProfilePage extends React.Component {
    static async getInitialProps({query}) {
        return {query};
    }

    constructor(props) {
        super(props);
        this.state = {
            account: null,
            loading: true,
            errorStatus: null
        };
        this.onProfileSuccess = this.onProfileSuccess.bind(this);
        this.onProfileError = this.onProfileError.bind(this);
    }

    componentDidMount() {
        getAccountProfile(this.props.query.id, this.onProfileSuccess, this.onProfileError);
    }

    onProfileSuccess(account) {
        this.setState({
            account: normalizeAccountProfile(account),
            loading: false,
            errorStatus: null
        });
    }

    onProfileError(errorBody, status) {
        this.setState({
            account: null,
            loading: false,
            errorStatus: status || -1
        });
    }

    renderContent() {
        if (this.state.loading) {
            return (
                <div className='account-profile-loading' data-testid='account-profile-loading'>
                    <Spinner size='sm' /> Spielerprofil wird geladen.
                </div>
            );
        }

        if (this.state.errorStatus === 404) {
            return (
                <Alert color='warning' data-testid='account-profile-error'>
                    Dieses Spielerprofil wurde nicht gefunden.
                </Alert>
            );
        }

        if (!this.state.account) {
            return (
                <Alert color='danger' data-testid='account-profile-error'>
                    Spielerprofil konnte nicht geladen werden.
                </Alert>
            );
        }

        const account = this.state.account;
        return (
            <div data-testid='account-profile'>
                <Card className='account-profile-card'>
                    <CardBody>
                        <div className='account-profile-header'>
                            <div>
                                <h1 className='custom-font mb-1'>{account.name}</h1>
                                <div className='text-muted'>Spielerprofil #{account.id}</div>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <ProfileTeams teams={account.teams}/>
                <ProfileTournamentList
                    title='Turniere als Spieler'
                    empty='Keine öffentlichen Team-Zuordnungen.'
                    tournaments={account.tournaments}/>
                <ProfileTournamentList
                    title='Erstellte Turniere'
                    empty='Keine öffentlichen erstellten Turniere.'
                    tournaments={account.createdTournaments}/>
            </div>
        );
    }

    render() {
        const name = this.state.account ? this.state.account.name : 'Spielerprofil';
        return (
            <div>
                <Head>
                    <title>{name}: turnie.re</title>
                </Head>
                <TurniereNavigation/>
                <BigImage text='Spielerprofil'/>
                <div className='main'>
                    <Container className='py-4'>
                        {this.renderContent()}
                    </Container>
                </div>
                <Footer/>
            </div>
        );
    }
}

function normalizeAccountProfile(account) {
    return {
        id: account.id,
        name: account.name || account.username || ('Account #' + account.id),
        username: account.username || account.name || '',
        tournaments: normalizeTournamentList(account.tournaments),
        createdTournaments: normalizeTournamentList(account.created_tournaments),
        teams: Array.isArray(account.teams) ? account.teams.map(team => ({
            id: team.id,
            name: team.name || ('Team #' + team.id),
            tournament: normalizeTournament(team.tournament || {})
        })) : []
    };
}

function normalizeTournamentList(tournaments) {
    return Array.isArray(tournaments) ? tournaments.map(normalizeTournament) : [];
}

function normalizeTournament(tournament) {
    return {
        id: tournament.id,
        name: tournament.name || ('Turnier #' + tournament.id),
        code: tournament.code || '',
        public: tournament.public === true
    };
}

function TournamentVisibilityBadge({tournament}) {
    if (!tournament || typeof tournament.public !== 'boolean') {
        return null;
    }
    return (
        <Badge color={tournament.public ? 'success' : 'secondary'} pill>
            {tournament.public ? 'öffentlich' : 'privat'}
        </Badge>
    );
}

function tournamentHref(tournament) {
    return tournament && tournament.id ? '/t/' + tournament.id : '#';
}

function ProfileTeams({teams}) {
    return (
        <Card className='account-profile-card mt-3'>
            <CardBody>
                <h2 className='h5'>Teams</h2>
                {teams.length === 0 ? (
                    <div className='text-muted' data-testid='account-profile-teams-empty'>
                        Keine öffentlichen Teams verknüpft.
                    </div>
                ) : (
                    <Table responsive hover data-testid='account-profile-teams'>
                        <thead>
                            <tr>
                                <th>Team</th>
                                <th>Turnier</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teams.map(team => (
                                <tr key={team.id}>
                                    <td>{team.name}</td>
                                    <td>
                                        <a href={tournamentHref(team.tournament)}>
                                            {team.tournament.name}
                                        </a>
                                    </td>
                                    <td><TournamentVisibilityBadge tournament={team.tournament}/></td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );
}

function ProfileTournamentList({title, empty, tournaments}) {
    return (
        <Card className='account-profile-card mt-3'>
            <CardBody>
                <h2 className='h5'>{title}</h2>
                {tournaments.length === 0 ? (
                    <div className='text-muted'>{empty}</div>
                ) : (
                    <div className='account-profile-tournament-list'>
                        {tournaments.map(tournament => (
                            <a className='account-profile-tournament' href={tournamentHref(tournament)}
                                key={tournament.id}>
                                <span>{tournament.name}</span>
                                <TournamentVisibilityBadge tournament={tournament}/>
                            </a>
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
