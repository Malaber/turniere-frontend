import React, {useState, useEffect, useRef} from 'react';
import {Button, ButtonGroup} from 'reactstrap';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faStar as filledStar} from '@fortawesome/free-solid-svg-icons';
import {faStar as emptyStar} from '@fortawesome/free-regular-svg-icons';
import {faHeartCirclePlus, faArrowCircleRight} from '@fortawesome/free-solid-svg-icons';

export function FavoriteBar({teams}) {
    const [favorite, setFavorite] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPulsing, setIsPulsing] = useState(false);
    const headingRef = useRef(null);
    const favoriteBarRef = useRef(null);

    useEffect(() => {
        const savedFavorite = localStorage.getItem('favoriteTeam');
        if (savedFavorite) {
            const team = teams.find(team => team.id === parseInt(savedFavorite, 10));
            if (team) {
                setFavorite(team);
            }
        }
        setIsLoading(false);
    }, [teams]);

    useEffect(() => {
        if (isVisible && favoriteBarRef.current) {
            favoriteBarRef.current.style.maxHeight = `${favoriteBarRef.current.scrollHeight}px`;
        } else if (favoriteBarRef.current) {
            favoriteBarRef.current.style.maxHeight = '0';
        }
    }, [isVisible]);

    const toggleFavorite = team => {
        if (favorite && favorite.id === team.id) {
            setFavorite(null);
            localStorage.removeItem('favoriteTeam');
        } else {
            setFavorite(team);
            localStorage.setItem('favoriteTeam', team.id);
            setIsPulsing(true);
            headingRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
        setIsVisible(false); // Close the favorite menu
    };

    const scrollToFavorite = () => {
        if (favorite) {
            const el = document.getElementById(`favorite-team-groupstage-${favorite.id}`);
            if (el) {
                el.scrollIntoView({behavior: 'smooth', block: 'end'});
            }
            setIsPulsing(false); // Stop pulsing when the button is clicked
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="favorites border-bottom py-2 px-1">
            <div style={{display: 'flex', alignItems: 'center'}}>
                <h1 className="custom-font px-2" ref={headingRef}>Favorit:</h1>
                <p className="m-2">{favorite ? favorite.name : ''}</p>
                <ButtonGroup className="m-2">
                    <Button title="Favorit Auswahlmenü öffnen/schließen" onClick={() => setIsVisible(!isVisible)}>
                        <FontAwesomeIcon icon={faHeartCirclePlus}/>
                    </Button>
                    {favorite && (
                        <Button
                            title="Zum aktuellen Spiel springen"
                            onClick={scrollToFavorite}
                            className={isPulsing ? 'pulse-animation' : ''}
                        >
                            <FontAwesomeIcon icon={faArrowCircleRight}/>
                        </Button>
                    )}
                </ButtonGroup>
            </div>
            <div className={`favorite-bar ${isVisible ? 'visible' : ''}`} ref={favoriteBarRef}>
                <div>
                    {sortedTeams.map(team => (
                        <div key={team.id} style={{display: 'flex', alignItems: 'center'}}>
                            <Button onClick={() => toggleFavorite(team)} style={{marginRight: '10px'}}>
                                <FontAwesomeIcon
                                    icon={favorite && favorite.id === team.id ? filledStar : emptyStar}
                                />
                            </Button>
                            <span>
                                {team.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
