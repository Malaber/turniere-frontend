const defaultApiUrl = 'https://api.turnie.re';

export function getApiUrl() {
    if (typeof window !== 'undefined' &&
        window.__TURNIERE_RUNTIME_CONFIG__ &&
        window.__TURNIERE_RUNTIME_CONFIG__.apiUrl) {
        return window.__TURNIERE_RUNTIME_CONFIG__.apiUrl;
    }

    if (typeof process !== 'undefined' && process.env && process.env.TURNIERE_API_URL) {
        return process.env.TURNIERE_API_URL;
    }

    return defaultApiUrl;
}
