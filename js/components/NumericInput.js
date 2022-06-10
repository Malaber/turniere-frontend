import React from 'react';
import PropTypes from 'prop-types';
import {Button, InputGroup, InputGroupAddon, Input} from 'reactstrap';

export default class NumericInput extends React.Component {
    render() {
        return (<InputGroup>
            <InputGroupAddon addonType="prepend">
                <Button onClick={this.props.decrementCallback} className="btn-width" color={this.props.decrementColor}
                    outline={this.props.decrementOutline}>{this.props.decrementText}</Button>
            </InputGroupAddon>
            <Input className='font-weight-bold' value={this.props.value}
                disabled type='number'/>
            <InputGroupAddon addonType="append">
                <Button onClick={this.props.incrementCallback} className="btn-width" color={this.props.incrementColor}
                    outline={this.props.incrementOutline}>{this.props.incrementText}</Button>
            </InputGroupAddon>
        </InputGroup>);
    }
}

NumericInput.propTypes = {
    decrementText: PropTypes.string.isRequired,
    decrementCallback: PropTypes.func.isRequired,
    decrementColor: PropTypes.oneOf([
        'primary', 'secondary', 'success', 'info', 'warning', 'danger'
    ]),
    decrementOutline: PropTypes.bool,


    incrementText: PropTypes.string.isRequired,
    incrementCallback: PropTypes.func.isRequired,
    incrementColor: PropTypes.oneOf([
        'primary', 'secondary', 'success', 'info', 'warning', 'danger'
    ]),
    incrementOutline: PropTypes.bool,

    value: PropTypes.number.isRequired
};

NumericInput.defaultProps = {
    decrementColor: 'primary',
    decrementOutline: true,

    incrementColor: 'primary',
    incrementOutline: true
};
