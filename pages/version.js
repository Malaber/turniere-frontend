import Head from 'next/head';
import React, {useEffect, useState} from 'react';
import {Alert, Container, Table} from 'reactstrap';

import {requestBackendVersion} from '../js/api';
import {TurniereNavigation} from '../js/components/Navigation';
import {BigImage} from '../js/components/BigImage';
import {Footer} from '../js/components/Footer';

const frontendVersion = process.env.NEXT_PUBLIC_TURNIERE_FRONTEND_VERSION || 'development';

function Version() {
    const [backendVersion, setBackendVersion] = useState(null);
    const [backendError, setBackendError] = useState(false);

    useEffect(() => {
        requestBackendVersion(
            versionInfo => {
                setBackendVersion(versionInfo);
                setBackendError(false);
            },
            () => {
                setBackendVersion(null);
                setBackendError(true);
            }
        );
    }, []);

    return (
        <div>
            <Head>
                <title>Version - turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <BigImage text="Version"/>
            <main className="main running-text">
                <Container>
                    <h2>Version</h2>
                    <Table bordered responsive>
                        <tbody>
                            <tr>
                                <th scope="row">Frontend</th>
                                <td data-testid="frontend-version">{frontendVersion}</td>
                            </tr>
                            <tr>
                                <th scope="row">Backend</th>
                                <td data-testid="backend-version">
                                    {backendError ? 'nicht verfügbar' : formatBackendVersion(backendVersion)}
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                    {backendError && (
                        <Alert color="warning">
                            Backend-Version konnte nicht geladen werden.
                        </Alert>
                    )}
                </Container>
            </main>
            <Footer/>
        </div>
    );
}

function formatBackendVersion(versionInfo) {
    if (!versionInfo) {
        return 'lädt...';
    }

    if (typeof versionInfo === 'string') {
        return versionInfo;
    }

    if (versionInfo.version) {
        return versionInfo.version;
    }

    return JSON.stringify(versionInfo);
}

export default Version;
