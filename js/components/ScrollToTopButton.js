import React, {useState, useEffect} from 'react';
import {Button} from 'reactstrap';
import {FaArrowUp} from 'react-icons/fa6';

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
            aria-label="Nach oben"
            className="scroll-to-top-button"
            color="secondary"
            onClick={scrollToTop}
            style={{
                opacity: isVisible ? 0.7 : 0,
                pointerEvents: isVisible ? 'auto' : 'none'
            }}
        >
            <FaArrowUp aria-hidden="true"/>
        </Button>
    );
}
