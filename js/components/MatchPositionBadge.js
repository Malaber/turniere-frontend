import React from 'react';


export function MatchPositionBadge({
    match,
    as: Tag = 'span',
    className = '',
    groupClassName = '',
    positionClassName = '',
    testId = 'match-position-badge',
    showGroup = true
}) {
    const hasGroup = showGroup && match.group && match.group.number !== undefined && match.group.number !== null;

    return (
        <Tag
            className={className}
            data-testid={testId}
            data-match-position={match.position}
            data-match-group={hasGroup ? match.group.number : undefined}
        >
            {hasGroup && (
                <span className={groupClassName} data-testid={`${testId}-group`}>
                    Gr. {match.group.number}
                </span>
            )}
            <span className={positionClassName} data-testid={`${testId}-number`}>
                {match.position}
            </span>
        </Tag>
    );
}
