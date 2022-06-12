import {Card, CardBody, Container, Form, FormGroup, Input, Label} from 'reactstrap';
import React from 'react';
import {connect} from 'react-redux';
import Router from 'next/router';

import {login} from '../api';

import {notify} from 'react-notify-toast';

export function Login(props) {
    return (<Container className="py-5">
        <Card className="shadow">
            <CardBody>
                <h1 className="custom-font">Login</h1>
                <Hint hint={props.hint}/>
                <LoginForm/>
                <div className="mt-3">
                    <a href="/register" className="me-3">Account anlegen</a>
                    <a href="/register#account-requirement">Warum ist ein Account nötig?</a>
                </div>
            </CardBody>
        </Card>
    </Container>);
}

class LoginErrorList extends React.Component {
    render() {
        const {error, errorMessages} = this.props;
        if (error) {
            return (<ul className='mt-3 error-box'>
                {errorMessages.map((message, index) => <li key={index}>
                    {message}
                </li>)}
            </ul>);
        } else {
            return null;
        }
    }
}

const mapStateToErrorMessages = state => {
    const {errorMessages, error} = state.userinfo;
    return {errorMessages, error};
};

const VisibleLoginErrorList = connect(mapStateToErrorMessages)(LoginErrorList);

class LoginSuccessRedirectComponent extends React.Component {
    render() {
        if (this.props.isSignedIn) {
            Router.push('/');
        }
        return null;
    }
}

const mapLoginState = state => {
    const {isSignedIn} = state.userinfo;
    return {isSignedIn};
};

const LoginSuccessRedirect = connect(mapLoginState)(LoginSuccessRedirectComponent);

class LoginForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: '', password: ''
        };
    }

    tryLogin(event) {
        event.preventDefault();
        login(this.state.email, this.state.password,
            username => notify.show('Willkommen, ' + username + '!', 'success', 2500));
    }

    render() {
        return (<Form onSubmit={this.tryLogin.bind(this)}>
            <FormGroup>
                <Label for="username">E-Mail-Adresse</Label>
                <Input type="email" name="username" value={this.state.email}
                    onChange={this.handleEmailInput.bind(this)}/>
            </FormGroup>
            <FormGroup>
                <Label for="password">Passwort</Label>
                <Input type="password" name="password" value={this.state.password}
                    onChange={this.handlePasswordInput.bind(this)}/>
            </FormGroup>
            <input type="submit" className="btn btn-lg btn-success w-100 shadow-sm" value="Anmelden"/>
            <VisibleLoginErrorList/>
            <LoginSuccessRedirect/>
        </Form>);
    }

    handlePasswordInput(input) {
        this.setState({password: input.target.value});
    }

    handleEmailInput(input) {
        this.setState({email: input.target.value});
    }
}

function Hint(props) {
    if (props.hint != null) {
        return (<h3>{props.hint}</h3>);
    } else {
        return null;
    }
}
