import React from 'react';
import {FormGroup, Input, Label} from 'reactstrap';
import {sanitizeBeamerMediaImageKeys} from '../utils/beamerMedia';

function selectedClassName(selected) {
    return 'mission-beamer-media-option' + (selected ? ' is-selected' : '');
}

export function BeamerMediaSelection(props) {
    const images = Array.isArray(props.images) ? props.images : [];
    const type = props.type === 'radio' ? 'radio' : 'checkbox';
    const selectedKeys = sanitizeBeamerMediaImageKeys(props.selectedKeys);
    const selectedLookup = selectedKeys.reduce((lookup, key) => {
        lookup[key] = true;
        return lookup;
    }, {});
    const name = props.name || props.testIdPrefix || 'beamer-media-selection';

    function updateSelection(imageKey, checked) {
        if (type === 'radio') {
            props.onChange([imageKey]);
            return;
        }

        const nextKeys = checked ?
            sanitizeBeamerMediaImageKeys(selectedKeys.concat([imageKey])) :
            selectedKeys.filter(key => key !== imageKey);
        props.onChange(nextKeys);
    }

    return (
        <div
            className='mission-beamer-media-checklist'
            data-testid={props.testId}>
            <div className='mission-beamer-media-label'>{props.label}</div>
            {images.map(image => {
                const inputId = props.idPrefix + image.key;
                const checked = Boolean(selectedLookup[image.key]);
                return (
                    <FormGroup check className={selectedClassName(checked)} key={image.key}>
                        <Input
                            id={inputId}
                            name={name}
                            type={type}
                            checked={checked}
                            disabled={props.disabled}
                            data-testid={props.testIdPrefix + image.key}
                            onChange={event => updateSelection(image.key, event.target.checked)}
                        />
                        <Label check for={inputId}>
                            <span className='mission-beamer-media-thumb'>
                                <img src={image.src} alt='' />
                            </span>
                            <span>{image.label}</span>
                        </Label>
                    </FormGroup>
                );
            })}
        </div>
    );
}
