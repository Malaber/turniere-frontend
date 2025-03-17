import React, {useState, useEffect, useRef} from 'react';
import {Button, ButtonGroup, Input} from 'reactstrap';
import {FaHeartCirclePlus, FaRegHeart, FaHeart, FaArrowTurnDown} from 'react-icons/fa6';

export function FavoriteBar({teams}) {
    const [favorite, setFavorite] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPulsing, setIsPulsing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
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

    useEffect(() => {
        if (favoriteBarRef.current) {
            favoriteBarRef.current.style.maxHeight = `${favoriteBarRef.current.scrollHeight}px`;
        }
    }, [searchQuery]);

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
        if (!favorite) {
            return;
        }

        const stageElements = document.querySelectorAll(`[id^='favorite-team-level-'][id$='-${favorite.id}']`);
        let lowestStageEl = null;
        let lowestStageNum = Infinity;

        stageElements.forEach(el => {
            const match = el.id.match(/^favorite-team-level-(\d+)-(\d+)$/);
            if (match) {
                const stage = parseInt(match[1]);
                if (stage < lowestStageNum) {
                    lowestStageNum = stage;
                    lowestStageEl = el;
                }
            }
        });

        if (lowestStageEl) {
            lowestStageEl.scrollIntoView({behavior: 'smooth', block: 'end'});
        } else {
            const groupEl = document.getElementById(`favorite-team-groupstage-${favorite.id}`);
            if (groupEl) {
                groupEl.scrollIntoView({behavior: 'smooth', block: 'end'});
            }
        }
        setIsPulsing(false);
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    const filteredTeams = sortedTeams.filter(team => team.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="favorites border-bottom py-2 px-1">
            <div className="d-flex align-items-center">
                <h1 className="custom-font px-2" ref={headingRef}>Favorit:</h1>
                <p className="m-2">{favorite ? favorite.name : ''}</p>
                <ButtonGroup className="m-2">
                    <Button
                        title="{isVisible ? 'Favoriten schließen' : 'Favoriten öffnen'}"
                        onClick={() => setIsVisible(!isVisible)}
                    >
                        <FaHeartCirclePlus />
                    </Button>
                    {favorite && (
                        <Button
                            title="Zum aktuellen Spiel des Favoriten springen"
                            onClick={scrollToFavorite}
                            className={isPulsing ? 'pulse-animation' : ''}
                        >
                            <FaArrowTurnDown />
                        </Button>
                    )}
                </ButtonGroup>
            </div>
            <div className={`favorite-bar ${isVisible ? 'visible' : ''}`} ref={favoriteBarRef}>
                {sortedTeams.length > 5 && (
                    <Input
                        type="text"
                        placeholder="Team suchen..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="mb-2"
                    />
                )}
                <div>
                    {filteredTeams.map(team => (
                        <div
                            key={team.id}
                            onClick={() => toggleFavorite(team)}
                            style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}
                        >
                            <Button
                                onClick={e => {
                                    e.stopPropagation();
                                    toggleFavorite(team);
                                }}
                                style={{marginRight: '10px'}}
                            >
                                {favorite && favorite.id === team.id ? <FaHeart/> : <FaRegHeart/>}
                            </Button>
                            <span>{team.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
