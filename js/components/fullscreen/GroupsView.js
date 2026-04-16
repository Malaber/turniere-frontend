import React from 'react';
import {Col, Container, Row, Spinner} from 'reactstrap';
import {QRCodeSVG} from 'qrcode.react';
import {Group} from '../GroupStage';


export class GroupsView extends React.Component {
    constructor(props) {
        super(props);
        this.groupsPerPage = 11;
        this.pages = 2;
        this.page = 0;
        this.backgroundColors = ['#a8e6cf', '#dcedc1', '#ffd3b6'];

        this.state = {
            groups: [],
            page: 0,
            showLogo: false,
            backgroundColor: this.backgroundColors[0]
        };
        this.increasePage = this.increasePage.bind(this);
    }

    componentDidMount() {
        this.updateGroups();
        this.intervalId = setInterval(this.increasePage, 15000);
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.tournament !== this.props.tournament) {
            this.updateGroups();
        }
    }

    increasePage() {
        if (this.page >= this.pages) {
            this.page = 0;
        } else {
            this.page = this.page + 1;
        }
        this.updateGroups();
    }

    updateGroups() {
        const {tournament} = this.props;
        if (!tournament || !tournament.groupStage) return;

        const groups = tournament.groupStage.groups;
        const start = this.page * this.groupsPerPage;
        const end = (this.page + 1) * this.groupsPerPage;

        this.setState({
            groups: groups.slice(start, end),
            page: this.page,
            showLogo: this.page === this.pages,
            backgroundColor: this.backgroundColors[this.page] || 'white'
        });
    }

    render() {
        const {tournament, qrCodeUrl, logoUrl} = this.props;
        const {groups, showLogo, backgroundColor} = this.state;

        if (!tournament || !tournament.groupStage) {
            return (<Container className="p-5 text-center text-secondary">
                <Spinner size="sm"/>
                <span className="ml-3">lade Gruppen</span>
            </Container>);
        }

        let logo;
        if (showLogo && logoUrl) {
            logo = <Col>
                <div className="d-flex justify-content-center align-items-center">
                    <img height="300" width="300" src={logoUrl}/>
                </div>
            </Col>;
        } else {
            logo = <div/>;
        }

        return (<div>
            <Container className="fs-5" fluid>
                <Row className="row-cols-4">
                    {groups.map(group =>
                        <Col className="mb-2" key={group.id}>
                            <Group group={group} teams={tournament.teams}/>
                        </Col>
                    )}
                    {qrCodeUrl && <Col>
                        <div className="d-flex justify-content-center align-items-center">
                            <QRCodeSVG
                                className="shadow mx-auto"
                                value={qrCodeUrl}
                                size="300"
                            />
                        </div>
                    </Col>}
                    {logo}
                </Row>
            </Container>
            <style global jsx>{`
                body {
                    background: ${backgroundColor};
                }
            `}</style>
        </div>);
    }
}
