function toggleVisibility(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

document.getElementById('reset-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;
    const errorMsg = document.getElementById('error-message');

    if (newPass !== confirmPass) {
        errorMsg.textContent = "Passwords do not match. Please try again.";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (newPass.length < 8) {
        errorMsg.textContent = "Password must be at least 8 characters long.";
        errorMsg.classList.remove('hidden');
        return;
    }

    // Success simulation
    alert("Password updated successfully!");
    window.location.href = "Login.html";
});
