import { loadLoginPage, handleSignup } from "./login.js";
import { loadProfilePage, loadProfileSettingsPage, loadMatchHistoryPage } from "./profile.js";
import { handleLoginIntra, handle42Callback } from "./42auth.js";
import { loadHomePage } from "./home.js";
import { loadFriendsSearchPage } from "./friends.js"
import { handleLogout } from "./logout.js"

const historyTracker = [];

// The routes object maps URL paths to their respective handler functions:
// Each key is a path (e.g., /, /profile).
// Each value is a function that handles what should happen when the app navigates to that path.

const routes = {
    '/': homePage,
    '/login': loadLoginPage,
    '/signup': handleSignup,
    '/login-intra': handleLoginIntra, 
    '/callback': handle42Callback,
    '/home': loadHomePage,
    '/profile': loadProfilePage,
    '/profile-settings': loadProfileSettingsPage,
    '/friends': loadFriendsSearchPage,
    '/match-history': loadMatchHistoryPage,
    '/logout': handleLogout,
    // '/options': optionsPage,
    // '/localgame': localGamePage,
    // '/aigame': aiGamePage,
    // '/tournament': tournamentPage,

    // EXAMPLE how to announce a function that receives parameters:
    // '/login': (args) => loadLoginPage(args),
};


// The router() function determines which handler function to call 
// based on the current path (window.location.pathname).
// If the path exists in the routes object, its associated function is executed.

function router() {
    const path = window.location.pathname;

    if (routes[path]) {
        routes[path](); // Call the function associated with the path
    } else {
        console.log(`Route ${path} not handled`);
        // renderNotFound(); // Handle unknown routes
    }
}

// The navigateTo() function is responsible for programmatically changing 
// the browser's history and triggering the router.
// history.pushState(): Adds a new entry to the browser's history stack and 
// changes the URL in the address bar.
// history.replaceState(): Updates the current history entry instead of 
// creating a new one.
// After modifying the browser's history, router() is called to render the appropriate page.
// Additionally, a historyTracker array is maintained for debugging, which logs every navigation event 
// (pushState or replaceState).

export function navigateTo(path, replace = false) {
    console.log(`navigating to ${path}`)
    if (replace) {
        history.replaceState({ path }, null, path);
        historyTracker.push({ action: 'replaceState', path });
        console.log(`${path} is replaced in history`)
    }
    else {
        history.pushState({ path }, null, path);
        historyTracker.push({ action: 'pushState', path });
        console.log(`${path} is pushed to history`)
    }
    //console.log('History Tracker:', JSON.stringify(historyTracker, null, 2)); // Log the history
    router();
}

// The clearURL() function removes query parameters from the URL 
// without reloading the page.
// Useful for cleaning up callback URLs (e.g., after OAuth authentication).

export function clearURL() {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
}

function homePage() {
    const contentArea = document.getElementById('content-area');
    const accessToken = localStorage.getItem('access_token');

    if (accessToken) {
        console.log('we have access token');
        navigateTo('/home');
    }
    else {
        console.log('we do not have access token..');
        navigateTo('/login');
    }
}


var baseUrl = "http://localhost"; // change (parse) later

// popstate: Ensures navigation works when the user uses the browser's 
// back or forward buttons.
// data-route Click Handling: Intercepts clicks on elements with the 
// data-route attribute and calls navigateTo() with the target route.

console.log('main.js is loaded');
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event triggered");

    window.addEventListener('popstate', router);

   
    // Event delegation for data-route attributes
    document.body.addEventListener('click', (event) => {
        const target = event.target;

        // Check if the clicked element has the 'data-route' attribute
        if (target && target.hasAttribute('data-route')) {
            const route = target.getAttribute('data-route');
            console.log(`a data rout clicked... ${route}`)
            navigateTo(route);
        }
    });

    console.log(history.state)
    router();
  
});