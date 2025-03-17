import {Table} from 'reactstrap';
import React from 'react';

export function MatchTable(props) {
    let team1Class;
    let team2Class;
    // possible states: single_team not_ready not_started in_progress finished
    switch (props.matchState) {
    case 'in_progress':
        break;
    case 'finished':
        if (props.match.winnerTeamId === undefined) {
            break;
        }
        if (props.winnerTeamId === props.match.team1.id) {
            team1Class = 'font-weight-bold';
            team2Class = 'lost-team';
        }
        if (props.winnerTeamId === props.match.team2.id) {
            team1Class = 'lost-team';
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
    if (props.match.state === 'single_team') {
        return (<Table className='mb-0'>
            <tbody>
                <tr>
                    <td className={'border-top-0 ' + team1Class}>{props.match.team1.name}</td>
                </tr>
                <tr>
                    <td className={'border-bottom-0 ' + props.borderColor + ' ' + team2Class}>kein Gegner</td>
                </tr>
            </tbody>
        </Table>);
    } else {
        return (<Table className='mb-0'>
            <tbody>
                <tr>
                    <th className='stage border-top-0'>{props.match.team1.score}</th>
                    <td className={'border-top-0 ' + team1Class}>{props.match.team1.name}</td>
                </tr>
                <tr>
                    <th className={'stage border-bottom-0 ' + props.borderColor}>{props.match.team2.score}</th>
                    <td className={'border-bottom-0 ' + props.borderColor + ' ' + team2Class}>
                        {props.match.team2.name}
                    </td>
                </tr>
            </tbody>
        </Table>);
    }
}
