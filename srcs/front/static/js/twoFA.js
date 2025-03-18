import { makeAuthenticatedRequest } from "./login.js";
import { displayUpdatingMessage } from "./profile.js";
import { navigateTo, drawHeader} from "./main.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const userMgmtPort = window.env.USER_MGMT_PORT;

const display2FAMessage = (form, message, color) => {
    const twoFAForm = document.getElementById(form);
    if (!twoFAForm)
        return;

    const existingError = document.getElementById('two-fa-update-error');
    if (existingError)
        existingError.remove();

    const errorMessage = document.createElement('div');
    errorMessage.id = 'two-fa-update-error';
    errorMessage.style.color = color;
    errorMessage.style.marginBottom = '15px';
    errorMessage.textContent = message;

    twoFAForm.prepend(errorMessage); //adding at the top of the login container
    setTimeout(() => {
        if (errorMessage) errorMessage.remove();
    }, 2500);
};

export const loadLogin2FAPage = () => {
    const contentArea = document.getElementById("content-area");
    drawHeader('login').then(() => {
      return  fetch(baseUrl + userMgmtPort + "/api/2fa-login/", {method: "GET", credentials: "include" })

        .then(response => response.json())
        .then(data => {
            if (data.form_html) {
                console.log('2FA form html returned!');
                contentArea.innerHTML = data.form_html;
            }
        })
        .catch(error => console.log('Error loading 2FA login form:', error));
    })
}

export const enable2FA = () => {
    drawHeader('main').then(() => {
      return  makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/2fa/enable/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        })
    })
        .then(response => response ? response.json() : null)
        .then((data) => {
            if (data && data.success && data.setup_html) {
                document.getElementById('content-area').innerHTML = data.setup_html;
                document.getElementById("2fa-qr-code").src = `data:image/png;base64,${data.qr_code}`;
            } else {
                console.log("Error while enabling 2FA.")
            }
        })
        .catch((error) => console.log("Error enabling 2FA:", error));
};

export const disable2FA = () => {
    makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/2fa/disable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
        .then(response => response ? response.json() : null)
        .then((data) => {
            if (data && data.success) {
                console.log("2FA has been disabled.");
                navigateTo('/profile-settings', true);
            } else {
                console.log("Error while disabling 2FA.");
            }
        })
        .catch((error) => console.log("Error disabling 2FA:", error));
};

const  verify2FA = () => {
    const codeInput = document.getElementById("2fa-code");
    const code = codeInput.value;
    if (!code) {
        display2FAMessage("Please enter the verification code.", 'red');
        return;
    }

    makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/2fa/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
    })
        .then(response => response ? response.json() : null)
        .then((data) => {
            if (data && data.success) {
                console.log("2fa code CORRECT !!");
                navigateTo('/profile-settings', true);
                displayUpdatingMessage(data.message, 'green');
            } else {
                console.log("Invalid or expired 2fa code.");
                display2FAMessage('two-fa-form', data.error, 'red');
            }
        })
        .catch((error) => console.log("Error verifying 2FA:", error));    
};

const verify2FALogin = () => {
    const codeInput = document.getElementById("2fa-code");
    const code = codeInput.value;
    const temp_token = localStorage.getItem("temp_token");

    fetch(baseUrl + userMgmtPort + "/api/2fa-login/verify/", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ code: code, temp_token: temp_token }),
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.success) {
            console.log("2fa code CORRECT !!");
            localStorage.setItem('access_token', data.tokens.access);
            localStorage.setItem('refresh_token', data.tokens.refresh);
            localStorage.removeItem('temp_token');
            navigateTo('/home', true);
        } else {
            console.log("Invalid or expired 2fa code.");
            display2FAMessage('two-fa-login-form', data.message, 'red');
        }
    })
    .catch((error) => console.log("Error verifying 2FA:", error));
}

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    contentArea.addEventListener("submit", (event) => {
        if (event.target && event.target.id == "two-fa-form") {
            event.preventDefault();
            verify2FA();
        }
        if (event.target && event.target.id == "two-fa-login-form") {
            event.preventDefault();
            verify2FALogin();
        }
    });
});

