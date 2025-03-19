import Head from 'next/head';
import {TurniereNavigation} from './Navigation';
import {Container} from 'reactstrap';
import {Footer} from './Footer';
import React from 'react';

export function LoadingPage(props) {
    return (<div>
        <Head>
            <title>{props.title}</title>
        </Head>
        <TurniereNavigation/>
        <Container>
            <div className='text-center'>
                <img src='/static/images/logo-questionmark.png' alt='' className='img-fluid loading-logo'/>
            </div>
            <div className='py-5 text-center w-100 h1 custom-font'>
                {props.text}
            </div>
        </Container>
        <Footer/>
    </div>);
}
