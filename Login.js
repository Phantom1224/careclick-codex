const API_BASE = window.location.origin;

function toggleView(viewId) {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => card.classList.add("hidden"));

    const activeCard = document.getElementById(viewId);
    if (activeCard) {
        activeCard.classList.remove("hidden");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMessage(messageId, message, isError = false) {
    const el = document.getElementById(messageId);
    if (!el) return;

    el.textContent = message;
    el.classList.remove("hidden");
    el.classList.toggle("error", isError);
}

function clearMessages() {
    ["login-message", "signup-message", "forgot-message"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add("hidden");
        el.classList.remove("error");
        el.textContent = "";
    });
}

async function requestJson(path, payload) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    let data = {};
    try {
        data = await response.json();
    } catch (_error) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

async function handleLogin(event) {
    event.preventDefault();
    clearMessages();

    const emailAddress = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;

    if (!emailAddress || !password) {
        setMessage("login-message", "Email and password are required.", true);
        return;
    }

    try {
        const data = await requestJson("/api/auth/login", { emailAddress, password });
        localStorage.setItem("careclickToken", data.token);
        window.location.href = "Home.html";
    } catch (error) {
        setMessage("login-message", error.message, true);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    clearMessages();

    const userName = document.getElementById("signup-name").value.trim();
    const emailAddress = document.getElementById("signup-email").value.trim().toLowerCase();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;

    if (!userName || !emailAddress || !password || !confirmPassword) {
        setMessage("signup-message", "All fields are required.", true);
        return;
    }

    if (password !== confirmPassword) {
        setMessage("signup-message", "Passwords do not match.", true);
        return;
    }

    try {
        await requestJson("/api/auth/signup", {
            userName,
            emailAddress,
            password,
            confirmPassword,
            role: "user",
        });

        document.getElementById("login-email").value = emailAddress;
        setMessage("login-message", "Signup successful. Please log in.");
        toggleView("view-login");
    } catch (error) {
        setMessage("signup-message", error.message, true);
    }
}

function handleForgotPassword(event) {
    event.preventDefault();
    clearMessages();
    setMessage("forgot-message", "Reset flow is not connected yet.");
}

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("careclickToken");
    if (token) {
        window.location.href = "Home.html";
        return;
    }

    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("signup-form").addEventListener("submit", handleSignup);
    document.getElementById("forgot-form").addEventListener("submit", handleForgotPassword);
});
