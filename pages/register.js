import Head from 'next/head';
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {notify} from '../js/components/Notifications';
import Router from 'next/router';
import {
    Button, Card, CardBody, Container, Form, FormGroup, FormText, Input, Label,
    Modal, ModalHeader, ModalBody, ModalFooter
} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {Footer} from '../js/components/Footer';
import {register} from '../js/api';

export default class RegisterPage extends React.Component {
    render() {
        return (<div className="main generic-fullpage-bg">
            <Head>
                <title>Registrieren: turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <div>
                <Register/>
                <AccountRequirementMarketing/>
            </div>
            <Footer/>
        </div>);
    }
}

class Register extends React.Component {
    render() {
        return (<Container className="py-5">
            <Card className="shadow">
                <CardBody>
                    <h1 className="custom-font">Registrierung aktuell nicht möglich!</h1>
                    <RegisterForm/>
                    <div className="mt-3">
                        <a href="/login" className="mr-3">Ich habe bereits einen Account!</a>
                    </div>
                </CardBody>
            </Card>
        </Container>);
    }
}

class RegisterErrorList extends React.Component {
    render() {
        const {error, errorMessages} = this.props;
        if (error) {
            return (<ul className="mt-3 error-box">
                {errorMessages.map((message, index) => <li key={index}>{message}</li>)}
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

const VisibleRegisterErrorList = connect(mapStateToErrorMessages)(RegisterErrorList);

class RegisterForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            username: '', email: '', password: '',
            showRegisterSuccessModal: false, code: -1
        };
    }

    render() {
        return (<Form>
            <RegisterSuccessModal isOpen={this.state.showRegisterSuccessModal}
                close={() => this.closeRegisterSuccessModal()}/>
            <FormGroup>
                <Label for="username">Benutzername</Label>
                <Input name="username" value={this.state.username} onChange={this.handleUsernameInput.bind(this)}/>
                <FormText>Wenn du anderen dein Turnier zeigst, können sie deinen Benutzernamen sehen.</FormText>
            </FormGroup>
            <FormGroup>
                <Label for="email">E-Mail-Adresse</Label>
                <Input type="email" name="email" value={this.state.email}
                    onChange={this.handleEmailInput.bind(this)}/>
                <FormText>Deine E-Mail-Adresse kann nur von dir gesehen werden.</FormText>
            </FormGroup>
            <FormGroup>
                <Label for="password">Passwort</Label>
                <Input type="password" name="password" value={this.state.password}
                    onChange={this.handlePasswordInput.bind(this)}/>
                <FormText>Dein Passwort muss mindestens 12 Zeichen lang sein. Alle Zeichen sind erlaubt.</FormText>
            </FormGroup>
            <FormText className="mb-2 mt-4">
                    Du akzeptierst die <a href="/privacy">Datenschutzbestimmungen</a>, wenn du auf Registrieren klickst.
            </FormText>
            <Button onClick={() => this.registerUser()}
                color="success" size="lg" className="w-100 shadow-sm disabled">Registrieren</Button>
            <VisibleRegisterErrorList/>
        </Form>);
    }

    showRegisterSuccessModal() {
        this.setState({
            showRegisterSuccessModal: true
        });
    }

    closeRegisterSuccessModal() {
        Router.push('/');
    }

    registerUser() {
        register(this.state.username, this.state.email, this.state.password, () => {
            this.showRegisterSuccessModal();
        }, () => {
            notify.show('Sie konnten nicht registriert werden.', 'warning', 5000);
        });
    }

    handlePasswordInput(input) {
        this.setState({password: input.target.value});
    }

    handleEmailInput(input) {
        this.setState({email: input.target.value});
    }

    handleUsernameInput(input) {
        this.setState({username: input.target.value});
    }
}

class RegisterSuccessModal extends React.Component {
    render() {
        return (<Modal isOpen={this.props.isOpen} toggle={this.props.close}>
            <ModalHeader toggle={this.props.close}>Erfolgreich registriert</ModalHeader>
            <ModalBody>
                Sie wurden erfolgreich registriert. Um Ihren Account nutzen zu können
                müssen Sie den Verifizierungslink, den wir Ihnen per E-Mail zugesandt haben, aufrufen.
            </ModalBody>
            <ModalFooter>
                <Button color='secondary' onClick={this.props.close}>Verstanden</Button>
            </ModalFooter>
        </Modal>);
    }
}

RegisterSuccessModal.proptypes = {
    isOpen: PropTypes.bool.isRequired,
    close: PropTypes.func.isRequired
};

function AccountRequirementMarketing() {
    return (<Container>
        <Card id="account-requirement">
            <CardBody>
                <h3 className="custom-font">Warum ein Account nötig ist</h3>
                <p>Du benötigst deinen Account, damit nur du dein Turnier bearbeiten kannst.</p>
            </CardBody>
        </Card>
    </Container>);
}
