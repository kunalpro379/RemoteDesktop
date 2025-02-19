// This file ensures socket.io is available globally
(function() {
    if (typeof io === 'undefined') {
        console.error('Socket.IO not loaded');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'connection-error';
        errorDiv.textContent = 'Failed to load Socket.IO. Please refresh the page.';
        document.body.appendChild(errorDiv);
    }
})();
