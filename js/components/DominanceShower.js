import React from 'react';
import {
    Card,
    CardBody,
    CardTitle,
    Table
} from 'reactstrap';
import {TeamName} from './TeamName';

export class DominanceShower extends React.Component {
    render() {
        return (
            <Card className="shadow-sm">
                <CardBody>
                    <CardTitle>{this.props.title}</CardTitle>
                    <Table borderless className="m-0" style={{tableLayout: 'fixed', width: '100%'}}>
                        <tbody>
                            <tr>
                                <th colSpan="2" className="h3 text-center">
                                    <TeamName name={this.props.stats.team_name}/>
                                </th>
                            </tr>
                            <tr>
                                <td className="h4 text-success pb-0">{this.props.stats.points_made}</td>
                                <td className="h4 text-danger text-right pb-0">{this.props.stats.points_received}</td>
                            </tr>
                            <tr>
                                <td className="smaller pt-0">Becher geworfen</td>
                                <td className="text-right smaller pt-0">Becher kassiert</td>
                            </tr>
                        </tbody>
                    </Table>
                </CardBody>
            </Card>
        );
    }
}
