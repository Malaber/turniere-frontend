import App, {Container} from 'next/app';
import React from 'react';
import {Provider} from 'react-redux';
import Notifications from 'react-notify-toast';
import Favicon from 'react-favicon';

import withReduxStore from '../js/redux/reduxStoreBinder';
import {verifyCredentials} from '../js/api.js';

import '../public/static/css/errormessages.css';
import '../public/static/css/editablestringlist.css';
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
        return (<Container>
            <Notifications />
            <Favicon url="/static/icons/favicon.ico"/>
            <Provider store={reduxStore}>
                <Component {...pageProps} />
            </Provider>
        </Container>);
    }
}

export default withReduxStore(TurniereApp);
