import Document, {Head, Html, Main, NextScript} from 'next/document';
import React from 'react';

class TurniereDocument extends Document {
    render() {
        return (
            <Html>
                <Head />
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default TurniereDocument;
