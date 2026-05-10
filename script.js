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

let history = JSON.parse(localStorage.getItem("qrHistory")) || [];
let selectedLogo = null;
let currentMode = "single";

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

        // Reset UI for mode
        resultBox.style.display = "none";
        generateBtn.style.display = mode === "scan" ? "none" : "flex";
        generateBtn.querySelector("span").innerText = mode === "batch" ? "Generate Batch ZIP" : "Generate QR Code";
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
    alert(`Successfully generated ${lines.length} QR codes!`);
}

// Helper to create customized QR (API + Logo Merge)
async function createQRUrl(text) {
    const size = parseInt(qrSize.value);
    const fg = fgColor.value.replace("#", "");
    const bg = bgColor.value.replace("#", "");
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${fg}&bgcolor=${bg}`;

    if (!selectedLogo) return apiUrl;

    // Merge logic
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const qrImg = await loadImage(apiUrl);
    ctx.drawImage(qrImg, 0, 0, size, size);

    const logoImg = await loadImage(selectedLogo);
    const lSize = size * 0.2;
    const pos = (size - lSize) / 2;

    ctx.fillStyle = bgColor.value;
    ctx.fillRect(pos - 5, pos - 5, lSize + 10, lSize + 10);
    ctx.drawImage(logoImg, pos, pos, lSize, lSize);

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
        } else {
            scanResult.innerHTML = `<p style="color: #ef4444;">Could not detect a QR code. Try a clearer image.</p>`;
        }
    };
    reader.readAsDataURL(file);
};

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
