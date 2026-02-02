const APP_URL = "https://script.google.com/macros/s/AKfycbz6r6S3clU5VWg5gAtaRlhTIKaBQ7Pf4TQbcBh3rUq-1lg_JLm9cH7DmYA_Jh2njBFC/exec"; 
const MODEL_URL = './models/'; 

async function init() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        document.getElementById('model-status').innerText = "AI LOCAL ENGINE ACTIVE";
        document.getElementById('loading-spinner').classList.add('hidden');
        checkUser();
    } catch (e) {
        document.getElementById('model-status').innerText = "Model Error";
    }
}

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

async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById('video').srcObject = stream;
    document.getElementById('video-container').classList.remove('hidden');
    document.getElementById('ui-container').classList.add('hidden');
}

async function capture() {
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; 
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
    if (!detection) return alert("Look at the camera!");
    const vector = Array.from(detection.descriptor);
    localStorage.setItem('face_print', JSON.stringify(vector));
    video.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('video-container').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    performSearch(vector);
}

async function autoSearch() {
    const vector = JSON.parse(localStorage.getItem('face_print'));
    performSearch(vector);
}

async function performSearch(vector) {
    const status = document.getElementById('status');
    const resultsArea = document.getElementById('results-area');
    const gallery = document.getElementById('gallery');
    resultsArea.classList.remove('hidden');
    status.innerText = "Searching...";
    gallery.innerHTML = "";

    const res = await fetch(APP_URL, { method: "POST", body: JSON.stringify({ action: "search", descriptor: vector }) });
    const matches = await res.json();
    status.innerText = matches.length > 0 ? `Found ${matches.length} photos` : "No photos found.";

    matches.forEach((url, index) => {
        // Convert View Link to Direct Image Link for the Download button
        const directUrl = url.replace('file/d/', 'uc?export=download&id=').replace('/view?usp=sharing', '');
        
        gallery.innerHTML += `
            <div class="relative bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-700">
                <img src="${url}" class="w-full h-48 object-cover">
                <button onclick="downloadImage('${directUrl}', ${index})" class="absolute bottom-2 left-2 right-2 bg-indigo-600 py-2 rounded-xl text-[10px] font-bold shadow-lg active:scale-95 transition">
                    SAVE TO PHONE
                </button>
            </div>`;
    });
}

/**
 * NATIVE SAVE FEATURE: Uses the browser's Share API
 */
async function downloadImage(url, index) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `event_photo_${index}.jpg`, { type: "image/jpeg" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Event Photo',
                text: 'Saving my photo from the event.'
            });
        } else {
            // Fallback: If Share API isn't supported, trigger a direct browser download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `photo_${index}.jpg`;
            link.click();
        }
    } catch (err) {
        console.error("Download failed", err);
        alert("Long-press the image to save it directly.");
    }
}

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
    localStorage.removeItem('face_print');
    location.reload();
}

init();
