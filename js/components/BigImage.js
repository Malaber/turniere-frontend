import React, {useEffect} from 'react';

export function BigImage(props) {
    useEffect(() => {
        const handleResize = () => {
            const element = document.querySelector('.dynamically-resizing-h1');
            if (element) {
                const parentWidth = element.parentElement.offsetWidth;
                const fontSize = parentWidth / 16; // Adjust the divisor as needed
                element.style.fontSize = `${fontSize}px`;
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call to set the font size

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="big-image">
            <h1 className="text-truncate overflow-hidden dynamically-resizing-h1">{props.text}</h1>
        </div>
    );
}
