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
            syncLastPushError: cachedTournament.syncLastPushError || '',
            location: cachedTournament.location || '',
            startsAt: cachedTournament.startsAt || null,
            endsAt: cachedTournament.endsAt || null,
            websiteUrl: cachedTournament.websiteUrl || ''
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
    if (typeof mergedTournament.location === 'undefined' && hasOwn(fallback, 'location')) {
        mergedTournament.location = fallback.location;
    }
    if (typeof mergedTournament.starts_at === 'undefined' && hasOwn(fallback, 'startsAt')) {
        mergedTournament.starts_at = fallback.startsAt;
    }
    if (typeof mergedTournament.ends_at === 'undefined' && hasOwn(fallback, 'endsAt')) {
        mergedTournament.ends_at = fallback.endsAt;
    }
    if (typeof mergedTournament.website_url === 'undefined' && hasOwn(fallback, 'websiteUrl')) {
        mergedTournament.website_url = fallback.websiteUrl;
    }

    return mergedTournament;
}
