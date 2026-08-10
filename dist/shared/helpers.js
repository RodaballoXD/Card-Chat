export function shuffle(array) {
    const shuffled = [...array];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const temp = shuffled[index];
        shuffled[index] = shuffled[swapIndex];
        shuffled[swapIndex] = temp;
    }
    return shuffled;
}
//# sourceMappingURL=helpers.js.map