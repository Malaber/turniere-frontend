import React from 'react';
import {Card, CardBody, Col} from 'reactstrap';
import {
    BPWSTR_LOGO_IMAGE_KEY,
    BPWSTR_QR_CODE_IMAGE_KEY,
    beamerMediaImageForKey
} from '../../utils/beamerMedia';


const mediaCardStyle = {
    minHeight: '100%'
};

const mediaCardBodyStyle = {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '22rem',
    padding: '1.5rem'
};

const mediaImageStyle = {
    display: 'block',
    height: 'auto',
    maxWidth: '100%',
    width: '300px'
};


export function GroupMediaCard(props) {
    const image = beamerMediaImageForKey(props.imageKey);

    return (
        <Col className="minw-25 py-2" data-testid={props.columnTestId}>
            <Card className="h-100" style={mediaCardStyle} data-testid={props.cardTestId}>
                <CardBody style={mediaCardBodyStyle}>
                    <img
                        src={image.src}
                        alt={image.label}
                        style={mediaImageStyle}
                        data-testid={props.imageTestId}
                    />
                </CardBody>
            </Card>
        </Col>
    );
}

export function GroupQrCode() {
    return (
        <GroupMediaCard
            imageKey={BPWSTR_QR_CODE_IMAGE_KEY}
            columnTestId="fullscreen-group-qr-column"
            cardTestId="fullscreen-group-qr-card"
            imageTestId="fullscreen-group-qr-code"
        />
    );
}

export function GroupLogo() {
    return (
        <GroupMediaCard
            imageKey={BPWSTR_LOGO_IMAGE_KEY}
            columnTestId="fullscreen-group-logo-column"
            cardTestId="fullscreen-group-logo-card"
            imageTestId="fullscreen-group-logo"
        />
    );
}
