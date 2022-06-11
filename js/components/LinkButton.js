import {Button} from 'reactstrap';
import {useRouter} from 'next/router';
import React from 'react';

class LinkButtonComponent extends React.Component {
    constructor(props) {
        super(props);
        this.defaultProps = {
            outline: true,
            color: 'secondary'
        };
    }

    handleClick(e) {
        e.preventDefault();
        this.props.router.push(this.props.href);
    }

    render() {
        return (
            <Button outline={this.props.outline} color={this.props.color} onClick={e => this.handleClick(e)}>
                {this.props.children}
            </Button>
        );
    }
}

LinkButtonComponent.defaultProps = {
    outline: true,
    color: 'secondary'
};

// export default withRouter(LinkButton);

export function LinkButton(props) {
    const router = useRouter();
    return (<LinkButtonComponent {...props} router={router} />);
}
