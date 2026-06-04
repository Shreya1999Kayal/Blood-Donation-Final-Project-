const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Sum of all blood group units for one blood bank. */
const LOW_STOCK_TOTAL_THRESHOLD = 60;

function totalInventory(source) {
    const inventory = source?.inventory || source || {};
    return BLOOD_GROUPS.reduce(function (sum, group) {
        return sum + Number(inventory[group] || 0);
    }, 0);
}

/**
 * Stock level for admin filters and badges.
 * - empty: 0 units total
 * - low: 1–59 units total (all groups combined)
 * - stocked: 60+ units total
 */
function getStockLevel(source) {
    const total = totalInventory(source);
    if (total === 0) return 'empty';
    if (total < LOW_STOCK_TOTAL_THRESHOLD) return 'low';
    return 'stocked';
}

function getStockLabel(level) {
    if (level === 'empty') return 'Empty';
    if (level === 'low') return 'Low stock';
    return 'Stocked';
}

module.exports = {
    BLOOD_GROUPS,
    LOW_STOCK_TOTAL_THRESHOLD,
    totalInventory,
    getStockLevel,
    getStockLabel,
};
