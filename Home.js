const API_BASE = window.location.origin;
const TOKEN_KEY = "careclickToken";
const LOCATION_SYNC_MS = 2000;
const USER_MARKER_ICON_URL = "Icon/gps.png";

const token = localStorage.getItem(TOKEN_KEY);
let map = null;
let userMarker = null;
let locationWatchId = null;
let lastLocationSyncAt = 0;
let activeMarkers = [];
let customUserMarkerIconAvailable = null;
let customUserMarkerIconCheckPromise = null;

if (!token) {
    window.location.href = "Login.html";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

function setLocationLabel(text) {
    const locationEl = document.getElementById("live-location");
    if (locationEl) {
        locationEl.textContent = text;
    }
}

function formatCoordinates(lat, lng) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function clearSessionAndRedirect() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "Login.html";
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
        clearSessionAndRedirect();
        throw new Error("Session expired");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function initMap() {
    if (typeof L === "undefined") {
        return;
    }

    map = L.map("map", {
        zoomControl: false,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        tap: true,
    });

    map.setView([15.48, 120.976], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 15,
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
}

function checkCustomUserMarkerIconAvailability() {
    if (customUserMarkerIconAvailable !== null) {
        return Promise.resolve(customUserMarkerIconAvailable);
    }

    if (customUserMarkerIconCheckPromise) {
        return customUserMarkerIconCheckPromise;
    }

    customUserMarkerIconCheckPromise = new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            customUserMarkerIconAvailable = true;
            resolve(true);
        };

        img.onerror = () => {
            customUserMarkerIconAvailable = false;
            resolve(false);
        };

        img.src = USER_MARKER_ICON_URL;
    });

    return customUserMarkerIconCheckPromise;
}

function createDefaultUserMarker(coords) {
    return L.circleMarker(coords, {
        radius: 7,
        color: "#3b82f6",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
    }).addTo(map);
}

async function createUserMarker(coords) {
    const hasCustomIcon = await checkCustomUserMarkerIconAvailability();

    if (hasCustomIcon) {
        const userIcon = L.icon({
            iconUrl: USER_MARKER_ICON_URL,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36],
        });

        return L.marker(coords, { icon: userIcon }).addTo(map);
    }

    return createDefaultUserMarker(coords);
}

async function updateMapLocation(lat, lng) {
    if (!map) return;

    const coords = [lat, lng];

    if (!userMarker) {
        userMarker = await createUserMarker(coords);
    } else {
        if (typeof userMarker.setLatLng === "function") {
            userMarker.setLatLng(coords);
        }
    }

    map.panTo(coords, { animate: true, duration: 0.7 });
}

async function syncLocation(lat, lng) {
    const now = Date.now();
    if (now - lastLocationSyncAt < LOCATION_SYNC_MS) return;
    lastLocationSyncAt = now;

    try {
        await apiRequest("/api/users/me/location", {
            method: "PATCH",
            body: JSON.stringify({ lat, lng }),
        });
    } catch (error) {
        console.error("Location sync failed:", error.message);
    }
}

function handlePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    setLocationLabel(`Live: ${formatCoordinates(lat, lng)}`);
    updateMapLocation(lat, lng);
    syncLocation(lat, lng);
}

function handlePositionError(_error) {
    setLocationLabel("Location access denied");
}

function startLocationTracking() {
    if (!navigator.geolocation) {
        setLocationLabel("Geolocation unsupported");
        return;
    }

    locationWatchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
    });
}

async function loadCurrentUser() {
    try {
        const data = await apiRequest("/api/users/me");
        const userLocation = data?.user?.userLocation;
        if (Number.isFinite(userLocation?.lat) && Number.isFinite(userLocation?.lng)) {
            setLocationLabel(`Last known: ${formatCoordinates(userLocation.lat, userLocation.lng)}`);
            updateMapLocation(userLocation.lat, userLocation.lng);
        } else {
            setLocationLabel("Locating...");
        }
    } catch (error) {
        console.error("Failed to load profile:", error.message);
    }
}

function requestHelp() {
    hideElement("sos-btn");
    showElement("request-panel");

    setTimeout(() => {
        const panel = document.getElementById("request-panel");
        if (!panel.classList.contains("hidden")) {
            showLocation();
        }
    }, 2000);
}

function showLocation() {
    hideElement("request-panel");
    showElement("location-panel");

    const locations = [[120.962, 15.482], [120.958, 15.478]];
    locations.forEach((coord) => {
        const marker = L.circleMarker([coord[1], coord[0]], {
            radius: 7,
            color: "#82d14d",
            weight: 2,
            fillColor: "#82d14d",
            fillOpacity: 0.9,
        }).addTo(map);
        activeMarkers.push(marker);
    });
}

function cancelRequest() {
    resetHome();
}

function receiveIncomingRequest() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    hideElement("sos-btn");
    showElement("incoming-modal");
}

function closeModal() {
    hideElement("incoming-modal");
    showElement("sos-btn");
}

function acceptHelp() {
    alert("Help Accepted! Navigating to user...");
    closeModal();
}

function resetHome() {
    hideElement("request-panel");
    hideElement("location-panel");
    hideElement("incoming-modal");
    showElement("sos-btn");

    activeMarkers.forEach((m) => m.remove());
    activeMarkers = [];

    setTimeout(() => {
        receiveIncomingRequest();
    }, 3000);
}

function hideElement(id) {
    document.getElementById(id).classList.add("hidden");
}

function showElement(id) {
    document.getElementById(id).classList.remove("hidden");
}

function openSearch() {
    alert("Search button clicked!");
}

function goHome() {
    alert("Home button clicked!");
}

window.requestHelp = requestHelp;
window.cancelRequest = cancelRequest;
window.closeModal = closeModal;
window.acceptHelp = acceptHelp;
window.resetHome = resetHome;
window.openSearch = openSearch;
window.goHome = goHome;

document.addEventListener("DOMContentLoaded", async () => {
    initMap();
    await loadCurrentUser();
    startLocationTracking();
});

window.addEventListener("beforeunload", () => {
    if (locationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
});
