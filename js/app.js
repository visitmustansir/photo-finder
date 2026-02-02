/**
 * AI EVENT FINDER - STABLE CDN VERSION
 * This version uses a public CDN for models to avoid GitHub hosting issues.
 */

// 1. CONFIGURATION
const APP_URL = "https://script.google.com/macros/s/AKfycbz6r6S3clU5VWg5gAtaRlhTIKaBQ7Pf4TQbcBh3rUq-1lg_JLm9cH7DmYA_Jh2njBFC/exec"; 

// Using a reliable CDN that hosts the face-api models specifically for web apps
const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

/**
 * INIT: Loads models from the CDN
 */
async function init() {
    const statusLabel = document.getElementById('model-status');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    try {
        console.log("--- AI SYSTEM STARTUP (CDN MODE) ---");
        statusLabel.innerText = "Connecting to AI Engine...";

        // Load the 3 required models from the CDN
        // These calls will now look for standard .json files on a server that supports them
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log("✅ Detector Loaded");
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log("✅ Landmarks Loaded");
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("✅ Recognizer Loaded");
        
        statusLabel.innerText = "AI LOCAL ENGINE ACTIVE";
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        
        checkUser();
        
    } catch (e) {
        console.error("AI FATAL ERROR:", e);
        statusLabel.innerText = "LOAD FAILED: AI models unreachable.";
        statusLabel.style.color = "#ff4d4d";
    }
}

/**
 * IDENTITY MANAGEMENT
 */
function checkUser() {
    const saved = localStorage.getItem('face_print');
    const retUser = document.getElementById('returning-user');
    const newUser = document.getElementById('new-user');
    
    if (saved && retUser && newUser) {
        retUser.classList.remove('hidden');
        newUser.classList.add('hidden');
    } else if (newUser) {
        retUser.classList.add('hidden');
        newUser.classList.remove('hidden');
    }
}

/**
 * CAMERA CONTROLS
 */
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.getElementById('video');
        video.srcObject = stream;
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('ui-container').classList.add('hidden');
    } catch (err) {
        alert("Camera access denied. Please allow camera permissions.");
    }
}

/**
 * CAPTURE & ANALYZE
 */
async function capture() {
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; 
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // AI Processing
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();
    
    if (!detection) {
        alert("Face not detected. Please ensure your face is clear and visible.");
        return;
    }

    const vector = Array.from(detection.descriptor);
    localStorage.setItem('face_print', JSON.stringify(vector));
    
    // Stop Camera
    video.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('video-container').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');

    performSearch(vector);
}

/**
 * SEARCH DATABASE
 */
async function performSearch(vector) {
    const status = document.getElementById('status');
    const resultsArea = document.getElementById('results-area');
    const gallery = document.getElementById('gallery');
    
    resultsArea.classList.remove('hidden');
    status.innerText = "Searching for your photos...";
    gallery.innerHTML = "";

    try {
        const res = await fetch(APP_URL, {
            method: "POST",
            body: JSON.stringify({ action: "search", descriptor: vector })
        });
        const matches = await res.json();
        
        status.innerText = matches.length > 0 ? `We found ${matches.length} photos of you!` : "No matches found yet.";

        matches.forEach((url, index) => {
            // Convert Google Drive view links to direct download links
            const directUrl = url.replace('file/d/', 'uc?export=download&id=').replace('/view?usp=sharing', '');
            
            gallery.innerHTML += `
                <div class="relative bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-700">
                    <img src="${url}" class="w-full h-48 object-cover">
                    <button onclick="downloadImage('${directUrl}', ${index})" class="absolute bottom-2 left-2 right-2 bg-indigo-600 py-2 rounded-xl text-[10px] font-bold shadow-lg">
                        SAVE TO PHONE
                    </button>
                </div>`;
        });
    } catch (e) { 
        status.innerText = "Connection error. Please try again."; 
    }
}

/**
 * DOWNLOAD/SHARE
 */
async function downloadImage(url, index) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `event_photo_${index}.jpg`, { type: "image/jpeg" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'My Event Photo' });
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `event_photo_${index}.jpg`;
            link.click();
        }
    } catch (err) {
        alert("Long-press the image to save it to your gallery.");
    }
}

function clearIdentity() {
    if(confirm("This will clear your face profile. Continue?")) {
        localStorage.removeItem('face_print');
        location.reload();
    }
}

// Start the app
init();
