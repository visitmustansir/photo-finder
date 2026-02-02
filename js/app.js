/**
 * AI EVENT FINDER - CORE LOGIC
 * Handles: Biometric enrollment, persistent identity, and photo matching.
 */

// 1. CONFIGURATION
const APP_URL = "https://script.google.com/macros/s/AKfycbz6r6S3clU5VWg5gAtaRlhTIKaBQ7Pf4TQbcBh3rUq-1lg_JLm9cH7DmYA_Jh2njBFC/exec"; 
const MODEL_URL = './models/'; 

/**
 * INIT: Load AI models from the local GitHub /models/ folder
 */
async function init() {
    try {
        // Loading the 3 core models needed for detection and recognition
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        document.getElementById('model-status').innerText = "AI LOCAL ENGINE ACTIVE";
        document.getElementById('loading-spinner').classList.add('hidden');
        
        // Check if we already know this user
        checkUser();
    } catch (e) {
        document.getElementById('model-status').innerText = "Model Error: Check /models/ folder";
        console.error("AI Init Error:", e);
    }
}

/**
 * IDENTITY MANAGEMENT: Check LocalStorage for saved face prints
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
 * CAMERA: Start the user's camera
 */
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('video').srcObject = stream;
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('ui-container').classList.add('hidden');
    } catch (err) {
        alert("Camera access denied. Please allow camera permissions.");
    }
}

/**
 * CAPTURE: Analyze the face and save the 128-bit vector
 */
async function capture() {
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; 
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // Convert photo to 128 mathematical descriptors
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();
    
    if (!detection) return alert("Face not found! Please look directly at the camera.");

    const vector = Array.from(detection.descriptor);
    
    // THE "REMEMBER ME" PART: Save vector to browser storage
    localStorage.setItem('face_print', JSON.stringify(vector));
    
    // Turn off camera
    video.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('video-container').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');

    performSearch(vector);
}

/**
 * AUTO-SEARCH: Use the saved profile to search without camera
 */
async function autoSearch() {
    const vector = JSON.parse(localStorage.getItem('face_print'));
    performSearch(vector);
}

/**
 * SEARCH: Communicate with Google Drive via Apps Script
 */
async function performSearch(vector) {
    const status = document.getElementById('status');
    status.innerText = "Scanning database...";
    
    try {
        const res = await fetch(APP_URL, {
            method: "POST",
            body: JSON.stringify({ action: "search", descriptor: vector })
        });
        const photos = await res.json();
        
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = "";
        
        status.innerText = photos.length > 0 ? `Found ${photos.length} photos!` : "Nothing found yet.";
        
        photos.forEach(url => {
            gallery.innerHTML += `
                <div class="relative group">
                    <img src="${url}" class="rounded-xl border border-slate-700 w-full shadow-md">
                    <a href="${url}" target="_blank" class="absolute bottom-2 right-2 bg-indigo-600 p-2 rounded-full text-white text-[10px] font-bold">VIEW</a>
                </div>`;
        });
    } catch (e) { 
        status.innerText = "Connection error. Check Apps Script URL."; 
    }
    checkUser();
}

/**
 * ADMIN: Index new photos into the database
 */
async function uploadAndIndex() {
    const files = document.getElementById('photoInput').files;
    const status = document.getElementById('status');
    
    if (files.length === 0) return alert("Select files first.");

    for (let file of files) {
        status.innerText = `Indexing ${file.name}...`;
        
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                                       .withFaceLandmarks()
                                       .withFaceDescriptor();
        
        const descriptor = detection ? Array.from(detection.descriptor) : null;
        
        const base64 = await new Promise(res => {
            const r = new FileReader(); 
            r.readAsDataURL(file); 
            r.onload = () => res(r.result.split(',')[1]);
        });

        await fetch(APP_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: "upload", 
                base64: base64, 
                descriptor: descriptor, 
                fileName: file.name, 
                mimeType: file.type 
            })
        });
    }
    status.innerText = "Indexing Complete.";
}

/**
 * FORGET ME: Delete biometric data
 */
function clearIdentity() {
    if(confirm("Forget your face profile? You will need to re-scan next time.")) {
        localStorage.removeItem('face_print');
        location.reload();
    }
}

// Start the engine
init();
