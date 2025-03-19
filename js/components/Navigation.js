import {
    Button, ButtonGroup, Collapse, Nav, Navbar, NavbarBrand, NavbarText, NavbarToggler, NavItem, NavLink
} from 'reactstrap';
import {connect} from 'react-redux';
import React from 'react';

import {logout} from '../api';
import {notify} from 'react-notify-toast';
import {Timer} from './Timer';

const NavbarTimer = ({timerEnd, className}) => (
    <NavbarText className={className}>
        <span className={'hide-below-400-w'}>Spielzeit: </span><Timer timerEnd={timerEnd}/>
    </NavbarText>
);

export class TurniereNavigation extends React.Component {
    constructor(props) {
        super(props);
        this.toggle = this.toggle.bind(this);
        this.state = {collapsed: true};
    }

    toggle() {
        this.setState({collapsed: !this.state.collapsed});
    }

    render() {
        const {tournament} = this.props;

        return (
            <Navbar color="light" light expand="lg" sticky="top">
                <NavbarBrand className={'hide-below-320-w'} href="/">turnie.re</NavbarBrand>
                {tournament && tournament.timerEnd &&
                    <NavbarTimer timerEnd={tournament.timerEnd} className="m-auto hide-above-992-w"/>
                }
                <NavbarToggler onClick={this.toggle}/>
                <Collapse isOpen={!this.state.collapsed} navbar>
                    <NavLinks/>
                    {tournament && tournament.timerEnd &&
                        <NavbarTimer timerEnd={tournament.timerEnd} className="m-auto hide-below-992-w"/>
                    }
                    <div className="ms-auto">
                        <LoginLogoutButtons/>
                    </div>
                </Collapse>
            </Navbar>
        );
    }
}

function Navlink(props) {
    return (<NavItem active={true}>
        <NavLink href={props.target}>{props.text}</NavLink>
    </NavItem>);
}

class SmartNavLinks extends React.Component {
    render() {
        return (<Nav navbar className="mr-auto">
            <Navlink target="/create" text="Turnier erstellen"/>
            <Navlink target="/list" text="Öffentliche Turniere"/>
            {this.props.isSignedIn && <Navlink target="/private" text="Private Turniere"/>}
            <Navlink target="/faq" text="FAQ"/>
        </Nav>);
    }
}

class InvisibleLoginLogoutButtons extends React.Component {
    logout() {
        logout(() => notify.show('Du bist jetzt abgemeldet.', 'success', 2500));
    }

    render() {
        const {isSignedIn, username} = this.props;

        if (isSignedIn) {
            return (<ButtonGroup className="nav-item">
                <Button outline color="success" href="/profile"
                        className="navbar-btn my-2 my-sm-0 px-5">{username}</Button>
                <Button outline color="success" onClick={this.logout.bind(this)}
                        className="navbar-btn my-2 my-sm-0 px-5">Logout</Button>
            </ButtonGroup>);
        } else {
            return (<ButtonGroup className="nav-item">
                <Button outline color="success" href="/login"
                        className="navbar-btn my-2 my-sm-0 px-5">Login</Button>
            </ButtonGroup>);
        }
    }
}

const mapStateToUserinfo = state => {
    const {isSignedIn, username} = state.userinfo;
    return {isSignedIn, username};
};

const LoginLogoutButtons = connect(mapStateToUserinfo)(InvisibleLoginLogoutButtons);

const NavLinks = connect(mapStateToUserinfo)(SmartNavLinks);
