import {getApiUrl} from '../runtimeConfig';
import {recordLocalSaveError, shouldRecordLocalSaveError} from '../utils/localSaveErrorLog';

const axios = require('axios');

let latestStateProvider = null;
let authResponseHandler = null;
let latestAuthHeaders = {};

export function configureAuthHandling(options) {
    latestStateProvider = options.latestStateProvider;
    authResponseHandler = options.authResponseHandler;
}

export function postRequest(state, url, data) {
    return request(state, 'post', url, data);
}

export function getRequest(state, url) {
    return request(state, 'get', url);
}

export function deleteRequest(state, url) {
    return request(state, 'delete', url);
}

export function patchRequest(state, url, data) {
    return request(state, 'patch', url, data);
}

export function putRequest(state, url, data) {
    return request(state, 'put', url, data);
}

export function retryStoredRequest(state, entry) {
    if (!entry || !entry.method || !entry.url) {
        return Promise.reject(new Error('Invalid retry entry.'));
    }
    const method = String(entry.method).toLowerCase();
    if (['post', 'put', 'patch', 'delete'].indexOf(method) === -1) {
        return Promise.reject(new Error('Unsupported retry method.'));
    }
    const data = Object.prototype.hasOwnProperty.call(entry, 'retryPayload') ?
        entry.retryPayload :
        entry.payload;
    return request(state, method, entry.url, data, {skipLocalSaveErrorLog: true});
}

function request(state, method, url, data, options = {}) {
    const config = {
        headers: generateHeaders(state)
    };
    const apiUrl = getApiUrl();
    const args = method === 'get' || method === 'delete' ?
        [apiUrl + url, config] :
        [apiUrl + url, data, config];

    return axios[method](...args).then(response => {
        storeAuthHeaders(response);
        return response;
    }).catch(error => {
        if (error.response) {
            storeAuthHeaders(error.response);
        }
        if (!options.skipLocalSaveErrorLog && shouldRecordLocalSaveError(method, url)) {
            recordLocalSaveError({method, url, payload: data, error});
        }
        throw error;
    });
}

function storeAuthHeaders(response) {
    const responseAuthHeaders = authHeadersFromResponse(response);
    if (responseAuthHeaders) {
        latestAuthHeaders = responseAuthHeaders;
    }
    if (authResponseHandler) {
        authResponseHandler(response);
    }
}

function generateHeaders(state) {
    let currentState = state;
    if (latestStateProvider) {
        try {
            currentState = latestStateProvider();
        } catch (error) {
            currentState = state;
        }
    }
    const userinfo = currentState && currentState.userinfo;

    if (userinfo && userinfo.isSignedIn === false) {
        latestAuthHeaders = {};
    }

    if (latestAuthHeaders['access-token'] && latestAuthHeaders.client && latestAuthHeaders.uid) {
        return latestAuthHeaders;
    }

    if (userinfo && userinfo.accesstoken && userinfo.client && userinfo.uid) {
        return {
            'access-token': userinfo.accesstoken,
            'client': userinfo.client,
            'uid': userinfo.uid
        };
    }

    return {};
}

function authHeadersFromResponse(response) {
    if (!response.headers ||
        !response.headers['access-token'] ||
        !response.headers.client ||
        !response.headers.uid) {
        return null;
    }
    return {
        'access-token': response.headers['access-token'],
        'client': response.headers.client,
        'uid': response.headers.uid
    };
}
