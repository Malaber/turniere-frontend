import React, {useState, useEffect} from 'react';
import {Button} from 'reactstrap';

export function FavoriteBar({teams}) {
    const [favorite, setFavorite] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const savedFavorite = localStorage.getItem('favoriteTeam');
        if (savedFavorite) {
            const team = teams.find(team => team.id === parseInt(savedFavorite, 10));
            if (team) {
                setFavorite(team);
            }
        }
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

    return (
        <div>
            <Button onClick={() => setIsVisible(!isVisible)}>
                {isVisible ? 'Hide Favorite Bar' : 'Show Favorite Bar'}
            </Button>
            {isVisible && (
                <div className="favorite-bar">
                    <h2>Favorite Team</h2>
                    {favorite ? <p>{favorite.name}</p> : <p>No favorite team selected</p>}
                    <h3>All Teams</h3>
                    <ul>
                        {teams.map(team => (
                            <li key={team.id}>
                                {team.name} {favorite && favorite.id === team.id && <span>(Favorite)</span>}
                                <Button onClick={() => toggleFavorite(team)}>
                                    {favorite && favorite.id === team.id ? 'Remove from Favorites' : 'Add to Favorites'}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
