import Head from 'next/head';
import {Container} from 'reactstrap';
import {TurniereNavigation} from './Navigation';
import {BigImage} from './BigImage';
import {Footer} from './Footer';

export function AppPage({title, description, children}) {
    return <>
        <Head><title>{title}: turnie.re</title><meta name="description" content={description}/></Head>
        <TurniereNavigation/>
        <BigImage text={title}/>
        <main className="main running-text"><Container>{children}</Container></main>
        <Footer/>
    </>;
}
