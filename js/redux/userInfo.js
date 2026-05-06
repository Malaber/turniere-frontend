export const actionTypesUserinfo = {
    'REGISTER': 'REGISTER',
    'REGISTER_RESULT_SUCCESS': 'REGISTER_RESULT_SUCCESS',
    'REGISTER_RESULT_ERROR': 'REGISTER_RESULT_ERROR',

    'LOGIN': 'LOGIN',
    'LOGIN_RESULT_SUCCESS': 'LOGIN_RESULT_SUCCESS',
    'LOGIN_RESULT_ERROR': 'LOGIN_RESULT_ERROR',

    'LOGOUT': 'LOGOUT',

    'VERIFY_CREDENTIALS': 'VERIFY_CREDENTIALS',
    'VERIFY_CREDENTIALS_SUCCESS': 'VERIFY_CREDENTIALS_SUCCESS',
    'VERIFY_CREDENTIALS_ERROR': 'VERIFY_CREDENTIALS_ERROR',

    'CHANGE_MAIL': 'CHANGE_MAIL',

    'STORE_AUTH_HEADERS': 'STORE_AUTH_HEADERS',

    'REHYDRATE': 'USERINFO_REHYDRATE',
    'CLEAR': 'USERINFO_CLEAR'
};

export const defaultStateUserinfo = {
    isSignedIn: false,
    username: null,
    accountId: null,
    error: false,
    errorMessages: [],

    accesstoken: null,
    client: null,
    expiry: null,
    uid: null
};
