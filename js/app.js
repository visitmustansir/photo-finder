/**
 * PHOTO MAGIC - HIGH ACCURACY VERSION
 */

const APP_URL = "https://script.google.com/macros/s/AKfycbz6r6S3clU5VWg5gAtaRlhTIKaBQ7Pf4TQbcBh3rUq-1lg_JLm9cH7DmYA_Jh2njBFC/exec"; 
const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

async function init() {
    const statusLabel = document.getElementById('model-status');
    try {
        // CHANGED: Loading the high-accuracy SSD Mobilenet model instead of TinyFace
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        statusLabel.innerText = "AI PRECISION ENGINE ACTIVE";
        statusLabel.classList.replace('text-indigo-400', 'text-emerald-500');
        checkUser();
    } catch (e) {
        statusLabel.innerText = "ENGINE ERROR";
    }
}

function checkUser() {
    const saved = localStorage.getItem('face_print');
    document.getElementById('returning-user').classList.toggle('hidden', !saved);
    document.getElementById('new-user').classList.toggle('hidden', !!saved);
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('video').srcObject = stream;
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('ui-container').classList.add('hidden');
    } catch (err) { alert("Camera access denied."); }
}

async function capture() {
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; 
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // CHANGED: Using SsdMobilenetv1Options for better accuracy
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptor();
    
    if (!detection) return alert("Face not found! Please look directly at the camera.");

    const vector = Array.from(detection.descriptor);
    localStorage.setItem('face_print', JSON.stringify(vector));
    video.srcObject.getTracks().forEach(t => t.stop());
    
    document.getElementById('video-container').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    performSearch(vector);
}

async function autoSearch() {
    const vector = JSON.parse(localStorage.getItem('face_print'));
    if (vector) performSearch(vector);
}

async function performSearch(vector) {
    const status = document.getElementById('status');
    const gallery = document.getElementById('gallery');
    document.getElementById('results-area').classList.remove('hidden');
    status.innerText = "Analyzing matches...";
    gallery.innerHTML = "";

    try {
        const res = await fetch(APP_URL, { method: "POST", body: JSON.stringify({ action: "search", descriptor: vector }) });
        const matches = await res.json();
        
        status.innerText = matches.length > 0 ? `Found ${matches.length} matches!` : "No matching photos found.";

        matches.forEach((url) => {
            gallery.innerHTML += `
                <div class="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 p-2">
                    <img src="${url}" class="w-full h-64 object-cover rounded-2xl mb-3" crossorigin="anonymous">
                    <a href="${url}" target="_blank" class="block w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm text-center">
                        View Photo
                    </a>
                </div>`;
        });
    } catch (e) { status.innerText = "Connection error."; }
}

async function uploadAndIndex() {
    const files = document.getElementById('photoInput').files;
    if (files.length === 0) return alert("Select photos first!");
    const status = document.getElementById('status');
    
    for (let file of files) {
        status.innerText = `Precision Indexing: ${file.name}`;
        const img = await faceapi.bufferToImage(file);
        
        // CHANGED: Using SsdMobilenetv1Options here as well
        const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptor();
        
        const descriptor = detection ? Array.from(detection.descriptor) : null;
        const base64 = await new Promise(res => {
            const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result.split(',')[1]);
        });
        
        await fetch(APP_URL, { 
            method: "POST", 
            body: JSON.stringify({ action: "upload", base64: base64, descriptor: descriptor, fileName: file.name, mimeType: file.type }) 
        });
    }
    status.innerText = "Upload Complete!";
    setTimeout(() => { status.innerText = ""; }, 3000);
}

function clearIdentity() {
    if(confirm("Reset face profile?")) {
        localStorage.removeItem('face_print');
        location.reload();
    }
}

init();
