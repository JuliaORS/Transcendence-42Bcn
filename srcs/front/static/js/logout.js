import { loadLoginPage } from "./login.js";
import { cleanupGames, navigateTo } from "./main.js";
import { disconnectTournamentWS } from "./tournament.js";
import { disconnectWS } from "./onlineStatus.js"

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const userMgmtPort = window.env.USER_MGMT_PORT;

export const handleLogout = () => {
    const contentArea = document.getElementById("content-area");
    // console.log('Logging out..');
    const refreshToken = localStorage.getItem('refresh_token');
    // const accessToken = localStorage.getItem('access_token');

    if (refreshToken) {
        fetch(baseUrl + userMgmtPort + "/api/logout/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({refresh_token: refreshToken}),
        })
        .then((response) => {
            if (response.ok) {
                // console.log('Backend logout successful');
            }
        })
        .catch((error) => {
            // console.log('Error logging out: ', error);
        });
    }

    disconnectTournamentWS();
    cleanupGames();
    disconnectWS()
    // console.log("WebSocket closed upon logout.");

    localStorage.clear();
    // localStorage.removeItem('access_token');
    // localStorage.removeItem('refresh_token');
    // localStorage.removeItem('inTournament');
    // localStorage.removeItem('currentTournamentId');
    // localStorage.removeItem('intra_token');
    // localStorage.setItem("3D-option", "false")

    //contentArea.innerHTML = ''; // to clear user content
    window.history.replaceState(null, null, '/'); // ????
    navigateTo('/login', true);
};

// ADD DATA-ROUTE INSTEAD
// export const addLogoutListener = () => {
//     const logoutButton = document.getElementById('logout-button');
//     if (logoutButton) {
//         logoutButton.addEventListener('click', handleLogout);
//     }
// };