export function sortMatchesByPositionAscending() {
    return (a, b) => {
        if (a.position < b.position) {
            return -1;
        } else if (a.position > b.position) {
            return 1;
        } else {
            return 0;
        }
    };
}
