import React, {useEffect, useState} from 'react';

const listeners = new Set();
const pendingToasts = [];
let nextToastId = 1;

const colors = {
    default: '#0d6efd',
    error: '#dc3545',
    success: '#198754',
    warning: '#f0ad4e'
};

export const notify = {
    show(message, type = 'default', timeout = 3000) {
        const toast = {
            id: nextToastId++,
            message,
            timeout,
            type
        };

        if (listeners.size === 0) {
            pendingToasts.push(toast);
            return;
        }

        listeners.forEach(listener => listener(toast));
    }
};

function Toast({toast, onClose}) {
    const backgroundColor = colors[toast.type] || colors.default;

    return (
        <button
            type="button"
            onClick={() => onClose(toast.id)}
            style={{
                backgroundColor,
                border: 0,
                borderRadius: 4,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
                color: '#fff',
                cursor: 'pointer',
                display: 'block',
                fontSize: 14,
                lineHeight: 1.4,
                margin: '0 auto 8px',
                maxWidth: 'min(560px, calc(100vw - 32px))',
                padding: '10px 14px',
                textAlign: 'left'
            }}
        >
            {toast.message}
        </button>
    );
}

export default function Notifications() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const addToast = toast => {
            setToasts(current => [...current, toast]);
            if (toast.timeout !== 0) {
                window.setTimeout(() => {
                    setToasts(current => current.filter(item => item.id !== toast.id));
                }, toast.timeout || 3000);
            }
        };

        listeners.add(addToast);
        pendingToasts.splice(0).forEach(addToast);

        return () => listeners.delete(addToast);
    }, []);

    const closeToast = id => {
        setToasts(current => current.filter(toast => toast.id !== id));
    };

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div
            aria-live="polite"
            style={{
                left: 0,
                pointerEvents: 'none',
                position: 'fixed',
                right: 0,
                top: 16,
                zIndex: 2000
            }}
        >
            {toasts.map(toast => (
                <div key={toast.id} style={{pointerEvents: 'auto'}}>
                    <Toast toast={toast} onClose={closeToast} />
                </div>
            ))}
        </div>
    );
}
