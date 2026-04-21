import {Col, Container, Row} from 'reactstrap';
import {Match} from './Match';
import React from 'react';

export function Stage(props) {
    const {isSignedIn, isOwner, readOnlyMode, updateNextStage, stageLevel} = props;

    return (<div>
        <Container className='py-5'>
            <h1 className='custom-font'>{props.level}</h1>
            <Row>
                {props.matches.map((match => (
                    <Col className='minw-25' key={match.id}>
                        <Match
                            match={match}
                            isSignedIn={isSignedIn}
                            isOwner={isOwner}
                            readOnlyMode={readOnlyMode}
                            onFinish={updateNextStage}
                            stageLevel={stageLevel}
                        />
                    </Col>)))}
            </Row>
        </Container>
    </div>);
}
