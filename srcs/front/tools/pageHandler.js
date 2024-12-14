document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');

    // Define routes
    const routes = {
        '/': showLogin,
        '/game': showGame,
    };

    // Function to handle route changes
    function router() {
        const path = window.location.pathname;
        console.log("Current PATH:", path);
        if (routes[path]) {
            routes[path]();
        } else {
            showNotFound();
        }
    }

    function loadScript(src, type = 'module') {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = type;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function loadParticleBackground() {
        return loadScript('js/particle_background.js', 'text/javascript');
    }

    // Define components
    function showLogin() {
        console.log("Rendering Login Page");

        contentArea.innerHTML = `
            <div class="container">
                <h1 class="text-center">Welcome to Pong Game</h1>
                <button id="login-button" class="btn btn-primary">LOGIN</button>
            </div>
        `;

        // Ensure particle background is loaded
        loadParticleBackground()
            .then(() => console.log("Particle background loaded successfully."))
            .catch(err => console.error("Error loading particle background:", err));
    }

    function showGame() {
        console.log("Rendering Game Page");

        contentArea.innerHTML = `
        <div id="gameBoard">
            <h1 class="text-center">Pong Game</h1>
            <canvas id="gameCanvas" width="1600" height="800"></canvas>
        </div>
        `;

        // Dynamically load the game scripts
        Promise.all([
            loadScript('classes.js'),
            loadScript('pong.js'),
        ])
            .then(() => console.log('Game scripts loaded successfully.'))
            .catch(err => console.error('Error loading game scripts:', err));
    }

    function showNotFound() {
        console.log("Rendering 404 Page");
        contentArea.innerHTML = `
            <div>
                <h1>404 - Page Not Found</h1>
                <p>The requested page does not exist.</p>
            </div>
        `;
    }

    // Listen for popstate events to handle browser navigation
    window.addEventListener('popstate', router);

    // Handle initial route
    router();
});
