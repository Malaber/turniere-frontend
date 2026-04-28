export function Footer() {
    return (
        <footer className="footer mt-5 bg-dark text-light text-center">
            <div className="turniere-footer__content">
                <Copyright/>
                <span className="turniere-footer__separator" aria-hidden="true">&middot;</span>
                <nav className="turniere-footer__links" aria-label="Footer">
                    <Version/>
                    <span className="turniere-footer__separator" aria-hidden="true">&middot;</span>
                    <Privacy/>
                    <span className="turniere-footer__separator" aria-hidden="true">&middot;</span>
                    <Imprint/>
                </nav>
            </div>
        </footer>
    );
}

function Copyright() {
    const currentYear = new Date().getFullYear();
    return <span className="turniere-footer__copyright" data-testid="footer-copyright">
        &copy; {currentYear} turnie.re
    </span>;
}

function Privacy() {
    return <a className="text-white" href="/privacy">Datenschutz</a>;
}

function Version() {
    return <a className="text-white" href="/version">Version</a>;
}

function Imprint() {
    return <a className="text-white" href="/imprint">Impressum</a>;
}
