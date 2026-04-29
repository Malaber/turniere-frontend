import React from 'react';


function hasGroup(match) {
    return match.group && match.group.number !== undefined && match.group.number !== null;
}

function getBadgeParts(match, mode, showGroup) {
    const grouped = hasGroup(match);

    if (mode === 'group-for-group-matches' && grouped) {
        return {
            kind: 'group',
            value: match.group.number,
            showGroupLabel: false
        };
    }

    if (mode === 'group-and-position' && showGroup && grouped) {
        return {
            kind: 'position',
            value: match.position,
            showGroupLabel: true
        };
    }

    return {
        kind: 'position',
        value: match.position,
        showGroupLabel: false
    };
}

export function MatchPositionBadge({
    match,
    as: Tag = 'span',
    className = '',
    groupClassName = '',
    positionClassName = '',
    testId = 'match-position-badge',
    mode = 'position',
    showGroup = true
}) {
    const badge = getBadgeParts(match, mode, showGroup);
    const grouped = hasGroup(match);

    return (
        <Tag
            className={className}
            data-testid={testId}
            data-match-position={match.position}
            data-match-group={grouped ? match.group.number : undefined}
            data-match-badge-kind={badge.kind}
            data-match-badge-value={badge.value}
        >
            {badge.showGroupLabel && (
                <span className={groupClassName} data-testid={`${testId}-group`}>
                    Gr. {match.group.number}
                </span>
            )}
            <span className={positionClassName} data-testid={`${testId}-number`}>
                {badge.value}
            </span>
        </Tag>
    );
}
