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
    const scrollButtonRef = useRef(null);

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
            if (scrollButtonRef.current) {
                scrollButtonRef.current.focus();
            }
        }
        setIsVisible(false); // Close the favorite menu
    };

    function findLowestPlayoffParticipation(favoriteId) {
        const matchesWithFavoriteParticipation = document.querySelectorAll(`[data-team-level-ids*='-${favoriteId}']`);
        let lowestMatch = null; // lowest means lowest stage number > latest game of the favorite
        let lowestStageNum = Infinity;

        // Iterate over each element to find the match with the lowest stage number
        matchesWithFavoriteParticipation.forEach(el => {
            const dataTeamLevelIds = el.getAttribute('data-team-level-ids').split(',');
            dataTeamLevelIds.forEach(pair => {
                const [stage, teamId] = pair.split('-').map(Number);
                if (teamId === favorite.id && stage < lowestStageNum) {
                    lowestStageNum = stage;
                    lowestMatch = el;
                }
            });
        });
        return lowestMatch;
    }

    function findScrollToGroup(favoriteId) {
        // Look for group elements that contain the favorite team's ID
        const groupElements = document.querySelectorAll('[data-teams]');
        const scrollToNotFound = null;

        for (const groupEl of groupElements) {
            const teamIds = groupEl.getAttribute('data-teams').split(',').map(id => parseInt(id, 10));
            if (teamIds.includes(favoriteId)) {
                return groupEl;
            }
        }

        return scrollToNotFound;
    }

    const scrollToFavorite = () => {
        if (!favorite) {
            return; // Exit if there is no favorite team selected
        }

        const lowestMatch = findLowestPlayoffParticipation(favorite.id);

        let scrollTo;
        if (lowestMatch) {
            scrollTo = lowestMatch;
        } else {
            scrollTo = findScrollToGroup(favorite.id);
        }

        if (!scrollTo) {
            console.error('No match or group found for the favorite team');
            return;
        }

        let scrollTimeout;
        const handleScroll = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                setIsPulsing(false);
                scrollTo.classList.add('scroll-to-highlight');
                setTimeout(() => {
                    scrollTo.classList.remove('scroll-to-highlight');
                }, 1005);
                window.removeEventListener('scroll', handleScroll);
            }, 100);
        };

        scrollTo.scrollIntoView({behavior: 'smooth', block: 'center'}); // Smoothly scroll to the target element

        // scroll up a tiny amount to reset the scroll event listener if user is already on the element
        window.scrollBy(0, 1);

        // Add a scroll event listener to start the highlighting after scrolling only
        window.addEventListener('scroll', handleScroll);
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    const filteredTeams = sortedTeams.filter(team => team.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="favorites border-bottom py-2 px-1">
            <div className="d-flex align-items-center">
                <h1 className="custom-font m-2 px-2" ref={headingRef}>Favorit:</h1>
                <p className="m-2">{favorite ? favorite.name : ''}</p>
                <ButtonGroup className="m-2">
                    <Button
                        title="{isVisible ? 'Favoriten schließen' : 'Favoriten öffnen'}"
                        onClick={() => setIsVisible(!isVisible)}
                    >
                        <FaHeartCirclePlus/>
                    </Button>
                    {favorite && (
                        <Button
                            title="Zum aktuellen Spiel des Favoriten springen"
                            onClick={scrollToFavorite}
                            className={isPulsing ? 'pulse-animation' : ''}
                            innerRef={scrollButtonRef}
                        >
                            <FaArrowTurnDown/>
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
