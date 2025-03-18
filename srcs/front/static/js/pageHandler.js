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
        // console.log("Current PATH:", path);
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
        // console.log("Rendering Login Page");

        contentArea.innerHTML = `
            <div class="container">
                <h1 class="text-center">Welcome to Pong Game</h1>
                <button id="login-button" class="btn btn-primary">LOGIN</button>
            </div>
        `;

        // Ensure particle background is loaded
        loadParticleBackground()
            .then(() => {})
            .catch(() => {});
    }

    function showGame() {
        // console.log("Rendering Game Page");

        contentArea.innerHTML = `
        <div id="gameBoard">
			<div id="gameStatus" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); color: white; font-size: 24px; text-align: center; line-height: 100vh;">
    			Waiting for Player 2 to join...
			</div>

            <h1 class="text-center">Pong Game</h1>
            <canvas id="gameCanvas" width="800" height="500"></canvas>
        </div>
        `;

        // Dynamically load the game scripts
        Promise.all([
            loadScript('classes.js'),
            loadScript('pong.js'),
        ])
            .then(() => {})
            .catch(() => {});
    }

    function showNotFound() {
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
