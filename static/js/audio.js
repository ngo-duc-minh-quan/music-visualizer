/* --- static/js/audio.js --- */
export let audioCtx, analyser, source, dataArray;
export let audioEl = new Audio(); 
audioEl.crossOrigin = "anonymous";

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048; 
        analyser.smoothingTimeConstant = 0.85;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        source = audioCtx.createMediaElementSource(audioEl);
        source.connect(analyser); 
        analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
}

// Hàm ghi âm (Record)
export function startRecording(canvas, onStopCallback) {
    if (!analyser) { alert("Phát nhạc trước!"); return null; }
    
    const stream = canvas.captureStream(30);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    
    const tracks = [...stream.getTracks(), ...dest.stream.getTracks()];
    const mediaRecorder = new MediaRecorder(new MediaStream(tracks), { mimeType: 'video/webm' });
    let recordedChunks = [];

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `visualizer_${Date.now()}.webm`; a.click();
        if(onStopCallback) onStopCallback();
    };
    mediaRecorder.start();
    return mediaRecorder;
}