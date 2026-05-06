export function isBrowserTabActive() {
    if (typeof document === 'undefined') {
        return true;
    }

    if (typeof document.visibilityState === 'string') {
        return document.visibilityState === 'visible';
    }

    if (typeof document.hidden === 'boolean') {
        return !document.hidden;
    }

    return true;
}
