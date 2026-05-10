// DOM Elements
const qrText = document.getElementById("qrText");
const batchText = document.getElementById("batchText");
const scanInput = document.getElementById("scanInput");
const scanResult = document.getElementById("scanResult");
const fgColor = document.getElementById("fgColor");
const bgColor = document.getElementById("bgColor");
const qrSize = document.getElementById("qrSize");
const logoInput = document.getElementById("logoInput");
const fileName = document.getElementById("fileName");
const scanFileName = document.getElementById("scanFileName");
const generateBtn = document.getElementById("generateBtn");
const qrImage = document.getElementById("qrImage");
const resultBox = document.getElementById("resultBox");
const loader = document.getElementById("loader");
const downloadBtn = document.getElementById("downloadBtn");
const shareBtn = document.getElementById("shareBtn");
const historyGrid = document.getElementById("historyGrid");
const clearHistoryBtn = document.getElementById("clearHistory");
const tabBtns = document.querySelectorAll(".tab-btn");
const modeContents = document.querySelectorAll(".mode-content");
const startCameraBtn = document.getElementById("startCamera");
const cameraVideo = document.getElementById("cameraVideo");
const cameraPreview = document.getElementById("cameraPreviewContainer");

let history = JSON.parse(localStorage.getItem("qrHistory")) || [];
let selectedLogo = null;
let currentMode = "single";
let scanning = false;
let videoStream = null;

// Initialize
renderHistory();

// --- Mode Switching ---
tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        modeContents.forEach(c => c.classList.remove("active"));
        
        btn.classList.add("active");
        const mode = btn.getAttribute("data-mode");
        document.getElementById(`${mode}Mode`).classList.add("active");
        currentMode = mode;

        // Stop camera if leaving scan mode
        if (mode !== "scan") stopCamera();

        // Reset UI for mode
        resultBox.style.display = "none";
        generateBtn.style.display = mode === "scan" ? "none" : "flex";
        generateBtn.querySelector("span").innerText = mode === "batch" ? "Generate Batch ZIP" : "Generate QR Code";

        // Hide customization options in scan mode
        const customGrid = document.querySelector(".customization-grid");
        if (mode === "scan") {
            customGrid.style.display = "none";
        } else {
            customGrid.style.display = "grid";
        }
    };
});

// --- Logo Handling ---
logoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (event) => selectedLogo = event.target.result;
        reader.readAsDataURL(file);
    }
};

// --- Single & Batch Generation ---
async function handleGeneration() {
    if (currentMode === "single") {
        await generateSingle();
    } else if (currentMode === "batch") {
        await generateBatch();
    }
}

async function generateSingle() {
    const value = qrText.value.trim();
    if (!value) return showError(qrText);

    showLoader(true);
    const url = await createQRUrl(value);
    
    qrImage.onload = () => {
        showLoader(false);
        resultBox.style.display = "flex";
        addToHistory({ url: qrImage.src, text: value });
    };
    qrImage.src = url;
}

async function generateBatch() {
    const lines = batchText.value.split("\n").filter(l => l.trim() !== "");
    if (lines.length === 0) return showError(batchText);

    showLoader(true);
    const zip = new JSZip();
    const folder = zip.folder("qr-aura-batch");

    for (let i = 0; i < lines.length; i++) {
        const text = lines[i].trim();
        const url = await createQRUrl(text);
        
        // Convert dataURL to base64 for Zip
        const base64Data = url.split(",")[1];
        folder.file(`qr-${i + 1}.png`, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: "blob" });
    const zipUrl = URL.createObjectURL(content);
    
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = `qr-aura-batch-${Date.now()}.zip`;
    a.click();
    
    showLoader(false);
    showNotification(`Successfully generated ${lines.length} QR codes!`, "success");
}

// Helper to create customized QR (API + Logo Merge)
async function createQRUrl(text) {
    const size = parseInt(qrSize.value);
    const fg = fgColor.value.replace("#", "");
    const bg = bgColor.value.replace("#", "");
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${fg}&bgcolor=${bg}`;

    // Always use canvas to ensure a local DataURL for reliable downloads
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const qrImg = await loadImage(apiUrl);
    ctx.drawImage(qrImg, 0, 0, size, size);

    if (selectedLogo) {
        const logoImg = await loadImage(selectedLogo);
        const lSize = size * 0.2;
        const pos = (size - lSize) / 2;

        ctx.fillStyle = bgColor.value;
        ctx.fillRect(pos - 5, pos - 5, lSize + 10, lSize + 10);
        ctx.drawImage(logoImg, pos, pos, lSize, lSize);
    }

    return canvas.toDataURL("image/png");
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// --- Scanning Logic ---
scanInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    scanFileName.innerText = file.name;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const img = await loadImage(event.target.result);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            scanResult.innerHTML = `<div class="scan-success">
                <p>Scanned Content:</p>
                <a href="${code.data}" target="_blank">${code.data}</a>
            </div>`;
            showNotification("QR Code scanned successfully!", "success");
        } else {
            scanResult.innerHTML = `<p style="color: #ef4444;">Could not detect a QR code. Try a clearer image.</p>`;
            showNotification("No QR code found in image.", "error");
        }
    };
    reader.readAsDataURL(file);
};

// --- Live Camera Scanning ---
startCameraBtn.onclick = async () => {
    if (scanning) {
        stopCamera();
        return;
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        cameraVideo.srcObject = videoStream;
        cameraVideo.setAttribute("playsinline", true);
        cameraVideo.play();
        
        // Reset results UI
        scanResult.innerHTML = `<p class="scan-placeholder">Scanning in progress...</p>`;
        
        scanning = true;
        cameraPreview.style.display = "block";
        startCameraBtn.querySelector("span").innerText = "Stop Camera";
        
        // Wait a bit for the camera to focus before starting scanning loop
        setTimeout(() => {
            if (scanning) requestAnimationFrame(tick);
        }, 500);
    } catch (err) {
        showNotification("Camera permission denied or not available.", "error");
    }
};

function tick() {
    if (!scanning) return;

    if (cameraVideo.readyState === cameraVideo.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        
        // Clear and draw fresh frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        // Ensure we have actual data and it's not a false positive
        if (code && code.data && code.data.trim().length > 0) {
            scanResult.innerHTML = `<div class="scan-success">
                <p>Scanned Content:</p>
                <a href="${code.data}" target="_blank">${code.data}</a>
            </div>`;
            showNotification("QR Code detected!", "success");
            stopCamera();
            return;
        }
    }
    requestAnimationFrame(tick);
}

function stopCamera() {
    scanning = false;
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    cameraPreview.style.display = "none";
    startCameraBtn.querySelector("span").innerText = "Scan with Camera";
}

// --- Notifications (Sonner-style) ---
function showNotification(message, type = "success") {
    const container = document.getElementById("notificationContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = type === "success" 
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastFadeOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards";
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// --- Utils ---
function showLoader(show) {
    loader.style.display = show ? "block" : "none";
    qrImage.style.opacity = show ? "0.3" : "1";
    generateBtn.disabled = show;
}

function showError(el) {
    el.classList.add("error");
    setTimeout(() => el.classList.remove("error"), 1000);
}

function addToHistory(item) {
    if (history.find(h => h.text === item.text)) return;
    history.unshift(item);
    if (history.length > 5) history.pop();
    localStorage.setItem("qrHistory", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    historyGrid.innerHTML = "";
    if (history.length === 0) return document.getElementById("historySection").style.display = "none";
    document.getElementById("historySection").style.display = "block";
    history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `<img src="${item.url}" title="${item.text}">`;
        div.onclick = () => { qrText.value = item.text; generateSingle(); };
        historyGrid.appendChild(div);
    });
}

// Buttons
generateBtn.onclick = handleGeneration;
downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = qrImage.src;
    a.download = `qr-aura-${Date.now()}.png`;
    a.click();
};
clearHistoryBtn.onclick = () => {
    history = [];
    localStorage.removeItem("qrHistory");
    renderHistory();
};
