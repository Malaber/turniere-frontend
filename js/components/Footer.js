export function Footer() {
    return (
        <footer className="footer mt-5 bg-dark text-light">
            <div className="container py-3">
                <div className="row">
                    <div className="col-md-6 text-center">
                        <Copyright/> &middot; <Privacy/> &middot; <Imprint/>
                    </div>
                    <div className="col-md-6 text-center"><MoveToTop/></div>
                </div>
            </div>
        </footer>
    );
}

function Copyright() {
    return <span>&copy; 2024 turnie.re</span>;
}

function Privacy() {
    return <a className="text-white" href="/privacy">Datenschutzerklärung</a>;
}

function Imprint() {
    return <a className="text-white" href="/imprint">Impressum</a>;
}

function MoveToTop() {
    return <a href="#" className="text-white">zurück nach oben</a>;
}
