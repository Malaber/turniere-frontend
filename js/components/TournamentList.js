import React from 'react';
import {requestTournamentList} from '../api';
import {Spinner} from 'reactstrap';

export default class TournamentList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            tournaments: [],
            loaded: false
        };
    }

    componentDidMount() {
        requestTournamentList(this.props.type, tournaments => {
            this.setState({
                tournaments: tournaments,
                loaded: true
            });
        }, () => {
            this.setState({loaded: true});
        });
    }

    render() {
        if (!this.state.loaded) {
            return (<EmptyList>
                <Spinner size='sm'/>
                <span className='ml-3'>lade Turnier-Liste</span>
            </EmptyList>);
        }

        if (this.state.tournaments.length === 0) {
            return <EmptyList>keine Turniere vorhanden</EmptyList>;
        }
        return this.state.tournaments.map(item => (
            // The code should be item.code but the api just supports it this way by now
            <TournamentListEntry name={item.name} code={item.id} key={item.id}/>
        ));
    }
}

function EmptyList(props) {
    return (<p className="text-center border-light font-italic text-secondary border-top border-bottom p-1">
        {props.children}
    </p>);
}

function TournamentListEntry(props) {
    return (
        <a className="w-100 d-inline-block mt-2 text-left btn btn-outline-primary" href={'/t/' + props.code}>
            {props.name}
        </a>
    );
}
