import React from 'react';
import {Col, Navbar, NavbarBrand, Row, Spinner} from 'reactstrap';
import {Match} from '../Match';
import {sortMatchesByPositionAscending} from '../../utils/sorting';
import {Timer} from '../Timer';


function Matches(props) {
    let matches;
    if (props.matches == null) {
        matches = (<div className="text-center text-secondary">
            <Spinner animation="border" role="status" size="sm"/>
            <span className="ml-3">lade Matches</span>
        </div>);
    } else if (props.matches.length === 0) {
        matches = (<div className="text-center text-secondary font-italic">keine Matches</div>);
    } else {
        matches = (<Row>
            {props.matches.sort(sortMatchesByPositionAscending()).map(
                match => <Col md="auto" key={match.id}><Match match={match}/></Col>
            )}
        </Row>);
    }
    return (<div className="mx-4 h5 disable-hover">
        {matches}
    </div>);
}


function MatchesViewHeader(props) {
    return (
        <Navbar color="light" className="mt-4 border-bottom fixed-bottom py-0 show-cursor">
            <div className="ml-auto dropdown-container">
                {props.filterLabel && <i>Anzeige: {props.filterLabel}</i>}
            </div>
            <NavbarBrand>{props.title}</NavbarBrand>
            {props.timerState && props.timerState.mode &&
                <div className="ml-auto timer-container">
                    Spielzeit: <NavbarBrand><Timer timerState={props.timerState}/></NavbarBrand>
                </div>
            }
        </Navbar>
    );
}


export function MatchesView(props) {
    return (<div>
        <MatchesViewHeader
            title={props.tournamentMeta ? props.tournamentMeta.name : ''}
            timerState={props.timerState}
            filterLabel={props.filterLabel}
        />
        <Matches matches={props.matches}/>
    </div>);
}
