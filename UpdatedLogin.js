const API_BASE = window.location.origin;
let countdownInterval;

function toggleView(viewId) {
    clearMessages();
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
            userName, emailAddress, password, confirmPassword, role: "user",
        });
        toggleView("view-verify");
    } catch (error) {
        // FOR UI TESTING: Redirect anyway even if API fails
        console.warn("API Call Failed. Redirecting to verification for design test.");
        toggleView("view-verify");
    }
}

// Timer Logic
function startResendTimer() {
    const resendBtn = document.getElementById("resend-btn");
    const timerDisplay = document.getElementById("timer-display");
    let secondsLeft = 60;

    resendBtn.classList.add("hidden");
    timerDisplay.classList.remove("hidden");

    updateTimerDisplay(secondsLeft);

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay(secondsLeft);

        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            resendBtn.classList.remove("hidden");
            timerDisplay.classList.add("hidden");
        }
    }, 1000);
}

function updateTimerDisplay(seconds) {
    const timerDisplay = document.getElementById("timer-display");
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timerDisplay.textContent = `(Resend in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')})`;
}

async function handleVerify() {
    const inputs = document.querySelectorAll('.otp-input');
    const code = Array.from(inputs).map(i => i.value).join('');

    if (code.length < 6) {
        alert("Please enter the 6-digit code.");
        return;
    }
    window.location.href = "Home.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("careclickToken");
    if (token) {
        window.location.href = "Home.html";
        return;
    }

    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("signup-form").addEventListener("submit", handleSignup);

    // OTP auto-focus logic
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
});
