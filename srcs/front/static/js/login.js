import { navigateTo, drawHeader } from "./main.js";
import { updateLanguage, getCookie } from "./langs.js";
import { connectWS, disconnectWS } from "./onlineStatus.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const userMgmtPort = window.env.USER_MGMT_PORT;


function handleInvalidToken() {
    localStorage.clear();
    window.history.replaceState(null, null, '/');
    disconnectWS();
    navigateTo('/login', true);
}

export async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
        // console.log("No refresh token found. User needs to log in again.");
        handleInvalidToken();
        return Promise.reject("No refresh token available");
    }

    try {
        const response = await fetch(baseUrl + userMgmtPort + "/api/token/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        if (response.status === 401) {
            // console.log("Refresh token is invalid or expired. Logging out...");
            handleInvalidToken();
            return Promise.reject("Refresh token expired");
        }

        if (!response.ok) {
            // console.log("Unexpected error during token refresh:", response.statusText);
            handleInvalidToken();
            return Promise.reject("Unexpected refresh error");
        }

        const data = await response.json();

        if (data.access) {
            localStorage.setItem("access_token", data.access);
            if (data.refresh) {
                localStorage.setItem("refresh_token", data.refresh);
            }
            return data.access;
        }
    } catch (error) {
        // console.log("Error during token refresh:", error);
        handleInvalidToken();
        return Promise.reject(error);
    }
};

export const makeAuthenticatedRequest = async (url, options = {}) => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        // console.log("No access token available.");
        localStorage.clear();
        disconnectWS();
        navigateTo('/login', true);
        return null;
    }
    // console.log(url);
    options = {
        ...options,
        headers: {
            ...options.headers,
            "Authorization": `Bearer ${accessToken}`, // adding authorization header with the access token
        },
        credentials: "include",
    };
    try {
        let response = await fetch(url, options);

        if (!response)
            return null;
        if (response.status === 401 || response.status === 403) {
            // console.log("Access token expired, attempting refresh..");
            const newAccessToken = await refreshAccessToken();
            if (!newAccessToken) {
                // console.log("Failed to refresh access token.");
                localStorage.clear();
                navigateTo('/login', true);
                return null;
            }
            options.headers["Authorization"] = `Bearer ${newAccessToken}`;
            return fetch(url, options); // Retry original request once
        }
        return response;

    } catch (error) {
        // console.log("Fetch error:", error);
        return null;
    }
};

export const loadLoginPage = () => {
    drawHeader('login').then(() => {
        return fetch(baseUrl + userMgmtPort + "/api/login-form/", {
            method: 'GET',
            credentials: "include"
        });
    })
    .then((response) => response.json())
    .then(data => {
        if (data.form_html) {
            document.getElementById('content-area').innerHTML = data.form_html;
        } else {
            // console.log('Form HTML not found in response:', data);
        }
    })
    .catch(error => {
        // console.log('Error loading page', error);
    });
};

export const handleLogin = async () => {
    const loginForm = document.getElementById('login-form');
    const formData = new FormData(loginForm);
    const dataToSend = JSON.stringify(Object.fromEntries(formData));
    try {
        const response = await fetch(baseUrl + userMgmtPort + "/api/login/", {
            method: 'POST',
            body: dataToSend,
            credentials: "include",
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            if (data.two_fa_required) {
                localStorage.setItem('temp_token', data.temp_token);
                navigateTo('/two-fa-login');
            } else {
                localStorage.setItem('access_token', data.tokens.access);
                localStorage.setItem('refresh_token', data.tokens.refresh);
                await updateLanguage(); 
                await connectWS(data.tokens.access);
                navigateTo('/home');
            }
        } else {
            if (data.message)
                displayLoginError('login-form', data.message);
        }
    } catch (error) {
        // console.log('Error logging in:', error);

    }
};

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    contentArea.addEventListener("click", (event) => {
        if (event.target && event.target.id == "login-submit") {
            handleLogin();
        }
    });
});

export const loadSignupPage = () => {
    drawHeader('login').then(() => {
        return fetch(baseUrl + userMgmtPort + "/api/signup-form/", {
            method: 'GET',
            credentials: "include"
        });
    })
    .then((response) => response.json())
    .then(data => {
        if (data.form_html) {
            document.getElementById('content-area').innerHTML = data.form_html;
        } else {
            // console.log('Form HTML not found in response:', data);
        }
    })
    .catch(error => {
        // console.log('Error loading page', error);
    });
};

export const handleSignup = async () => {
    const signupForm = document.getElementById('signup-form');
    const formData = new FormData(signupForm);

    fetch(baseUrl + userMgmtPort + "/api/register/", {
        method: 'POST',
        credentials: "include",
        body: JSON.stringify(Object.fromEntries(formData)),
        headers: { 'Content-Type': 'application/json'}
    })
    .then(response => response.json())
    .then(async (signupData) => {
        if (signupData.success) {
            localStorage.setItem('access_token', signupData.tokens.access);
            localStorage.setItem('refresh_token', signupData.tokens.refresh);
            let lang = getCookie("language");
            await updateLanguage(lang);
            await connectWS(signupData.tokens.access);
            navigateTo('/home');
        } else {
            displayLoginError('signup-form', `${signupData.error}`);
        }
    })
    .catch(error => {
        // console.log('Error submitting signup form:', error);
        navigateTo('signup', true)
    });
};

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    contentArea.addEventListener("click", (event) => {
        if (event.target && event.target.id == "signup-submit") {
            handleSignup();
        }
    });
});

export const displayLoginError = (form, errorMessage) => {
    const login_error = document.getElementById('login-error');
    if (!login_error)
        return;

    login_error.innerText = errorMessage;

    login_error.classList.add('show');
    setTimeout(() => {
        login_error.classList.remove('show');
      }, 2500);
    
    const loginForm = document.getElementById(form);
    if (loginForm) {
        loginForm.reset();
    }
};
