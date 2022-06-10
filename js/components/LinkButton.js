import {Button} from 'reactstrap';
import {useRouter} from 'next/router';
import React from 'react';

export function LinkButton(props) {
    const router = useRouter();

    const handleClick = e => {
        e.preventDefault();
        router.push(props.href);
    };

    return (<Button outline='true' onClick={handleClick}>{props.children}</Button>);
}
