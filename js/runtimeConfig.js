const browserApiUrl = '/api';
const defaultServerApiUrl = 'https://api.turnie.re';

export function getApiUrl() {
    if (typeof window !== 'undefined') {
        return browserApiUrl;
    }

    if (typeof process !== 'undefined' && process.env && process.env.TURNIERE_API_URL) {
        return process.env.TURNIERE_API_URL;
    }

    return defaultServerApiUrl;
}
