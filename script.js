const qrText = document.getElementById("qrText");
const fgColor = document.getElementById("fgColor");
const bgColor = document.getElementById("bgColor");
const qrSize = document.getElementById("qrSize");
const logoInput = document.getElementById("logoInput");
const fileName = document.getElementById("fileName");
const generateBtn = document.getElementById("generateBtn");
const qrImage = document.getElementById("qrImage");
const resultBox = document.getElementById("resultBox");
const loader = document.getElementById("loader");
const downloadBtn = document.getElementById("downloadBtn");
const shareBtn = document.getElementById("shareBtn");
const historyGrid = document.getElementById("historyGrid");
const clearHistoryBtn = document.getElementById("clearHistory");

let history = JSON.parse(localStorage.getItem("qrHistory")) || [];
let selectedLogo = null;

// Initialize history on load
renderHistory();

// Handle logo selection
logoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedLogo = event.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        fileName.innerText = "No file chosen";
        selectedLogo = null;
    }
};

async function generateQR() {
    const value = qrText.value.trim();
    
    if (value.length === 0) {
        qrText.classList.add("error");
        setTimeout(() => qrText.classList.remove("error"), 1000);
        return;
    }

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.querySelector('span').innerText = "Generating Aura...";
    loader.style.display = "block";
    qrImage.style.opacity = "0.3";
    resultBox.style.display = "flex";

    const foreground = fgColor.value.replace("#", "");
    const background = bgColor.value.replace("#", "");
    const size = parseInt(qrSize.value);

    // Use the QR Server API
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=${foreground}&bgcolor=${background}`;
    
    try {
        const qrImgElement = new Image();
        qrImgElement.crossOrigin = "anonymous"; // Essential for canvas manipulation
        
        await new Promise((resolve, reject) => {
            qrImgElement.onload = resolve;
            qrImgElement.onerror = reject;
            qrImgElement.src = apiUrl;
        });

        if (selectedLogo) {
            // Create canvas to merge
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Draw QR code
            ctx.drawImage(qrImgElement, 0, 0, size, size);

            // Draw Logo in center
            const logoImg = new Image();
            await new Promise((resolve, reject) => {
                logoImg.onload = resolve;
                logoImg.onerror = reject;
                logoImg.src = selectedLogo;
            });

            const logoSize = size * 0.2; // 20% of QR size
            const x = (size - logoSize) / 2;
            const y = (size - logoSize) / 2;

            // White background for logo to ensure scannability
            ctx.fillStyle = bgColor.value;
            ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);
            
            ctx.drawImage(logoImg, x, y, logoSize, logoSize);
            
            qrImage.src = canvas.toDataURL("image/png");
        } else {
            qrImage.src = apiUrl;
        }

        // Success state
        qrImage.style.opacity = "1";
        loader.style.display = "none";
        generateBtn.disabled = false;
        generateBtn.querySelector('span').innerText = "Generate QR Code";

        // Add to history
        addToHistory({ url: qrImage.src, text: value });

    } catch (error) {
        console.error("Failed to generate QR code", error);
        alert("Something went wrong. Please try again.");
        generateBtn.disabled = false;
        generateBtn.querySelector('span').innerText = "Generate QR Code";
    }
}

function addToHistory(item) {
    if (history.find(h => h.text === item.text && h.url === item.url)) return;

    history.unshift(item);
    if (history.length > 5) history.pop();

    localStorage.setItem("qrHistory", JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    historyGrid.innerHTML = "";
    if (history.length === 0) {
        document.getElementById("historySection").style.display = "none";
        return;
    }

    document.getElementById("historySection").style.display = "block";
    
    history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `<img src="${item.url}" alt="${item.text}" title="${item.text}">`;
        div.onclick = () => {
            qrText.value = item.text;
            // Note: In a real app, you might want to restore colors/logo too
            generateQR();
        };
        historyGrid.appendChild(div);
    });
}

async function downloadQR() {
    try {
        const a = document.createElement("a");
        a.href = qrImage.src;
        a.download = `qr-aura-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error("Download failed", error);
        alert("Failed to download image.");
    }
}

function shareQR() {
    if (navigator.share && !qrImage.src.startsWith('data:')) {
        navigator.share({
            title: 'My QR Aura',
            text: `Check out this QR code for: ${qrText.value}`,
            url: qrImage.src
        }).catch(err => console.log('Error sharing', err));
    } else {
        navigator.clipboard.writeText(qrImage.src);
        alert("QR link or data copied to clipboard!");
    }
}

// Event Listeners
generateBtn.onclick = generateQR;
qrText.onkeypress = (e) => { if (e.key === "Enter") generateQR(); };
downloadBtn.onclick = downloadQR;
shareBtn.onclick = shareQR;
clearHistoryBtn.onclick = () => {
    history = [];
    localStorage.removeItem("qrHistory");
    renderHistory();
};
