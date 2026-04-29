import {Table} from 'reactstrap';
import React from 'react';
import {TeamName} from './TeamName';

function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

export function MatchTable(props) {
    const displayedTeam1Score = props.match.decider ? props.match.team1.hiddenScore : props.match.team1.score;
    const displayedTeam2Score = props.match.decider ? props.match.team2.hiddenScore : props.match.team2.score;
    const shouldMarkLoser = !props.match.decider;
    let team1Class;
    let team2Class;
    // possible states: single_team not_ready not_started in_progress finished
    switch (props.matchStatus || props.match.state) {
    case 'in_progress':
        break;
    case 'finished':
        if (props.match.winnerTeamId === undefined) {
            break;
        }
        if (props.match.winnerTeamId === props.match.team1.id) {
            team1Class = 'font-weight-bold';
            team2Class = shouldMarkLoser ? 'lost-team' : undefined;
        }
        if (props.match.winnerTeamId === props.match.team2.id) {
            team1Class = shouldMarkLoser ? 'lost-team' : undefined;
            team2Class = 'font-weight-bold';
        }
        break;
    case 'single_team':
        team2Class = 'text-muted';
        break;
    case 'not_ready':
        break;
    case 'not_started':
        break;
    }
    const TableElement = props.plain ? 'table' : Table;
    const tableProps = {
        className: joinClasses('mb-0', props.className),
        style: {tableLayout: 'fixed', width: '100%'},
    };

    if (props.match.state === 'single_team') {
        return (<TableElement {...tableProps}>
            <tbody>
                <tr>
                    <td className={'border-top-0 ' + team1Class}>
                        <TeamName name={props.match.team1.name}/>
                    </td>
                </tr>
                <tr>
                    <td className={'border-bottom-0 ' + props.borderColor + ' ' + team2Class}>kein Gegner</td>
                </tr>
            </tbody>
        </TableElement>);
    } else {
        return (<TableElement {...tableProps}>
            <tbody>
                <tr>
                    <th className='stage border-top-0' style={{width: '2.5rem'}}>{displayedTeam1Score}</th>
                    <td className={'border-top-0 ' + team1Class}>
                        <TeamName name={props.match.team1.name}/>
                    </td>
                </tr>
                <tr>
                    <th className={'stage border-bottom-0 ' + props.borderColor} style={{width: '2.5rem'}}>
                        {displayedTeam2Score}
                    </th>
                    <td className={'border-bottom-0 ' + props.borderColor + ' ' + team2Class}>
                        <TeamName name={props.match.team2.name}/>
                    </td>
                </tr>
            </tbody>
        </TableElement>);
    }
}
