import Head from 'next/head';
import React from 'react';

import {TurniereNavigation} from '../js/components/Navigation';
import {Footer} from '../js/components/Footer';
import {Login} from '../js/components/Login';

export default class LoginPage extends React.Component {
    render() {
        return (<div className="main generic-fullpage-bg">
            <Head>
                <title>Login: turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <div>
                <Login/>
            </div>
            <Footer/>
        </div>);
    }
}
