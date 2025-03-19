export function Footer() {
    return (
        <footer className="footer mt-5 p-3 bg-dark text-light text-center">
            <Copyright/> &middot; <Privacy/> &middot; <Imprint/>
        </footer>
    );
}

function Copyright() {
    return <span>&copy; 2025 turnie.re</span>;
}

function Privacy() {
    return <a className="text-white" href="/privacy">Datenschutzerklärung</a>;
}

function Imprint() {
    return <a className="text-white" href="/imprint">Impressum</a>;
}
