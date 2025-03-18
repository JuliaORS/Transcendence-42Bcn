import { makeAuthenticatedRequest } from "./login.js";
import { drawHeader } from "./main.js";
import { getDictFor3DGame } from "./game.js";

const host = window.env.HOST;
const protocolWeb = window.env.PROTOCOL_WEB
const baseUrl = protocolWeb + "://" + host + ":";  
const userMgmtPort = window.env.USER_MGMT_PORT;

let dict = null;

export const loadFriendsSearchPage = async () => {
    dict = await getDictFor3DGame();
    drawHeader('main').then(() => {
       return  makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/search-users", {method: "GET", credentials: "include"})
            .then(response => response ? response.json() : null)
            .then(data => {
                if (data && data.search_users_html) {
                    document.getElementById('content-area').innerHTML = data.search_users_html;
                } else {
                    // console.log('Error fetching friends search:', data.error);
                }
            })
            .catch(error => {
                // console.log('Error fetching friends search:', error);
            });

        })
};

const performSearch = () => {
    const searchInput = document.getElementById("search-input");
    const query = searchInput.value.trim();
    // console.log('query:', query);

    if (query) {
        makeAuthenticatedRequest(baseUrl + userMgmtPort + "/api/search-users/?q=" + encodeURIComponent(query), {method: "GET"})
            .then(response => response ? response.json() : null)
            .then(data => {
                if (data && data.search_users_html) {
                    document.getElementById('content-area').innerHTML = data.search_users_html;
                } else {
                    // console.log('Error fetching friends search:', data.error);
                }
            })
            .catch(error => {
                // console.log('Error fetching friends search:', error);
            });
    }
};

const addFriend = (friendId) => {
    makeAuthenticatedRequest(baseUrl + userMgmtPort + `/api/add-friend/${friendId}/`, {method: "POST"})
        .then(response => response ? response.json() : null)
        .then(data => {
            if (data && data.status == "success") {
                const button = document.querySelector(`#add-friend-button[data-id="${friendId}"]`);
                if (button) {
                    button.textContent = dict['remove_friend'] || 'Remove Friend';
                    button.id = 'remove-friend-button';
                    button.classList.remove('btn-success');
                    button.classList.add('btn-danger');
                }

                const friendsSection = document.querySelector("#friends-section");
                let friendsList = friendsSection.querySelector("ul");
                if (!friendsList) {
                    friendsList = document.createElement("ul");
                    friendsSection.appendChild(friendsList);
                    const noFriendsMessage = friendsSection.querySelector("p");
                    if (noFriendsMessage) {
                        noFriendsMessage.remove();
                    }
                }
                
                const newFriendItem = document.createElement("li");
                newFriendItem.id = "friend-item";
                newFriendItem.setAttribute("data-id", friendId);
                
                newFriendItem.innerHTML = `
                    <img src="${ data.friend.photo_url }" alt="Profile Photo" class="friend-photo">
                    <div class="user-info">
                        ${data.friend.username}
                        ${data.friend.email ? `(${data.friend.email})` : ""}
                    </div>
                    <span class="d-flex align-items-center ms-3 me-3">
                        <span class="status-dot me-1 ${data.friend.online_status ? 'status-online' : 'status-offline'}"></span>
                        <span>${data.friend.online_status ? 'Online' : 'Offline'}</span>
                    </span>
                `;
                friendsSection.appendChild(newFriendItem);
            }
        })
        .catch(error => {
            // console.log('Error adding friend:', error.message || error);
        });
};

const removeFriend = (friendId) => {
    makeAuthenticatedRequest(baseUrl + userMgmtPort + `/api/remove-friend/${friendId}/`, {method: "POST"})
        .then(response => response ? response.json() : null)
        .then(data => {
            if (data && data.status == "success") {
                const button = document.querySelector(`#remove-friend-button[data-id="${friendId}"]`);
                if (button) {
                    button.textContent = dict['add_friend'] || 'Add Friend';
                    button.id = 'add-friend-button';
                    button.classList.remove('btn-danger');
                    button.classList.add('btn-success');
                }

                const friendItem = document.querySelector(`#friend-item[data-id="${friendId}"]`);
                if (friendItem) {
                    friendItem.remove();
                }
            }
        })
        .catch(error => {
            // console.log('Error removing friend:', error.message || error);
        });
};

document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    contentArea.addEventListener("click", (event) => {
        // if (event.target && event.target.id == "friends-button") {
        //     loadFriendsSearchPage();
        // }
        if (event.target && event.target.id == "submit-search") {
            event.preventDefault();
            performSearch();
        }
        if (event.target && event.target.id == "add-friend-button") {
            addFriend(event.target.getAttribute('data-id'));
        }
        if (event.target && event.target.id == "remove-friend-button") {
            removeFriend(event.target.getAttribute('data-id'));
        }
        // if (event.target && event.target.id == "back-to-profile-button") {
        //     loadProfilePage();
        // }
    });
});