import Head from 'next/head';
import React from 'react';
import {Container} from 'reactstrap';

import {TurniereNavigation} from './Navigation';
import {Footer} from './Footer';

import 'bootstrap/dist/css/bootstrap.min.css';

export class ErrorPageComponent extends React.Component {
    static getInitialProps({statusCode}) {
        return {statusCode};
    }

    render() {
        return (
            <div>
                <Head>
                    <title>{`turnie.re - Error ${this.props.statusCode}`}</title>
                </Head>
                <TurniereNavigation/>
                <ErrorPage statusCode={this.props.statusCode}/>
                <Footer/>
            </div>
        );
    }
}

export function ErrorPage(props) {
    return (
        <Container className="mb-5">
            <div className="row mb-5">
                <div className="col-lg text-center">
                    <img src="/static/images/logo-questionmark.png" className="w-75 img-fluid"/>
                </div>
                <div className="col-lg error-code-box">
                    <h1 className="custom-font py-5">{props.statusCode}</h1>
                </div>
            </div>
            <ErrorMessage code={props.statusCode}/>
        </Container>
    );
}

function ErrorMessage(props) {
    const errors = {};
    errors[400] = {title: 'Deine Anfrage ist fehlerhaft.', message: '', showTryStartpage: true};
    errors[403] = {
        title: 'Du bist nicht autorisiert, diese Seite aufzurufen.',
        message: 'Bitte stelle sicher, dass Du angemeldet bist und auf dieses Turnier oder dieses Match zugreifen' +
            ' darfst.',
        showTryStartpage: true
    };
    errors[404] = {
        title: 'Die aufgerufene Seite wurde leider nicht gefunden.',
        message: 'Entweder hast Du dich vertippt, oder die gesuchte Seite gibt es nicht.',
        showTryStartpage: true
    };
    errors[500] = {
        title: 'Diese Seite funktioniert nicht.',
        message: 'turnie.re kann Deine Anfrage im Moment nicht verarbeiten. Bitte versuche es später erneut.',
        showTryStartpage: false
    };
    errors['unknown'] = {title: 'Ein unbekannter Fehler ist aufgetreten.', message: '', showTryStartpage: true};
    const error = errors[props.code] === undefined ? errors['unknown'] : errors[props.code];

    return <ErrorText title={error.title} message={error.message} showTryStartpage={error.showTryStartpage}/>;
}

function ErrorText(props) {
    return (<div className='running-text'>
        {props.title && <h2>{props.title}</h2>}
        {props.message && <p>{props.message}</p>}
        {props.showTryStartpage && <p>
            Wir empfehlen, die eingegebene Seite über die <a href="/">Startseite</a> zu suchen.
        </p>}
    </div>);
}
