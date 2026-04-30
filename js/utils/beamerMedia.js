export const WERBUNG_DISPLAY_MODE = 'werbung';
export const STATIC_IMAGE_KEY_CONFIG_KEY = 'image_key';
export const WERBUNG_IMAGE_KEYS_CONFIG_KEY = 'werbung_image_keys';
export const WERBUNG_ROTATION_SECONDS_CONFIG_KEY = 'werbung_rotation_seconds';
export const DEFAULT_WERBUNG_ROTATION_SECONDS = 10;

export const BEAMER_MEDIA_IMAGES = [
    {
        key: 'bpwstr_banner',
        label: 'BPWSTR Banner',
        src: '/static/images/bpwstr_banner.jpg'
    },
    {
        key: 'bpwstr_logo',
        label: 'BPWSTR Logo',
        src: '/static/images/bpwstr_logo.png'
    },
    {
        key: 'bpwstr_qr_code',
        label: 'BPWSTR QR-Code',
        src: '/static/images/bpwstr_qr_code.png'
    },
    {
        key: 'turniere_logo',
        label: 'Turnie Logo',
        src: '/static/images/logo-questionmark.png'
    },
    {
        key: 'landingpage_background',
        label: 'Landingpage Hintergrund',
        src: '/static/images/landingpage-background.jpg'
    },
    {
        key: 'tennis_blurred',
        label: 'Tennis Hintergrund',
        src: '/static/images/tennis-blurred.jpg'
    }
];

export const DEFAULT_BEAMER_MEDIA_IMAGE_KEY = 'bpwstr_logo';

const IMAGE_BY_KEY = BEAMER_MEDIA_IMAGES.reduce((imagesByKey, image) => {
    imagesByKey[image.key] = image;
    return imagesByKey;
}, {});

export function beamerMediaImageForKey(key) {
    return IMAGE_BY_KEY[key] || IMAGE_BY_KEY[DEFAULT_BEAMER_MEDIA_IMAGE_KEY];
}

export function allBeamerMediaImageKeys() {
    return BEAMER_MEDIA_IMAGES.map(image => image.key);
}

export function sanitizeBeamerMediaImageKeys(keys) {
    if (!Array.isArray(keys)) {
        return [];
    }

    const seen = {};
    return keys.filter(key => {
        if (!IMAGE_BY_KEY[key] || seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    });
}

export function sanitizeWerbungImageKeys(keys) {
    return sanitizeBeamerMediaImageKeys(keys);
}

export function beamerMediaImagesForKeys(keys) {
    return sanitizeBeamerMediaImageKeys(keys).map(key => IMAGE_BY_KEY[key]);
}

export function selectedWerbungImages(config) {
    return beamerMediaImagesForKeys(config ? config[WERBUNG_IMAGE_KEYS_CONFIG_KEY] : []);
}

export function werbungRotationMs(config) {
    const rawSeconds = Number(config ? config[WERBUNG_ROTATION_SECONDS_CONFIG_KEY] : null);
    const seconds = Number.isFinite(rawSeconds) && rawSeconds >= 1 ?
        rawSeconds :
        DEFAULT_WERBUNG_ROTATION_SECONDS;
    return seconds * 1000;
}
