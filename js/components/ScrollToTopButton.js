import React, {useState, useEffect} from 'react';
import {Button} from 'reactstrap';
import {FaArrowUp} from 'react-icons/fa6';

export function ScrollToTopButton() {
    const [isVisible, setIsVisible] = useState(false);
    const [isFooterVisible, setIsFooterVisible] = useState(false);

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

    useEffect(() => {
        const footer = document.querySelector('footer');
        if (!footer || !('IntersectionObserver' in window)) {
            return undefined;
        }

        const observer = new IntersectionObserver(entries => {
            setIsFooterVisible(entries.some(entry => entry.isIntersecting));
        });
        observer.observe(footer);
        return () => observer.disconnect();
    }, []);

    const scrollToTop = () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
    };
    const showButton = isVisible && !isFooterVisible;

    return (
        <Button
            aria-label="Nach oben"
            className="scroll-to-top-button"
            color="secondary"
            onClick={scrollToTop}
            style={{
                opacity: showButton ? 0.7 : 0,
                pointerEvents: showButton ? 'auto' : 'none',
                visibility: showButton ? 'visible' : 'hidden'
            }}
        >
            <FaArrowUp aria-hidden="true"/>
        </Button>
    );
}
