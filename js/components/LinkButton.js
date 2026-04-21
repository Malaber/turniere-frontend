import {Button} from 'reactstrap';
import React from 'react';

class LinkButtonComponent extends React.Component {
    render() {
        return (
            <Button tag="a" href={this.props.href} role="button"
                outline={this.props.outline} color={this.props.color}>
                {this.props.children}
            </Button>
        );
    }
}

LinkButtonComponent.defaultProps = {
    outline: true,
    color: 'secondary'
};

export function LinkButton(props) {
    return (<LinkButtonComponent {...props}/>);
}
