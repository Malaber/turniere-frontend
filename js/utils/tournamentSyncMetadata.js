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

    if (!fallback) {
        return apiTournament;
    }

    return {
        ...apiTournament,
        read_only_mode: hasOwn(fallback, 'readOnlyMode') ? fallback.readOnlyMode : apiTournament.read_only_mode,
        sync_target_url: hasOwn(fallback, 'syncTargetUrl') ? fallback.syncTargetUrl : apiTournament.sync_target_url,
        sync_auth_token: hasOwn(fallback, 'syncAuthToken') ? fallback.syncAuthToken : apiTournament.sync_auth_token,
        sync_last_pushed_at: hasOwn(fallback, 'syncLastPushedAt') ?
            fallback.syncLastPushedAt :
            apiTournament.sync_last_pushed_at,
        sync_last_push_error: hasOwn(fallback, 'syncLastPushError') ?
            fallback.syncLastPushError :
            apiTournament.sync_last_push_error
    };
}
