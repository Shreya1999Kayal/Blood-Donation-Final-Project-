const { normalizeCity } = require('../utils/city');

function joinNotificationRooms(socket) {
    const user = socket.user;
    if (!user) return;

    const city = normalizeCity(user.city || '');

    socket.join(`user:${user._id.toString()}`);
    socket.join(`role:${user.role}`);

    if (city) {
        // keep both formats for backward compatibility with existing emits
        socket.join(city);
        socket.join(`city:${city}`);
    }

    // Backward-compat events (validate they match the authenticated user)
    socket.on('join_city', (requestedCity) => {
        if (!requestedCity) return;
        const requested = normalizeCity(requestedCity);
        if (requested && requested === city) {
            socket.join(requested);
            socket.join(`city:${requested}`);
        }
    });

    socket.on('join_context', (ctx) => {
        // ignore (server now joins based on authenticated user)
        return ctx;
    });
}

module.exports = { joinNotificationRooms };

