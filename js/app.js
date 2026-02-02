/**
 * AI EVENT FINDER - CORE LOGIC (GLOBAL FETCH HIJACK)
 * This version intercepts all network requests to redirect .json to .json.png
 */

// 1. CONFIGURATION
const APP_URL = "https://script.google.com/macros/s/AKfycbz6r6S3clU5VWg5gAtaRlhTIKaBQ7Pf4TQbcBh3rUq-1lg_JLm9cH7DmYA_Jh2njBFC/exec"; 
const MODEL_URL = 'https://visitmustansir.github.io/photo-finder/models/'; 

/**
 * INIT: Hijacks the fetch API to handle GitHub's extension restrictions
 */
async function init() {
    const statusLabel = document.getElementById('model-status');
    try {
        console.log("--- AI SYSTEM STARTUP (FETCH HIJACK) ---");
        statusLabel.innerText = "Connecting to models...";

        // --- THE HIJACK ---
        const originalFetch = window.fetch;
        window.fetch = function() {
            let url = arguments[0];
            
            // If the library asks for a .json manifest, point it to our .png version
            if (typeof url === 'string' && url.endsWith('.json')) {
                const redirectedUrl = url + '.png';
                console.log("Hijacking Fetch: Redirecting", url, "->", redirectedUrl);
                return originalFetch(redirectedUrl, arguments[1]);
            }
            
            // Otherwise, let the request proceed normally (for shards, etc.)
            return originalFetch.apply(this, arguments);
        };
        // ------------------

        // Now we use the standard, simple loading method.
        // The library thinks it's loading .json, but our hijacker feeds it the .png
        
        statusLabel.innerText = "Loading Detector...";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log("✅ Detector Loaded");
        
        statusLabel.innerText = "Loading Landmarks...";
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log("✅ Landmarks Loaded");
        
        statusLabel.innerText = "Loading Recognizer...";
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("✅ Recognizer Loaded");
        
        // Restore original fetch after loading is done to avoid side effects
        window.fetch = originalFetch;

        statusLabel.innerText = "AI LOCAL ENGINE ACTIVE";
        document.getElementById('loading-spinner').classList.add('hidden');
        checkUser();
        
    } catch (e) {
        console.error("AI FATAL ERROR:", e);
        statusLabel.innerText = "LOAD FAILED: " + e.message.substring(0, 45);
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
    if (saved) {
        retUser.classList.remove('hidden');
        newUser.classList.add('hidden');
    } else {
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
        document.getElementById('video').srcObject = stream;
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('ui-container').classList.add('hidden');
    } catch (err) {
        alert("Camera access denied.");
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
    
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();
    
    if (!detection) return alert("Face not found! Try again.");

    const vector = Array.from(detection.descriptor);
    localStorage.setItem('face_print', JSON.stringify(vector));
    
    video.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('video-container').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');

    performSearch(vector);
}

/**
 * AUTO-SEARCH
 */
async function autoSearch() {
    const vector = JSON.parse(localStorage.getItem('face_print'));
    if (vector) performSearch(vector);
}

/**
 * SEARCH DATABASE
 */
async function performSearch(vector) {
    const status = document.getElementById('status');
    const resultsArea = document.getElementById('results-area');
    const gallery = document.getElementById('gallery');
    resultsArea.classList.remove('hidden');
    status.innerText = "Searching...";
    gallery.innerHTML = "";

    try {
        const res = await fetch(APP_URL, {
            method: "POST",
            body: JSON.stringify({ action: "search", descriptor: vector })
        });
        const matches = await res.json();
        status.innerText = matches.length > 0 ? `Found ${matches.length} photos` : "No matches found.";

        matches.forEach((url, index) => {
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
        status.innerText = "Connection error."; 
    }
}

/**
 * NATIVE SAVE
 */
async function downloadImage(url, index) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `photo_${index}.jpg`, { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Event Photo' });
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `photo_${index}.jpg`;
            link.click();
        }
    } catch (err) {
        alert("Long-press image to save.");
    }
}

/**
 * ADMIN: Indexing
 */
async function uploadAndIndex() {
    const files = document.getElementById('photoInput').files;
    const status = document.getElementById('status');
    for (let file of files) {
        status.innerText = `Indexing ${file.name}...`;
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        const descriptor = detection ? Array.from(detection.descriptor) : null;
        const base64 = await new Promise(res => {
            const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result.split(',')[1]);
        });
        await fetch(APP_URL, { method: "POST", body: JSON.stringify({ action: "upload", base64: base64, descriptor: descriptor, fileName: file.name, mimeType: file.type }) });
    }
    status.innerText = "Indexing Complete.";
}

function clearIdentity() {
    if(confirm("Forget face profile?")) {
        localStorage.removeItem('face_print');
        location.reload();
    }
}

init();
