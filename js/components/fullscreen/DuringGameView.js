import React from 'react';
import {Col, Container, Navbar, NavbarBrand, Row, Spinner} from 'reactstrap';
import {Match} from '../Match';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {Timer} from '../Timer';


const MATCHES_PER_CHUNK = 6;
const CHUNK_CYCLE_INTERVAL = 10000;


export class DuringGameView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            chunkIndex: 0
        };
        this.cycleChunk = this.cycleChunk.bind(this);
    }

    componentDidMount() {
        this.intervalId = setInterval(this.cycleChunk, CHUNK_CYCLE_INTERVAL);
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    cycleChunk() {
        const {matches} = this.props;
        if (!matches || matches.length === 0) return;

        const totalChunks = Math.ceil(matches.length / MATCHES_PER_CHUNK);
        this.setState(prev => ({
            chunkIndex: (prev.chunkIndex + 1) % totalChunks
        }));
    }

    render() {
        const {tournamentMeta, matches, timerEnd} = this.props;
        const {chunkIndex} = this.state;

        const sortedMatches = matches ? [...matches].sort(sortMatchesByPositionAscending()) : [];
        const start = chunkIndex * MATCHES_PER_CHUNK;
        const chunk = sortedMatches.slice(start, start + MATCHES_PER_CHUNK);

        return (<div>
            <Container fluid className="text-center"
                style={{minHeight: '40vh', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'}}>
                {timerEnd ? (
                    <div style={{fontSize: '8rem', fontWeight: 'bold', fontFamily: 'monospace'}}>
                        <Timer timerEnd={timerEnd}/>
                    </div>
                ) : (
                    <div className="text-secondary" style={{fontSize: '3rem'}}>
                        Kein Timer gesetzt
                    </div>
                )}
            </Container>

            <div className="mx-4 h5 disable-hover">
                {matches == null ? (
                    <div className="text-center text-secondary">
                        <Spinner animation="border" role="status" size="sm"/>
                        <span className="ml-3">lade Matches</span>
                    </div>
                ) : chunk.length === 0 ? (
                    <div className="text-center text-secondary font-italic">keine laufenden Matches</div>
                ) : (
                    <Row>
                        {chunk.map(match =>
                            <Col md="auto" key={match.id}><Match match={match}/></Col>
                        )}
                    </Row>
                )}
            </div>

            <Navbar color="light" className="mt-4 border-bottom fixed-bottom py-0">
                <div className="ml-auto dropdown-container">
                    <i>Während dem Spiel</i>
                </div>
                <NavbarBrand>{tournamentMeta ? tournamentMeta.name : ''}</NavbarBrand>
                {timerEnd &&
                    <div className="ml-auto timer-container">
                        Spielzeit: <NavbarBrand><Timer timerEnd={timerEnd}/></NavbarBrand>
                    </div>
                }
            </Navbar>
        </div>);
    }
}
