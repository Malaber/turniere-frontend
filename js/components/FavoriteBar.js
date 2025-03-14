import React, {useState, useEffect} from 'react';
import {Button, ButtonGroup} from 'reactstrap';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faStar as filledStar} from '@fortawesome/free-solid-svg-icons';
import {faStar as emptyStar} from '@fortawesome/free-regular-svg-icons';
import {faHeartCirclePlus, faArrowCircleRight} from '@fortawesome/free-solid-svg-icons';

export function FavoriteBar({teams}) {
    const [favorite, setFavorite] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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

    const toggleFavorite = team => {
        if (favorite && favorite.id === team.id) {
            setFavorite(null);
            localStorage.removeItem('favoriteTeam');
        } else {
            setFavorite(team);
            localStorage.setItem('favoriteTeam', team.id);
        }
    };

    const scrollToFavorite = () => {
        if (favorite) {
            const el = document.getElementById(`favorite-team-groupstage-${favorite.id}`);
            if (el) {
                el.scrollIntoView({behavior: 'smooth', block: 'end'});
            }
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div class="favorites border-bottom py-2 px-1">
            <div style={{display: 'flex', alignItems: 'center'}}>
                <h1 class="custom-font px-2">Favorit:</h1>
                <p>{favorite ? favorite.name : ''}</p>
                <ButtonGroup>
                    <Button onClick={() => setIsVisible(!isVisible)}>
                        <FontAwesomeIcon icon={faHeartCirclePlus}/>
                    </Button>
                    {favorite && (
                        <Button onClick={scrollToFavorite}>
                            <FontAwesomeIcon icon={faArrowCircleRight}/>
                        </Button>
                    )}
                </ButtonGroup>
            </div>
            {isVisible && (
                <div className="favorite-bar">
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
            )}
        </div>
    );
}