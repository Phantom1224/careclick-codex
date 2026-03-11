/**
 * Navigation: Opens the main Messenger list
 */
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