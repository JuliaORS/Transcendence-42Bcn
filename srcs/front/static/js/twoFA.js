import { makeAuthenticatedRequest } from "./login.js";

var baseUrl = "http://localhost"; // change (parse) later

const enable2FA = () => {
    const setupContainer = document.getElementById("2fa-setup-container");
    const qrCode = document.getElementById("2fa-qr-code");

    makeAuthenticatedRequest(baseUrl + ":8000/api/2fa/enable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                setupContainer.style.display = "block";
                qrCode.src = `data:image/png;base64,${data.qr_code}`;
            } else {
                console.log("code is wrong");
                alert(data.error || "Failed to enable 2FA.");
                e.target.checked = false;
            }
        })
        .catch((error) => console.error("Error enabling 2FA:", error));
};

const verify2FA = () => {
    const setupContainer = document.getElementById("2fa-setup-container");
    const codeInput = document.getElementById("2fa-code");
    const code = codeInput.value;
    if (!code) {
        alert("Please enter the verification code.");
    }

    makeAuthenticatedRequest("http://localhost:8000/api/2fa/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert(data.message || "2FA enabled successfully!");
                setupContainer.style.display = "none";
            } else {
                alert(data.error || "Failed to verify 2FA.");
            }
        })
        .catch((error) => console.error("Error verifying 2FA:", error));
};

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    contentArea.addEventListener("change", (event) => {
        if (event.target && event.target.id == "2fa-toggle") {
            if (event.target.checked) {
                enable2FA();
            }
        }
    });
    contentArea.addEventListener("click", (event) => {
        if (event.target && event.target.id == "verify-2fa-button") {
            verify2FA();
        }
    });
});