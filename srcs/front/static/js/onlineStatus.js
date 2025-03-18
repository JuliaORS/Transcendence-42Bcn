import { handleLogout } from "./logout.js";
import { refreshAccessToken } from "./login.js";
// import jwtDecode from 'jwt-decode';

const host = window.env.HOST;
const userMgmtPort = window.env.USER_MGMT_PORT;
const protocolSocket = window.env.PROTOCOL_SOCKET;
let intentionalDisconnect = false;

export function isTokenExpired(token) {
    try {
        const decoded = jwt_decode(token);
        // Ensure the token has an expiration field
        // console.log(`DEcoded token: `, decoded);
        if (!decoded.exp) {
            console.log("Token missing expiration claim");
            return true;
        }
      // JWT 'exp' is usually in seconds, so compare against Date.now() in milliseconds.
        return Date.now() >= decoded.exp * 1000;
    } catch (error) {
      // If token is invalid or cannot be decoded, treat it as expired.
        console.log(`Token is damaged or invalid: ${ error}`);
        return true;
    }
}

export async function checkToken(token) {
    // console.log(`111Trying to check token for token access`);
    if (!token) {
        // console.log("No access token found");
        return null;
    }
    if (isTokenExpired(token)) {
        // Refresh the token here...
        console.log("Token is expired");
        try {
            token = await refreshAccessToken();
            console.log(`in check Tokenaccess: ${token}`);
            return token;
        } catch (err) {
            console.log("Failed to refresh token", err);
            return null;
        }
    }
    return (token);
}

export var socket = null;
let off = false;

export async function connectWS(access_token)
{
    // console.log("Online status Checking token");
    access_token = await checkToken(access_token);
    if (!access_token) {
        // console.log("Online status No access token found");
        return ;
    }

    const options = {
        debug: false, // turns off default logging if available
      };

    try {
        socket = new WebSocket(`${protocolSocket}://${host}:${userMgmtPort}/${protocolSocket}/online-status/?token=${access_token}`, [], options);
    } catch (err) {
        console.warn('WebSocket Problem: ', err);
    }
        socket.onclose = async (event) => {

        console.log('WebSocket Disconnected. ');
        access_token = localStorage.getItem('access_token');
        // if (event.code === 4001) {
		// 	// Token expired; refresh token logic
		// 	try {
		// 		access_token = await refreshAccessToken();
		// 	  // Reconnect with the new token
        //         // await connectWS(tok);
		// 	} catch (err) {
		// 	    console.log("Failed to refresh token", err);
        //         return ;
		// 	}
		// }

        if (access_token && !off) {
            off = true;
            setTimeout(() => connectWS(access_token), 1000); // Retry after 1 second
            console.log('Reconnecting...');
        }
    };
    
    socket.onopen = function(event) {
        if (off === true)
            off = false;
        // console.log(`WebSocket Connected! Socket: ${socket}`);
    };
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('Online Friends:', data.online_friends);
    };
    
    socket.onerror = function(error) {
        console.log('WebSocket Error:', error);   
    };
}


export function disconnectWS() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        intentionalDisconnect = true;
        socket.close();
        socket = null;
    }
}