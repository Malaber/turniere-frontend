import {AppPage} from '../js/components/AppPage';

export default function AppPrivacy() {
    return <AppPage title="Datenschutz der App" description="Informationen zur lokalen Speicherung, API-Verbindung und deinen Datenschutzrechten in der turnie.re App.">
        <p>Stand: 24. Oktober 2026. Diese Informationen gelten für die turnie.re App für iPhone
            und iPad, ab Version 0.2. Für die Website gilt die <a href="/privacy">Datenschutzerklärung der Website</a>.</p>
        <h2>Verantwortlicher und Kontakt</h2>
        <p>Die App wird von Daniel Schaedler betrieben. Bei Fragen oder Datenschutzanfragen schreibe
            an <a href="mailto:turniere@schaedler.rocks">turniere@schaedler.rocks</a>.</p>
        <h2>Was auf deinem Gerät bleibt</h2>
        <p>Die App speichert deine ausgewählten Turniere, dein Lieblingsteam pro Turnier,
            zuletzt geladene Turnierdaten und die gewählte Darstellung lokal auf deinem Gerät.
            Die Favoritenauswahl wird nicht an den Turnierserver übertragen. Sie wird benötigt,
            um deine Auswahl beim nächsten Öffnen wieder anzuzeigen und geladene Daten offline bereitzuhalten.</p>
        <p>Du kannst gespeicherte Turniere auf der Startseite durch Wischen nach links entfernen.
            Durch Löschen der App werden ihre lokal gespeicherten Turnierdaten entfernt. Gerätesicherungen können
            App-Daten entsprechend deinen Apple- und Geräteeinstellungen enthalten.</p>
        <h2>Verbindung zum Turnierserver</h2>
        <p>Zum Laden und Aktualisieren von Turnieren verbindet sich die App verschlüsselt mit
            api.turnie.re oder, wenn du den Beta-Server auswählst, beta.api.turnie.re. Dabei werden technisch die IP-Adresse sowie die angefragte Adresse
            mit Turniercode oder Turnier-ID und weitere HTTP-Verbindungsdaten übertragen.
            Wenn du einen Spielstand vorschlägst, werden die Punkte, Spiel- und Team-ID sowie deine Sitzung zur Zuordnung und Berechtigungsprüfung übertragen.</p>
        <p>Der Server und die Hosting-Infrastruktur verarbeiten diese technischen Verbindungsdaten
            zur Bereitstellung und Absicherung des Dienstes. Technische Protokolle können zur
            Untersuchung von Störungen und Sicherheitsvorfällen verarbeitet werden.
            Die Verbindung dient der Bereitstellung der angeforderten Turnierdaten und dem sicheren Betrieb
            des Dienstes. Die lokale Auswahl wird gespeichert, bis du sie entfernst oder die App löschst.</p>
        <h2>Optionale Anmeldung und Spielstandvorschläge</h2>
        <p>Turniere ansehen und Favoriten auswählen ist ohne Anmeldung möglich. Für Spielstandvorschläge
            meldest du dich mit einem bestehenden, bestätigten Konto an. Die App überträgt E-Mail-Adresse
            und Passwort verschlüsselt an den ausgewählten Server. Das Passwort wird nicht dauerhaft
            in der App gespeichert. Sitzungstoken und die E-Mail-Kennung der Sitzung werden im
            gerätegebundenen Schlüsselbund gespeichert, getrennt für Produktiv- und Beta-Server.
            Über „Abmelden“ entfernst du die Sitzung auf diesem Gerät; soweit der Server erreichbar
            ist, wird sie auch dort widerrufen. Schlüsselbunddaten können eine Neuinstallation überdauern.</p>
        <p>Der Server verarbeitet Konto- und Teamzuordnung sowie eingereichte Spielstände für diese
            Funktion. Vorschläge und bestätigte Einigungen werden zur Verarbeitung und Nachvollziehbarkeit
            gespeichert; offizielle Spielstände werden über die Turnieransicht veröffentlicht.
            Die Auswahl eines Lieblingsteams erteilt keine Berechtigung zur Ergebniseingabe.</p>
        <h2>Keine Werbung oder Tracking-SDKs</h2>
        <p> Sie enthält keine Werbe- oder Analyse-SDKs und verwendet
            keine Tracking-Kennungen. Sie greift nicht auf Standort, Kontakte, Kamera oder Mikrofon zu.</p>
        <h2>Support und externe Links</h2>
        <p>Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine Nachricht und die von dir
            angegebenen Kontaktdaten zur Bearbeitung deiner Anfrage. Bei Links, die du im Browser
            öffnest, gelten zusätzlich die Datenschutzinformationen der jeweiligen Website.</p>
        <h2>Deine Rechte</h2>
        <p>Im Rahmen der gesetzlichen Voraussetzungen hast du Rechte auf Auskunft, Berichtigung,
            Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie
            ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde. Die
            Kontaktadresse findest du oben auf dieser Seite. Wende dich für Auskunft, Berichtigung
            oder Löschungsanfragen direkt an uns.</p>
        <p><a href="/support">Hilfe und Kontakt</a> · <a href="/app">Über die App</a></p>
    </AppPage>;
}
