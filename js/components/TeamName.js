import React from 'react';

import styles from './TeamName.module.css';

function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

export function TeamName({name, className, inline = false, as: Component = 'span', testId = 'team-name'}) {
    const teamName = name || '';
    const componentClassName = joinClasses(styles.teamName, inline ? styles.inline : '', className);

    return (
        <Component className={componentClassName} title={teamName} data-testid={testId}>
            {teamName}
        </Component>
    );
}
