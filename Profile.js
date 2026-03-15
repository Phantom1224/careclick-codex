/**
 * Navigation: Opens the main Messenger list
 */
const API_BASE = window.location.origin;
const TOKEN_KEY = "careclickToken";
const token = localStorage.getItem(TOKEN_KEY);

if (!token) {
    window.location.href = "Login.html";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...authHeaders(),
        },
    });

    let data = {};
    try {
        data = await response.json();
    } catch (_error) {
        data = {};
    }

    if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "Login.html";
        throw new Error("Session expired");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function setProfileDetails(user) {
    const nameEl = document.getElementById("profile-username");
    const emailEl = document.getElementById("profile-email");

    if (nameEl) {
        nameEl.textContent = user?.userName || "Unknown user";
    }

    if (emailEl) {
        emailEl.textContent = user?.emailAddress || "No email on file";
    }
}

async function loadProfile() {
    try {
        const data = await apiRequest("/api/users/me");
        setProfileDetails(data?.user);
    } catch (error) {
        console.error("Failed to load profile:", error.message);
    }
}
function openMessages() {
    hideAllViews();
    showElement('view-messenger');
    showElement('main-nav');
    showElement('brand-header');
    window.scrollTo(0, 0);
}

/**
 * Navigation: Opens the user Profile
 */
function openProfile() {
    hideAllViews();
    showElement('view-profile');
    showElement('main-nav');
    showElement('brand-header');
    window.scrollTo(0, 0);
}

/**
 * Navigation: Opens an individual chat with a specific user
 * @param {string} name - Name of the user to chat with
 */
function openChat(name) {
    hideAllViews();
    hideElement('main-nav');
    showElement('view-chat');
    
    // Update titles in both chat and call screens
    document.getElementById('chat-title').innerText = name;
    document.getElementById('call-name').innerText = name;
    
    window.scrollTo(0, 0);
}

/**
 * Navigation: Shows the full-screen call UI
 */
function startCall() {
    hideElement('view-chat');
    hideElement('brand-header');
    showElement('view-call');
}

/**
 * Navigation: Ends the call and returns to the chat view
 */
function endCall() {
    hideElement('view-call');
    showElement('brand-header');
    showElement('view-chat');
}

/* --- HELPER FUNCTIONS --- */

function hideAllViews() {
    const views = ['view-profile', 'view-messenger', 'view-chat', 'view-call'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
});
