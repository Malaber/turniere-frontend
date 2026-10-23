import {AppPage} from '../js/components/AppPage';

export default function Support() {
    return <AppPage title="Hilfe zur App" description="Hilfe zu Turniercodes, Lieblingsteams, Ergebnissen und Offline-Nutzung der turnie.re App.">
        <h2>Ein Turnier öffnen</h2>
        <p>Wähle ein öffentliches Turnier auf der Startseite oder füge den Link beziehungsweise
            Turniercode des Veranstalters ein. Wird ein Code nicht gefunden, frage den Veranstalter
            nach dem direkten Link mit der numerischen Turnier-ID.</p>
        <h2>Mein Lieblingsteam</h2>
        <p>Öffne ein Turnier und wähle dein Team. Die App merkt sich ein Lieblingsteam je Turnier auf
            diesem Gerät. Du kannst deine Auswahl später ändern. Zum Entfernen eines gespeicherten
            Turniers wische dessen Eintrag auf der Startseite nach links und wähle „Entfernen“.</p>
        <h2>Ergebnisse und Verbindung</h2>
        <p>Während die App aktiv ist, werden Ergebnisse regelmäßig abgerufen. Ziehe die Ansicht nach
            unten, um sie manuell zu aktualisieren. Ohne Verbindung zeigt die App den zuletzt
            gespeicherten Stand und einen Offline-Hinweis. Dieser Stand kann veraltet sein.</p>
        <p>Bei falschen oder fehlenden Ergebnissen wende dich an den Veranstalter. In der App können
            keine Ergebnisse eingetragen oder geändert werden.</p>
        <h2>Kontakt</h2>
        <p>Bei technischen Problemen schreibe an <a href="mailto:turniere@schaedler.rocks">turniere@schaedler.rocks</a>.
            Nenne bitte App-Version, iOS-Version, Gerät, Turnierlink und die Schritte zum Problem.
            Sende keine Passwörter oder unnötigen personenbezogenen Daten.</p>
        <p><a href="/app-privacy">Datenschutz der App</a> · <a href="/privacy">Datenschutz der Website</a> · <a href="/imprint">Impressum</a></p>
    </AppPage>;
}
