function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
}

export function readCachedTournamentSyncMetadata(tournamentId) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return null;
    }

    try {
        const reduxStateRaw = localStorage.getItem('reduxState');
        if (!reduxStateRaw) {
            return null;
        }

        const reduxState = JSON.parse(reduxStateRaw);
        const cachedTournament = reduxState && reduxState.tournamentinfo;
        if (!cachedTournament || cachedTournament.id !== tournamentId) {
            return null;
        }

        return {
            readOnlyMode: cachedTournament.readOnlyMode === true,
            syncTargetUrl: cachedTournament.syncTargetUrl || '',
            syncAuthToken: cachedTournament.syncAuthToken || '',
            syncLastPushedAt: cachedTournament.syncLastPushedAt || null,
            syncLastPushError: cachedTournament.syncLastPushError || ''
        };
    } catch (_error) {
        return null;
    }
}

export function mergeTournamentSyncMetadata(apiTournament, cachedMetadata = null) {
    const fallback = cachedMetadata || readCachedTournamentSyncMetadata(apiTournament.id);
    return {
        ...apiTournament,
        read_only_mode: hasOwn(apiTournament, 'read_only_mode') ? apiTournament.read_only_mode : fallback?.readOnlyMode,
        sync_target_url: hasOwn(apiTournament, 'sync_target_url') ? apiTournament.sync_target_url : fallback?.syncTargetUrl,
        sync_auth_token: hasOwn(apiTournament, 'sync_auth_token') ? apiTournament.sync_auth_token : fallback?.syncAuthToken,
        sync_last_pushed_at: hasOwn(apiTournament, 'sync_last_pushed_at') ?
            apiTournament.sync_last_pushed_at :
            fallback?.syncLastPushedAt,
        sync_last_push_error: hasOwn(apiTournament, 'sync_last_push_error') ?
            apiTournament.sync_last_push_error :
            fallback?.syncLastPushError
    };
}
