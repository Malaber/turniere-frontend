import React from 'react';
import {Card, CardBody, Col} from 'reactstrap';
import {BPWSTR_QR_CODE_IMAGE_KEY, beamerMediaImageForKey} from '../../utils/beamerMedia';


const qrCardStyle = {
    minHeight: '100%'
};

const qrCardBodyStyle = {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '22rem',
    padding: '1.5rem'
};

const qrImageStyle = {
    display: 'block',
    height: 'auto',
    maxWidth: '100%',
    width: '300px'
};


export function GroupQrCode() {
    const qrImage = beamerMediaImageForKey(BPWSTR_QR_CODE_IMAGE_KEY);

    return (
        <Col className="minw-25 py-2" data-testid="fullscreen-group-qr-column">
            <Card className="h-100" style={qrCardStyle} data-testid="fullscreen-group-qr-card">
                <CardBody style={qrCardBodyStyle}>
                    <img
                        src={qrImage.src}
                        alt={qrImage.label}
                        style={qrImageStyle}
                        data-testid="fullscreen-group-qr-code"
                    />
                </CardBody>
            </Card>
        </Col>
    );
}
