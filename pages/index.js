import Head from 'next/head';
import React from 'react';
import {connect} from 'react-redux';
import {
    Alert, Button, Card, CardBody
} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {BigImage} from '../js/components/BigImage';
import {Footer} from '../js/components/Footer';

function Main() {
    return (<div className="main">
        <Marketing/>
        <MainPromotedLinks/>
        <MainBottomSummary/>
    </div>);
}

function Marketing() {
    return (<div className="container marketing my-5">
        <div className="row">
            <div className="col-lg-4">
                <h2>Für jede Sportart</h2>
                <p>
                    Egal, um welche Sportart es geht: Solange du mit mehreren Mannschaften ein Turnier veranstalten
                    willst, kann turnie.re dir ein Turnier berechnen!
                </p>
            </div>
            <div className="col-lg-4">
                <h2>Beliebige Anzahl Teams</h2>
                <p>
                    Egal, wie viele Teams du gerne in deinem Turnier hast, wir regeln das. Füge einfach deine Teams
                    hinzu und schon sagen wir dir, wer gegen wen spielt. </p>
            </div>
            <div className="col-lg-4">
                <h2>Kostenlos</h2>
                <p>
                    turnie.re ist ein kostenloser Service! Wir erheben keine Kosten und sind nur darauf aus, dein
                    Turnier-Management so einfach wie möglich zu gestalten. </p>
            </div>

        </div>
        <Betawarning/>
    </div>);
}

function Betawarning() {
    return (<Alert color="danger" className="shadow-sm mt-4" fade={false}>
        <h4 className="alert-heading custom-font">Public Beta</h4>
        <p>
            Diese Website ist noch in der Entwicklung.<br/>
            Bei Problemen fülle bitte <a href="#" id="bugLink" className="alert-link">dieses </a>
            und für Feedback <a href="#" id="feedbackLink" className="alert-link">dieses</a> Formular aus. </p>
    </Alert>);
}

function MainBottomSummary() {
    return (<div className="container marketing my-5">
        <div className="row">

            <div className="col-lg-6">
                <h2>Was macht turnie.re?</h2>
                <p>
                    turnie.re berechnet dir ein Turnier. Allein aus den Team-Namen berechnen wir dir einen kompletten
                    Spielplan,
                    den du auch gleich mit allen Leuten teilen kannst, ohne dir Gedanken machen zu müssen, wer gegen wen
                    spielen muss.<br/>
                    Du trägst ein, wer gewonnen hat, und turnie.re sagt, wer als nächstes spielt. </p>
            </div>
            <div className="col-lg-6">
                <h2>Ich habe einen Turniercode bekommen. Was nun?</h2>
                <p>
                    Der Turniercode führt dich direkt zu einem Turnier. Gebe dafür den Code <a className="text-success"
                        href="#turniercode-form">oben</a> ein,
                    dann wirst du sofort weitergeleitet. </p>
            </div>
        </div>
        <div className="my-5 text-center">
            <p>
                Noch fragen? Schau doch mal im <a className="text-success" href="/faq">FAQ</a> vorbei!
            </p>
        </div>
    </div>);
}

function MainPromotedLinks() {
    return (<div className="index-cards py-5">
        <PromotedLinkTournamentCode/>
        <PromotedLinkListTournaments/>
        <PromotedLinkCreateTournament/>
    </div>);
}

function PromotedLinkTournamentCode() {
    return (<Card className="container shadow-lg mt-3">
        <CardBody className="row">
            <form id="turniercode-form" className="col-lg-4" action="/t" method="get">
                <input className="form-control" type="search" name="code" placeholder="Turnier-Code"/>
                <Button outline color="success" className="w-100 my-2" type="submit">Turnier-Code öffnen</Button>
            </form>
            <div className="col-lg-8">
                <p>Gib hier einen Turnier Code ein, um direkt zum entsprechenden Turnier zu gelangen.</p>
            </div>
        </CardBody>
    </Card>);
}

function PromotedLinkListTournaments() {
    return (<Card className="container shadow-lg my-4">
        <CardBody className="row">
            <div className="col-lg-4 pb-3">
                <Button outline color="success" className="w-100" href="/list">Alle Turniere anzeigen</Button>
            </div>
            <div className="col-lg-8">
                <p>
                    Hier findest du alle öffentlichen Turniere. Wenn du ein Turnier suchst, den Turniercode aber nicht
                    hast, wirst du wahrscheinlich hier fündig. </p>
                <p>
                    Wenn du eingeloggt bist, findest du hier auch deine eigenen Turniere. </p>
            </div>
        </CardBody>
    </Card>);
}

function PromotedLinkCreateTournament() {
    return (<Card className="container shadow-lg mb-3">
        <CardBody className="row">
            <div className="col-lg-8">
                <p>
                    <strong>Einfach ausprobieren:</strong> Einen Turnier-Namen, ein paar Team-Namen, und schon kriegst
                    du ein komplettes Turnier!
                </p>
            </div>
            <div className="col-lg-4">
                <Button color="success" size="lg" className="w-100" href="/create">Turnier erstellen</Button>
            </div>
        </CardBody>
    </Card>);
}


class Index extends React.Component {
    render() {
        return (<div>
            <Head>
                <title>turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <BigImage text="Einfach Turniere organisieren"/>
            <Main/>
            <Footer/>
        </div>);
    }
}

export default connect()(Index);
