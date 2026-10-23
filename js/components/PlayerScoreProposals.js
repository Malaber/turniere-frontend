import React, {useEffect, useRef, useState} from 'react';
import {Alert, Button, Card, CardBody, Form, Input, Label} from 'reactstrap';
import {getPlayerScoreMatches, submitPlayerScoreProposal} from '../api';
import {scoreProposalStrings} from '../locales/scoreProposals';

function useStrings() {
    const [language, setLanguage] = useState('de');
    useEffect(() => setLanguage(navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'), []);
    return scoreProposalStrings[language];
}

function formatScore(teams, scores) {
    return teams.map(team => `${team.name}: ${scores?.[team.id] ?? '–'}`).join(' · ');
}

export function PlayerScoreProposals({tournamentId}) {
    const strings = useStrings();
    const [matches, setMatches] = useState(null);
    const [error, setError] = useState(false);
    const request = useRef(0);
    const refresh = () => {
        const sequence = ++request.current;
        getPlayerScoreMatches(tournamentId, data => {
            if (sequence !== request.current) return;
            setMatches(data.matches || []);
            setError(false);
        }, () => {
            if (sequence === request.current) setError(true);
        });
    };
    useEffect(() => {
        setMatches(null);
        refresh();
        const timer = setInterval(refresh, 5000);
        return () => { clearInterval(timer); request.current += 1; };
    }, [tournamentId]);

    return <section className='container my-4' data-testid='player-score-proposals'>
        <h2>{strings.title}</h2>
        <p>{strings.intro}</p>
        {error && <Alert color='warning' role='alert'>{strings.error}</Alert>}
        <Button size='sm' color='secondary' outline onClick={refresh}>{strings.refresh}</Button>
        {matches === null && !error && <p role='status'>{strings.loading}</p>}
        {matches?.length === 0 && <p className='mt-3'>{strings.empty}</p>}
        {matches?.map(match => <ProposalCard key={match.match_id} match={match} strings={strings} refresh={refresh}/>)}
    </section>;
}

function ProposalCard({match, strings, refresh}) {
    const [teamId, setTeamId] = useState(match.eligible_team_ids[0]);
    const [scores, setScores] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const teams = match.teams || [];
    const submit = event => {
        event.preventDefault();
        const values = teams.map(team => scores[team.id]);
        if (values.some(value => value === undefined || !/^\d+$/.test(value) || Number(value) > 1000)) {
            setError(strings.invalid);
            return;
        }
        setBusy(true);
        setError('');
        submitPlayerScoreProposal(match.match_id, Number(teamId), Object.fromEntries(teams.map(team => [team.id, Number(scores[team.id])])), () => {
            setBusy(false);
            refresh();
        }, (_, status) => {
            setBusy(false);
            setError(status === 409 ? strings.conflict : strings.saveError);
            refresh();
        });
    };
    return <Card className='mt-3' data-testid={`player-proposal-${match.match_id}`}><CardBody>
        <h3 className='h5'>{teams.map(team => team.name).join(' – ')}</h3>
        <p data-testid='official-score'><strong>{strings.official}: </strong>{formatScore(teams, match.official_scores)}</p>
        <ul>{teams.map(team => {
            const proposal = match.proposals.find(item => item.team_id === team.id);
            return <li key={team.id}>{team.name}: {proposal ? `${strings.proposed}: ${formatScore(teams, proposal.scores)}` : strings.pending}</li>;
        })}</ul>
        {match.locked ? <Alert color='info' role='status'>{strings.locked}</Alert> : !match.accepting ?
            <Alert color='secondary'>{strings.closed}</Alert> :
            <Form onSubmit={submit}>
                <Label for={`proposal-team-${match.match_id}`}>{strings.submittingTeam}</Label>
                <Input type='select' id={`proposal-team-${match.match_id}`} value={teamId} disabled={busy} onChange={event => setTeamId(event.target.value)}>
                    {teams.filter(team => match.eligible_team_ids.includes(team.id)).map(team => <option value={team.id} key={team.id}>{team.name}</option>)}
                </Input>
                <div className='row my-2'>{teams.map(team => <div className='col-6' key={team.id}>
                    <Label for={`proposal-${match.match_id}-${team.id}`}>{team.name}</Label>
                    <Input id={`proposal-${match.match_id}-${team.id}`} type='number' min='0' max='1000' step='1' required disabled={busy}
                        value={scores[team.id] ?? ''} onChange={event => setScores({...scores, [team.id]: event.target.value})}/>
                </div>)}</div>
                <Button type='submit' color='primary' disabled={busy}>{busy ? strings.saving : strings.submit}</Button>
            </Form>}
        {error && <Alert className='mt-2' color='warning' role='alert'>{error}</Alert>}
    </CardBody></Card>;
}

export function PlayerScoreAudit({metadata}) {
    const strings = useStrings();
    if (!metadata.proposed_scores) return null;
    const format = scores => Object.entries(scores || {}).map(([team, points]) => `${strings.team} ${team}: ${points}`).join(' · ');
    return <div data-testid='player-score-audit'>
        <div><strong>{strings.history}: </strong>{format(metadata.proposed_scores)}</div>
        <div><strong>{strings.previous}: </strong>{format(metadata.previous_scores)}</div>
    </div>;
}
