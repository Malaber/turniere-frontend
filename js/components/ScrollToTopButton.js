import React, {useState, useEffect} from 'react';
import {Button} from 'reactstrap';
import {FaCircleArrowUp} from 'react-icons/fa6';

export function ScrollToTopButton() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 1.5 * window.innerHeight) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
    };

    return (
        <Button
            onClick={scrollToTop}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                zIndex: 999,
                transition: 'opacity 0.5s ease-in-out',
                opacity: isVisible ? 0.7 : 0,
                pointerEvents: isVisible ? 'auto' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <FaCircleArrowUp style={{fontSize: '36px'}}/>
        </Button>
    );
}