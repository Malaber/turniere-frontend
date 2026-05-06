import Head from 'next/head';
import React, {Component} from 'react';
import {Button, Container, Form, Input, InputGroup, Table} from 'reactstrap';

import {TurniereNavigation} from '../js/components/Navigation';
import {BigImage} from '../js/components/BigImage';
import {Footer} from '../js/components/Footer';

import {connect} from 'react-redux';
import {changeMail} from '../js/api';
import {notify} from '../js/components/Notifications';
import RequireLogin from '../js/components/RequireLogin';

function ContentContainer(props) {
    return (<Container className="pb-5">
        <UserData name={props.name} email={props.email} accountId={props.accountId}/>
        <h3 className='custom-font mt-5'>E-Mail-Adresse ändern</h3>
        <NewMailAddressInput email={props.email}/>
    </Container>);
}

export default class ProfilePage extends React.Component {
    render() {
        return (<RequireLogin loginMessage='Sie müssen angemeldet sein, um Ihr Profil einzusehen.'>
            <Head>
                <title>Profil: turnie.re</title>
            </Head>
            <TurniereNavigation/>
            <BigImage text="turnie.re-Account"/>
            <div className='main'>
                <Content/>
            </div>
            <Footer/>
        </RequireLogin>);
    }
}

const Content = connect(state => {
    return {email: state.userinfo.uid, name: state.userinfo.username, accountId: state.userinfo.accountId};
})(ContentContainer);

function UserData(props) {
    return (<Table>
        <tbody>
            <tr>
                <th className='w-small'>Name</th>
                <td className='w-100'>{props.name}</td>
            </tr>
            <tr>
                <th className='w-small'>E-Mail-Adresse</th>
                <td className='mw-100'>{props.email}</td>
            </tr>
            {props.accountId &&
                <tr>
                    <th className='w-small'>Spielerprofil</th>
                    <td className='mw-100'>
                        <a href={'/profiles/' + props.accountId}>/profiles/{props.accountId}</a>
                    </td>
                </tr>}
        </tbody>
    </Table>);
}

class NewMailAddressInput extends Component {
    constructor(props) {
        super(props);
        this.state = {email: ''};
        this.submit = this.submit.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onSubmitSuccess = this.onSubmitSuccess.bind(this);
        NewMailAddressInput.onSubmitError = NewMailAddressInput.onSubmitError.bind(this);
    }

    submit(event) {
        event.preventDefault();
        changeMail(this.state.email, this.onSubmitSuccess, NewMailAddressInput.onSubmitError);
    }

    onSubmitSuccess() {
        this.setState({email: ''});
        notify.show('E-Mail-Adresse geändert.', 'success', 2500);
    }

    static onSubmitError() {
        notify.show('Die E-Mail-Adresse konnte nicht geändert werden.', 'error', 3000);
    }

    onChange(input) {
        this.setState({email: input.target.value});
    }

    render() {
        return (<Form onSubmit={this.submit}>
            <InputGroup>
                <Input type='email' placeholder={this.props.email} onChange={this.onChange} value={this.state.email}
                    required/>
                <Button color='primary' type='submit'>eintragen</Button>
            </InputGroup>
        </Form>);
    }
}
