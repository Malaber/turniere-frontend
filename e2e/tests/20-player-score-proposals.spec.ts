import {test, expect} from '@playwright/test';
import {injectAuth} from '../helpers/auth';

async function enableCapability(page, tournamentId) {
  await page.route(`**/tournaments/${tournamentId}`, async route => {
    const response = await route.fetch();
    await route.fulfill({response, json: {...await response.json(), player_score_proposals_enabled: true}});
  });
}
import {seedReadOnlyFollowerTournament} from '../helpers/scenario-seeder';
import {locatorKeyframe} from '../helpers/screenshot';

// The new API is mocked here so frontend CI also runs against the pinned, released
// backend image. Backend request/concurrency specs exercise authorization and agreement.
test('Player proposals stay separate from official scores and lock on agreement', async ({context, page}, testInfo) => {
  await injectAuth(context);
  const {tournament} = await seedReadOnlyFollowerTournament();
  const match = {
    match_id: 246, teams: [{id: 11, name: 'Blue'}, {id: 12, name: 'Gold'}],
    eligible_team_ids: [11], official_scores: {'11': 0, '12': 0},
    proposals: [] as {team_id: number, scores: Record<string, number>}[],
    accepting: true, locked: false, revision: 0,
  };
  await page.route(`**/tournaments/${tournament.id}/player_score_matches`, route =>
    route.fulfill({json: {matches: [match]}}));
  await page.route('**/matches/246/score_proposal', async route => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().postDataJSON()).toEqual({team_id: 11, scores: {'11': 7, '12': 10}});
    match.proposals = [{team_id: 11, scores: {'11': 7, '12': 10}}];
    match.revision += 1;
    await route.fulfill({json: match});
  });
  await enableCapability(page, tournament.id);
  await page.goto(`/t/${tournament.id}`);
  const card = page.getByTestId('player-proposal-246');
  await expect(card).toBeVisible();
  await expect(card.locator('select option')).toHaveCount(1);
  await card.locator('#proposal-246-11').fill('7');
  await card.locator('#proposal-246-12').fill('10');
  await card.locator('button[type=submit]').click();
  await expect(card.locator('li').first()).toContainText('Blue: 7');
  await expect(card.getByTestId('official-score')).toContainText('Blue: 0');
  await locatorKeyframe(card, testInfo, 'pending_proposal');

  match.proposals.push({team_id: 12, scores: {'11': 7, '12': 10}});
  match.locked = true;
  match.accepting = false;
  await page.getByTestId('player-score-proposals').getByRole('button', {name: 'Refresh', exact: true}).click();
  await expect(card.getByRole('alert')).toContainText('Proposal locked');
  await expect(card.locator('form')).toHaveCount(0);
  await expect(card.getByTestId('official-score')).toContainText('Blue: 0');
  await locatorKeyframe(card, testInfo, 'locked_waiting_for_leader');

  match.official_scores = {'11': 7, '12': 10};
  await page.getByTestId('player-score-proposals').getByRole('button', {name: 'Refresh', exact: true}).click();
  await expect(card.getByTestId('official-score')).toContainText('Blue: 7');
});

test('Proposal errors stay visible and public visitors see no submission form', async ({context, page}) => {
  const {tournament} = await seedReadOnlyFollowerTournament(true);
  await enableCapability(page, tournament.id);
  await page.goto(`/t/${tournament.id}`);
  await expect(page.getByRole('heading', {name: tournament.name, exact: true})).toBeVisible();
  await expect(page.getByTestId('player-score-proposals')).toHaveCount(0);
  await injectAuth(context);
  await page.route(`**/tournaments/${tournament.id}/player_score_matches`, route =>
    route.fulfill({status: 503, json: {error: 'Unavailable'}}));
  await page.reload();
  await expect(page.getByTestId('player-score-proposals').getByRole('alert')).toContainText('Could not load proposals');
});
