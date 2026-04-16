import { ApiClient, ApiError, expectStatus } from './api-client';

interface BeamerResponse {
  id: number;
}

export async function setDefaultBeamerDisplayState(
  client: ApiClient,
  tournamentId: number,
  displayState: string,
): Promise<void> {
  let beamerId: number;

  try {
    const beamerRes = await client.get<BeamerResponse>(
      `/tournaments/${tournamentId}/beamers/by_name`,
      { name: 'default' },
    );
    expectStatus(beamerRes, 200, 'fetch default beamer');
    beamerId = beamerRes.json.id;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }

    const createRes = await client.post<BeamerResponse>(
      `/tournaments/${tournamentId}/beamers`,
      { name: 'default', display_state: displayState },
    );
    expectStatus(createRes, 201, 'create default beamer');
    return;
  }

  const updateRes = await client.patch(
    `/tournaments/${tournamentId}/beamers/${beamerId}`,
    { display_state: displayState },
  );
  expectStatus(updateRes, 200, `set default beamer to ${displayState}`);
}
