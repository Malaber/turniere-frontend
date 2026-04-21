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

    const mergedTournament = {...apiTournament};

    if (typeof mergedTournament.read_only_mode === 'undefined' && hasOwn(fallback, 'readOnlyMode')) {
        mergedTournament.read_only_mode = fallback.readOnlyMode;
    }
    if (typeof mergedTournament.sync_target_url === 'undefined' && hasOwn(fallback, 'syncTargetUrl')) {
        mergedTournament.sync_target_url = fallback.syncTargetUrl;
    }
    if (typeof mergedTournament.sync_auth_token === 'undefined' && hasOwn(fallback, 'syncAuthToken')) {
        mergedTournament.sync_auth_token = fallback.syncAuthToken;
    }
    if (typeof mergedTournament.sync_last_pushed_at === 'undefined' && hasOwn(fallback, 'syncLastPushedAt')) {
        mergedTournament.sync_last_pushed_at = fallback.syncLastPushedAt;
    }
    if (typeof mergedTournament.sync_last_push_error === 'undefined' && hasOwn(fallback, 'syncLastPushError')) {
        mergedTournament.sync_last_push_error = fallback.syncLastPushError;
    }

    return mergedTournament;
}
