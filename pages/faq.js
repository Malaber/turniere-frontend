import Head from 'next/head';
import React from 'react';
import {Col, Container, Row} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {BigImage} from '../js/components/BigImage';
import {Footer} from '../js/components/Footer';

function Main() {
    return (<div className="main">
        <Container className="pb-5">
            <GeneralFaq/>
            <hr className="mb-5"/>
            <AccountFaq/>
            <hr className="mb-5"/>
            <TournamentFaq/>
        </Container>
    </div>);
}

function GeneralFaq() {
    return (<div className="running-text">
        <h1>Allgemein</h1>
        <Row>
            <Col sm="4">
                <h4>Was macht turnie.re?</h4>
                <p>
                    turnie.re ist ein Online-Turnier&shy;planer.</p>
                <p>
                    Allein aus den Team-Namen berechnen wir dir einen kompletten Spielplan, den du auch gleich mit allen
                    Leuten teilen kannst, ohne dir Gedanken machen zu müssen, wer gegen wen spielen muss. Du trägst ein,
                    wer gewonnen hat, und turnie.re sagt, wer als nächstes spielt. </p>
            </Col>
            <Col sm="4">
                <h4>Für welche Sportarten ist turnie.re geeignet?</h4>
                <p>
                    turnie.re ist prinzipiell für jede Sportart geeignet. Die einzige Vor&shy;aus&shy;setzung ist,
                    dass in jedem Spiel zwei Mannschaften oder Spieler gegeinander antreten und dass derjenige mit den
                    meisten Punkten gewinnt. </p>
            </Col>
            <Col sm="4">
                <h4>Für welche Anzahl an Teams ist turnie.re geeignet?</h4>
                <p>
                    turnie.re ist unabhängig von der Anzahl der Teams nutzbar. </p>
            </Col>
            <Col sm="4">
                <h4>Fallen für die Nutzung von turnie.re Kosten an?</h4>
                <p>
                    turnie.re ist ein kostenloser Service! Wir erheben keine Kosten und sind nur darauf aus,
                    dein Turnier-Management so einfach wie möglich zu gestalten. </p>
            </Col>
        </Row>
    </div>);
}

function AccountFaq() {
    return (<div className="running-text">
        <h1>Account</h1>
        <Row>
            <Col sm="4">
                <h4>Warum brauche ich einen Account für turnie.re?</h4>
                <p>
                    Wir wollen sicherstellen, dass nur berechtigte Nutzer Turnierdaten ändern können. Damit wir dich als
                    berechtigt verifizieren können, benötigst du einen Acoount, sodass wir dir die entsprechenden
                    Bearbeitungsrechte zuteilen können. </p>
            </Col>
            <Col sm="4">
                <h4>Welche Daten muss ich bei der Accounterstellung angeben?</h4>
                <p>
                    Um einen Account anzulegen musst du einen Nutzernamen, eine gültige E-Mailadresse sowie ein Passwort
                    angeben. </p>
            </Col>
            <Col sm="4">
                <h4>Wie werden meine Daten verarbeitet?</h4>
                <p>
                    Deine Daten werden in unserer Datenbank gespeichert. Eine Weitergabe dieser Daten an Dritte erfolgt
                    nicht!
                </p>
                <p>
                    Zusätlich wird dein Passwort verschlüsselt gespeichert, das bedeutet auch wir kennen dein Passwort
                    nicht und dein Account wird zuverlässig geschützt. </p>
            </Col>
            <Col sm="4">
                <h4>Wie kann ich meinen Nutzernamen ändern?</h4>
                <p>
                    Über deinen Nutzernamen, der in der Kopfzeile angezeigt wird, gelangst du auf deine Profilseite.
                    Hier kannst du deinen Nutzernamen ändern. </p>
            </Col>
            <Col sm="4">
                <h4>Wie kann ich meine E-Mailadresse ändern?</h4>
                <p>
                    Über deinen Nutzernamen, der in der Kopfzeile angezeigt wird, gelangst du auf deine Profilseite.
                    Hier kannst du deine E-Mailadresse ändern ändern. </p>
            </Col>
            <Col sm="4">
                <h4>Wie kann ich mein Passwort ändern?</h4>
                <p>
                    Auf deiner Profilseite findest du einen "Passwort ändern" Button. Auf der sich dann öffnenden Seite
                    kannst du dein Passwort ändern. </p>
            </Col>
        </Row>
    </div>);
}

function TournamentFaq() {
    return (<div className="running-text">
        <h1>Turnier</h1>
        <Row>
            <Col sm="4">
                <h4>Wie erstelle ich ein Turnier?</h4>
                <p>
                    Um ein Turnier zu erstellen musst du dich zuerst anmelden.</p>
                <p>
                    Über "Turnier erstellen" gelangst du auf die "Turnier erstellen" Seite. Auf dieser kannst du deinem
                    Turnier einen Namen geben und eine (optionale) Beschreibung hinzufügen. Dann kannst du dein
                    Turnier <a href="#public-tournament">öffentlich oder privat</a> erstellen, die Teams für die
                    Spielpaarungen <a href="#randomize-teams">mischen</a> lassen und eine <a
                        href="#groupstage">Gruppenphase</a>
                    hinzufügen. Im Feld "Teams" kannst du die teilnehmenden <a href="#add-teams">Teams eintragen</a> und
                    hinzufügen. </p>
                <p>
                    Wenn du die Option Gruppenphase aktiviert hast, kannst du zusätzlich noch die Größe der Gruppen
                    angeben. </p>
            </Col>
            <Col sm="4">
                <h4 id="public-tournament">Was ist der Unterschied zwischen einem öffentlichen und einem privaten
                    Turnier?</h4>
                <p>
                    Standardmäßig ist ein Turnier privat, das bedeutet, dass nur der Turnierersteller und Zuschauer, die
                    den entsprechenden Turniercode erhalten haben, das Turnier, seine teilnehmenden Mannschaften, sowie
                    die Spielpaarungen und die jeweiligen Spielstände sehen können. </p>
                <p>
                    Wenn du dich entscheidest dein Turnier öffentlich zu erstellen, wird der Turniercode nicht mehr
                    benötigt, um das Turnier und all seine Informationen einzusehen. Das Turnier wird dann in der Liste
                    der öffentlichen Turniere angezeigt und kann auch über seinen Namen von jedem gefunden werden. </p>
                <p>
                    Trotzdem bleibt der Turnierersteller der Einzige, der die Turnierinformationen bearbeiten und
                    Spielstände eintragen kann. </p>
            </Col>
            <Col sm="4">
                <h4 id="randomize-teams">Was bedeutet "Teams mischen"?</h4>
                <p>
                    Die Spielpaarungen werden anhand der Eingabereihenfolge der Teams erstellt. So spielt z.B. das
                    zuerst eingegebene Team gegen das als zweites eingegebene Team, das als drittes eingegebene gegen
                    das als viertes eingegebene, und so weiter. </p>
                <p>
                    Wenn du das nicht möchtest kannst du die Option "Teams mischen" aktivieren und die Spielpaarungen
                    werden in einer zufälligen Reihenfolge erstellt. </p>
            </Col>
            <Col sm="4">
                <h4 id="groupstage">Was passiert wenn ich die Gruppenphase aktiviere?</h4>
                <p>
                    Grundsätzlich erstellt turnie.re dir einen Spielplan für ein Turnier <strong>ohne</strong>
                    Gruppenphase und <strong>nur</strong> einer K.O.-Phase. Wenn du eine Gruppenphase spielen lassen
                    willst, kannst du das aber auch tun. Wenn die Gruppenphase aktiviert ist, werden deine eingegeben
                    Teams automatisch in Gruppen eingeteilt und auch die Spielpläne für die einzelnen Gruppen berechnet.
                </p>
                <p>
                    Bitte beachte, dass die Anzahl der Teams durch die Gruppengröße teilbar sein muss. </p>
            </Col>
            <Col sm="4">
                <h4 id="add-teams">Wie kann ich Teams hinzufügen?</h4>
                <p>
                    Auf der "Turnier erstellen" Seite kannst du im Feld "Teams" deine Teams eintragen. </p>
                <p>
                    Du kannst die Teamnamen einzeln eingeben und dann über drücken der Entertaste oder über den Button
                    "Team hinzufügen" das Team deinem Turnier hinzufügen. Du kannst aber auch deine Teams als eine mit
                    Kommas getrennte Liste eingeben und dann hinzufügen. </p>
            </Col>
            <Col sm="4">
                <h4>Wie starte ich ein Spiel?</h4>
                <p>
                    Auf der Turnierübersicht Seite gibt es für jede Partie einen "Spiel starten" Button. Über diesen
                    kannst du einfach das jeweilige Spiel starten. </p>
            </Col>
            <Col sm="4">
                <h4>Wie trage ich einen Spielstand für eine Partie ein?</h4>
                <p>
                    Auf der Turnierübersicht Seite gibt es für jede Partie einen "Spielstand ändern" Button. Über diesen
                    kannst du einfach den Spielstand eintragen. In dem Popup, das sich öffnet kannst du den aktuellen
                    Spielstand eintragen und angeben, ob das Spiel noch läuft oder schon beendet ist. </p>
                <h4>Gibt es in der Gruppenphase eine Blitztabelle?</h4>
                <p>
                    Ja, die in der Gruppenphase dargestellte Tabelle stellt eine Blitztabelle dar. </p>
            </Col>
        </Row>
    </div>);
}

export default class FaqPage extends React.Component {
    render() {
        return (<div>
            <Head>
                <title>FAQ: turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <BigImage text="FAQ"/>
            <Main/>
            <Footer/>
        </div>);
    }
}
