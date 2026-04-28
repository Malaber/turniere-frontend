import App from 'next/app';
import React from 'react';
import {Provider} from 'react-redux';
import Head from 'next/head';

import Notifications from '../js/components/Notifications';
import withReduxStore from '../js/redux/reduxStoreBinder';
import {verifyCredentials} from '../js/api.js';

import 'bootstrap/dist/css/bootstrap.min.css';

import '../public/static/css/errormessages.css';
import '../public/static/css/everypage.css';
import '../public/static/css/error.css';
import '../public/static/css/numericinput.css';
import '../public/static/css/index.css';
import '../public/static/css/profile.css';
import '../public/static/css/tournament.css';

class TurniereApp extends App {
    componentDidMount() {
        verifyCredentials();
    }

    render() {
        const {Component, pageProps, reduxStore} = this.props;
        return (
            <>
                <Head>
                    <link rel="shortcut icon" href="/static/icons/favicon.ico" />
                </Head>
                <Notifications />
                <Provider store={reduxStore}>
                    <Component {...pageProps} />
                </Provider>
            </>
        );
    }
}

export default withReduxStore(TurniereApp);
