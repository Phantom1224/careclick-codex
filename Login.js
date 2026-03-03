const API_BASE = window.location.origin;
let countdownInterval = null;
let pendingSignupEmail = "";
const OTP_RESEND_SECONDS = 60;

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
    ["login-message", "signup-message", "forgot-message", "verify-message"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add("hidden");
        el.classList.remove("error");
        el.textContent = "";
    });
}

function setOtpInputsDisabled(isDisabled) {
    document.querySelectorAll(".otp-input").forEach((input) => {
        input.disabled = isDisabled;
    });
}

function clearOtpInputs() {
    const inputs = document.querySelectorAll(".otp-input");
    inputs.forEach((input) => {
        input.value = "";
    });
    if (inputs[0]) {
        inputs[0].focus();
    }
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
        await requestJson("/api/auth/signup/request-code", {
            userName,
            emailAddress,
            password,
            confirmPassword,
        });

        pendingSignupEmail = emailAddress;
        setOtpInputsDisabled(false);
        clearOtpInputs();
        toggleView("view-verify");
        setMessage("verify-message", "Verification code sent. Check your email.");
        startResendTimer();
    } catch (error) {
        setMessage("signup-message", error.message, true);
    }
}

function updateTimerDisplay(seconds) {
    const timerDisplay = document.getElementById("timer-display");
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timerDisplay.textContent = `(Resend in ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")})`;
}

function startResendTimer() {
    const resendBtn = document.getElementById("resend-btn");
    const timerDisplay = document.getElementById("timer-display");
    let secondsLeft = OTP_RESEND_SECONDS;

    resendBtn.classList.add("hidden");
    timerDisplay.classList.remove("hidden");
    updateTimerDisplay(secondsLeft);

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        secondsLeft -= 1;
        updateTimerDisplay(secondsLeft);

        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            resendBtn.classList.remove("hidden");
            timerDisplay.classList.add("hidden");
        }
    }, 1000);
}

async function handleResendCode() {
    clearMessages();

    if (!pendingSignupEmail) {
        setMessage("verify-message", "No pending signup found. Please sign up again.", true);
        return;
    }

    try {
        await requestJson("/api/auth/signup/resend-code", { emailAddress: pendingSignupEmail });
        setMessage("verify-message", "A new code has been sent.");
        clearOtpInputs();
        startResendTimer();
    } catch (error) {
        setMessage("verify-message", error.message, true);
    }
}

async function handleVerify() {
    clearMessages();

    if (!pendingSignupEmail) {
        setMessage("verify-message", "No pending signup found. Please sign up again.", true);
        toggleView("view-signup");
        return;
    }

    const inputs = document.querySelectorAll(".otp-input");
    const code = Array.from(inputs).map((i) => i.value).join("");

    if (!/^\d{6}$/.test(code)) {
        setMessage("verify-message", "Please enter a valid 6-digit code.", true);
        return;
    }

    try {
        const data = await requestJson("/api/auth/signup/verify-code", {
            emailAddress: pendingSignupEmail,
            code,
        });

        localStorage.setItem("careclickToken", data.token);
        pendingSignupEmail = "";
        window.location.href = "Home.html";
    } catch (error) {
        setMessage("verify-message", error.message, true);
    }
}

function handleForgotPassword(event) {
    event.preventDefault();
    clearMessages();
    setMessage("forgot-message", "Reset flow is not connected yet.");
}

function setupOtpInputBehavior() {
    const otpInputs = document.querySelectorAll(".otp-input");
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", (event) => {
            const cleanedValue = event.target.value.replace(/\D/g, "");
            event.target.value = cleanedValue.slice(0, 1);
            if (event.target.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Backspace" && !event.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("careclickToken");
    if (token) {
        window.location.href = "Home.html";
        return;
    }

    setOtpInputsDisabled(false);
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("signup-form").addEventListener("submit", handleSignup);
    document.getElementById("forgot-form").addEventListener("submit", handleForgotPassword);
    setupOtpInputBehavior();
});

window.handleVerify = handleVerify;
window.handleResendCode = handleResendCode;
