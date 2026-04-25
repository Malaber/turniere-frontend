import getConfig from 'next/config';
const {publicRuntimeConfig} = getConfig();

const apiUrl = publicRuntimeConfig.api_url;

const axios = require('axios');

export function postRequest(state, url, data) {
    return axios.post(apiUrl + url, data, {
        headers: generateHeaders(state)
    });
}

export function getRequest(state, url) {
    return axios.get(apiUrl + url, {
        headers: generateHeaders(state)
    });
}

export function deleteRequest(state, url) {
    return axios.delete(apiUrl + url, {
        headers: generateHeaders(state)
    });
}

export function patchRequest(state, url, data) {
    return axios.patch(apiUrl + url, data, {
        headers: generateHeaders(state)
    });
}

export function putRequest(state, url, data) {
    return axios.put(apiUrl + url, data, {
        headers: generateHeaders(state)
    });
}

function generateHeaders(state) {
    if (state.userinfo.isSignedIn) {
        return {
            'access-token': state.userinfo.accesstoken,
            'client': state.userinfo.client,
            'uid': state.userinfo.uid
        };
    } else {
        return {};
    }
}
