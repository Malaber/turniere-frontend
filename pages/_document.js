import Document, {Head, Html, Main, NextScript} from 'next/document';
import React from 'react';

class TurniereDocument extends Document {
    render() {
        return (
            <Html>
                <Head />
                <body>
                    <Main />
                    <script src="/turniere-runtime-config.js" />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default TurniereDocument;
