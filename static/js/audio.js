/* --- static/js/audio.js --- */

// Tạo thẻ audio ẩn để phát nhạc
export const audioEl = new Audio();
audioEl.crossOrigin = "anonymous"; // Cho phép xử lý âm thanh từ nguồn khác (CORS)

let audioCtx = null;
let sourceNode = null;
export let analyser = null;
export let dataArray = null;

// 🔥 Các bộ lọc âm thanh
let bassFilter = null;
let trebleFilter = null;

export async function initAudio() {
    if (!audioCtx) {
        // Khởi tạo AudioContext (Bộ não xử lý âm thanh của trình duyệt)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Cắm nguồn nhạc vào AudioContext
        sourceNode = audioCtx.createMediaElementSource(audioEl);
        
        // 1. Phân tích tần số để vẽ Sóng âm (Visualizer)
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // 2. 🎛️ Tạo bộ lọc Bass (Âm trầm)
        bassFilter = audioCtx.createBiquadFilter();
        bassFilter.type = "lowshelf"; // Lọc các dải âm thấp
        bassFilter.frequency.value = 150; // Tập trung vào dải dưới 150Hz (tiếng trống, tiếng bass)
        bassFilter.gain.value = 0; // Mặc định là 0 dB

        // 3. 🎛️ Tạo bộ lọc Treble (Âm cao)
        trebleFilter = audioCtx.createBiquadFilter();
        trebleFilter.type = "highshelf"; // Lọc các dải âm cao
        trebleFilter.frequency.value = 4000; // Tập trung vào dải trên 4000Hz (tiếng dồn, chũm chọe, giọng thanh)
        trebleFilter.gain.value = 0; // Mặc định là 0 dB

        // 🌟 KẾT NỐI DÂY CÁP (Theo thứ tự: Nguồn nhạc -> Bass -> Treble -> Sóng âm -> Loa máy tính)
        sourceNode.connect(bassFilter);
        bassFilter.connect(trebleFilter);
        trebleFilter.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    
    // Trình duyệt thường bắt người dùng tương tác mới cho phát nhạc
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

// Hàm nhận lệnh từ main.js để tăng/giảm Bass
export function setBass(value) {
    if (bassFilter) {
        bassFilter.gain.value = value;
    }
}

// Hàm nhận lệnh từ main.js để tăng/giảm Treble
export function setTreble(value) {
    if (trebleFilter) {
        trebleFilter.gain.value = value;
    }
}

// Hàm dự phòng cho tính năng Thu âm (Phòng thu mini) sau này
export function startRecording() {
    console.log("Tính năng thu âm Microphone đang được phát triển!");
}