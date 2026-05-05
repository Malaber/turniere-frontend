export const LOCAL_SAVE_ERROR_LOG_KEY = 'turniere.localSaveErrorLog.v1';
export const LOCAL_SAVE_ERROR_LOG_CHANGED_EVENT = 'turniere:local-save-error-log-changed';

const MAX_ENTRIES = 50;
const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 1200;
const REDACTED_VALUE = '[redacted]';

const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /authorization/i,
    /^client$/i,
    /^uid$/i
];

export function readLocalSaveErrorLog() {
    if (!canUseLocalStorage()) {
        return [];
    }
    try {
        const parsed = JSON.parse(window.localStorage.getItem(LOCAL_SAVE_ERROR_LOG_KEY) || '[]');
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter(entry => entry && entry.id)
            .slice(0, MAX_ENTRIES);
    } catch (error) {
        return [];
    }
}

export function recordLocalSaveError({method, url, payload, error}) {
    if (!canUseLocalStorage()) {
        return null;
    }
    const entry = createLocalSaveErrorEntry({method, url, payload, error});
    writeEntries([entry].concat(readLocalSaveErrorLog()).slice(0, MAX_ENTRIES));
    return entry;
}

export function removeLocalSaveErrorLogEntry(entryId) {
    writeEntries(readLocalSaveErrorLog().filter(entry => entry.id !== entryId));
}

export function clearLocalSaveErrorLog() {
    writeEntries([]);
}

export function markLocalSaveErrorRetrySuccess(entryId, response) {
    updateEntry(entryId, entry => Object.assign({}, entry, {
        retryCount: Number(entry.retryCount || 0) + 1,
        lastRetryAt: new Date().toISOString(),
        lastRetryStatus: response && response.status ? response.status : null,
        lastRetryResult: 'success'
    }));
}

export function markLocalSaveErrorRetryFailure(entryId, error) {
    const errorInfo = serializeError(error);
    updateEntry(entryId, entry => Object.assign({}, entry, {
        retryCount: Number(entry.retryCount || 0) + 1,
        lastRetryAt: new Date().toISOString(),
        lastRetryStatus: errorInfo.status,
        lastRetryResult: 'failed',
        lastRetryErrorMessage: errorInfo.message,
        lastRetryResponse: errorInfo.response
    }));
}

export function shouldRecordLocalSaveError(method, url) {
    const normalizedMethod = String(method || '').toLowerCase();
    const normalizedUrl = String(url || '');
    if (!canUseLocalStorage() || normalizedMethod === 'get') {
        return false;
    }
    return normalizedUrl.indexOf('/users') !== 0;
}

function createLocalSaveErrorEntry({method, url, payload, error}) {
    const errorInfo = serializeError(error);
    return {
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
        method: String(method || '').toUpperCase(),
        url: String(url || ''),
        payload: sanitizeValue(payload),
        retryPayload: cloneRetryPayload(payload),
        status: errorInfo.status,
        statusText: errorInfo.statusText,
        message: errorInfo.message,
        response: errorInfo.response,
        retryCount: 0,
        lastRetryAt: null,
        lastRetryStatus: null,
        lastRetryResult: null
    };
}

function serializeError(error) {
    const response = error && error.response ? error.response : null;
    const status = response ? response.status : null;
    const statusText = response && response.statusText ? response.statusText : '';
    const message = response && response.data ?
        summarizeResponseData(response.data) :
        (error && error.message ? error.message : 'Unbekannter Fehler');
    return {
        status,
        statusText,
        message,
        response: response ? sanitizeValue(response.data) : null
    };
}

function summarizeResponseData(data) {
    if (typeof data === 'string') {
        return truncateString(data);
    }
    if (Array.isArray(data && data.errors)) {
        return data.errors.map(item => String(item)).join(', ');
    }
    if (data && Array.isArray(data.full_messages)) {
        return data.full_messages.map(item => String(item)).join(', ');
    }
    if (data && data.errors && Array.isArray(data.errors.full_messages)) {
        return data.errors.full_messages.map(item => String(item)).join(', ');
    }
    if (data && typeof data.error === 'string') {
        return data.error;
    }
    if (data && typeof data.message === 'string') {
        return data.message;
    }
    try {
        return truncateString(JSON.stringify(data));
    } catch (error) {
        return 'Fehlerdetails konnten nicht gelesen werden.';
    }
}

function sanitizeValue(value, depth = 0, key = '') {
    if (isSensitiveKey(key)) {
        return REDACTED_VALUE;
    }
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        return truncateString(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (depth >= MAX_DEPTH) {
        return '[truncated]';
    }
    if (Array.isArray(value)) {
        return value.slice(0, 50).map(item => sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const output = {};
        Object.keys(value).slice(0, 50).forEach(childKey => {
            output[childKey] = sanitizeValue(value[childKey], depth + 1, childKey);
        });
        return output;
    }
    return String(value);
}

function cloneRetryPayload(value) {
    if (value === undefined) {
        return undefined;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return value;
    }
}

function isSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(String(key || '')));
}

function truncateString(value) {
    if (value.length <= MAX_STRING_LENGTH) {
        return value;
    }
    return value.slice(0, MAX_STRING_LENGTH) + '...';
}

function updateEntry(entryId, updater) {
    writeEntries(readLocalSaveErrorLog().map(entry => entry.id === entryId ? updater(entry) : entry));
}

function writeEntries(entries) {
    if (!canUseLocalStorage()) {
        return;
    }
    try {
        window.localStorage.setItem(LOCAL_SAVE_ERROR_LOG_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
        if (typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new window.CustomEvent(LOCAL_SAVE_ERROR_LOG_CHANGED_EVENT));
        }
    } catch (error) {
        // localStorage full or unavailable: save failure log must never break save handling.
    }
}

function canUseLocalStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
