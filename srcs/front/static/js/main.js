import { loadLoginPage, handleLogin, handleSignup } from "./login.js";
import { loadProfilePage, loadProfileSettingsPage, loadMatchHistoryPage } from "./profile.js";
import { handleLoginIntra, handle42Callback } from "./42auth.js";
import { loadHomePage } from "./home.js";
import { loadFriendsSearchPage } from "./friends.js"
import { handleLogout } from "./logout.js"
import { loadLogin2FAPage, enable2FA, disable2FA } from "./twoFA.js";
import { playLocal, playAI, playOnline, gameLocal } from "./game.js"
import { loadTournamentHomePage, loadJoinTournamentPage, createTournament, handleJoinTournament, loadBracketTournamentPage, loadWaitingRoomPage } from "./tournament.js";
// import { gameLocal } from "./localGame.js"

const historyTracker = [];

// The routes object maps URL paths to their respective handler functions:
// Each key is a path (e.g., /, /profile).
// Each value is a function that handles what should happen when the app navigates to that path.

const routes = {
    '/': homePage,
    '/login': loadLoginPage,
    '/handle-login': handleLogin,
    '/signup': handleSignup,
    '/login-intra': handleLoginIntra, 
    '/callback': handle42Callback,
    '/two-fa-login': loadLogin2FAPage,
    '/home': loadHomePage,
    '/profile': loadProfilePage,
    '/profile-settings': loadProfileSettingsPage,
    '/two-fa-setup': enable2FA,
    '/two-fa-disable': disable2FA,
    '/friends': loadFriendsSearchPage,
    '/match-history': loadMatchHistoryPage,
    '/logout': handleLogout,
    '/settings': loadProfileSettingsPage,
    '/play-local': playLocal,
    '/play-ai': playAI,
    '/play-online': playOnline,
    '/play-local/game': gameLocal,
    '/tournament': loadTournamentHomePage,
    '/create-tournament': createTournament,
    '/join-tournament-page': loadJoinTournamentPage,
    '/waiting-room': loadWaitingRoomPage,
    '/waiting-room-joinner': handleJoinTournament,

    '/tournament-bracket': loadBracketTournamentPage,

    // EXAMPLE how to announce a function that receives parameters:
    // '/login': (args) => loadLoginPage(args),
};


// The router() function determines which handler function to call 
// based on the current path (window.location.pathname).
// If the path exists in the routes object, its associated function is executed.

function router(args=null) {
    let path = window.location.pathname;

    if (routes[path]) {
        routes[path](args); // Call the function associated with the path
    } else {
        alert("path doesn't exists");
        console.log(`Route ${path} not handled`);
        // showNotFound(); // Handle unknown routes
    }
}

// function showNotFound() {
//     console.log("Rendering 404 Page");
//     contentArea.innerHTML = `
//         <div>
//             <h1>404 - Page Not Found</h1>
//             <p>The requested page does not exist.</p>
//         </div>
//     `;
// }

// The navigateTo() function is responsible for programmatically changing 
// the browser's history and triggering the router.
// history.pushState(): Adds a new entry to the browser's history stack and 
// changes the URL in the address bar.
// history.replaceState(): Updates the current history entry instead of 
// creating a new one.
// After modifying the browser's history, router() is called to render the appropriate page.
// Additionally, a historyTracker array is maintained for debugging, which logs every navigation event 
// (pushState or replaceState).

export function navigateTo(path, replace = false, args=null) {
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
    router(args);
}

// The clearURL() function removes query parameters from the URL 
// without reloading the page.
// Useful for cleaning up callback URLs (e.g., after OAuth authentication).

export function clearURL() {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
}

export function checkPermission () {
    console.log(`Permissions: checking permissions`);
    const accessToken = localStorage.getItem('access_token');

    if (!accessToken) {
        console.log(`Permissions: No access token, permission denied`);
        return false;
    }
    console.log(`Permissions: We have access token, congrats!`);
    return true;
}

function homePage() {
    const contentArea = document.getElementById('content-area');
    
    if (checkPermission ()) {
        navigateTo('/home');
    }
    else {
        // console.log('we do not have access token..');
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
            console.log(`Type is ${target.type}, tag is ${target.tagName}`)

            if (target.tagName === 'BUTTON' && target.type === 'submit') {
                console.log(`An event is prevented!  ${route}`)
                event.preventDefault();
            }

            const shouldModifyURL = !target.hasAttribute('not-modify-url');

            navigateTo(route, shouldModifyURL);
        }
    });

    console.log(history.state)
    router();
  
});
