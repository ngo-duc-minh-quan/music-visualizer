/* --- static/js/main.js --- */
import { initVisualizer, renderFrame, setVisualColor, setDrawMode, setBgImage } from './visualizer.js';
import { initAudio, audioEl, analyser, dataArray, startRecording } from './audio.js';
import { fetchAiLyrics, clearLyrics, updateKaraoke } from './lyrics.js';
import { renderHistory, renderPlaylist, loadTrendingMusic, addToHistory, addToPlaylist, clearPlaylist, clearHistory, getHistoryData, getPlaylistData } from './playlist.js';
// --- BIẾN TRẠNG THÁI ---
let isLooping = false;
let currentSongUrl = "";
let currentPlaySource = "history"; // history, playlist, trending, search
let currentSong = null; // Object chứa bài đang hát
let mediaRecorder = null;

// Biến cho thanh tua nhạc
let isDragging = false;

document.addEventListener("DOMContentLoaded", () => {
    // 1. KHỞI TẠO BAN ĐẦU
    initVisualizer();
    renderHistory();
    renderPlaylist();
    loadTrendingMusic('all');
    
    // UI Elements
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const loopBtn = document.getElementById("loopBtn");
    const audioName = document.getElementById("audioName");
    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    
    // --- VÒNG LẶP VẼ (Animation Loop) ---
    function loop() {
        requestAnimationFrame(loop);
        renderFrame(analyser, dataArray);
    }

    // --- HÀM PHÁT NHẠC (CORE FUNCTION) ---
    window.playTrackGlobal = async function(url, title, thumbnail, originalUrl = null, sourceList = "history") {
        currentSongUrl = originalUrl || url; 
        currentPlaySource = sourceList;
        currentSong = { title, url, thumbnail, originalUrl };
        
        // Hiển thị nút Add
        const mainAddBtn = document.getElementById("mainAddBtn");
        if(mainAddBtn) mainAddBtn.style.display = "block";

        audioName.textContent = "⌛ " + title;
        playBtn.style.display = "none"; 
        pauseBtn.style.display = "flex";
        
        // Xử lý link proxy nếu cần
        let playUrl = url.startsWith("http") ? `/proxy_audio?url=${encodeURIComponent(url)}` : url;
        audioEl.src = playUrl;
        audioEl.load();

        try {
            await initAudio();
            await audioEl.play();
            
            audioName.textContent = "🎵 " + title;
            if (thumbnail) setBgImage(thumbnail);

            // Lưu lịch sử
            if (sourceList === "search" || sourceList === "history") {
                addToHistory(title, url, thumbnail, originalUrl);
            }

            // Xử lý Lyric
            clearLyrics();
            const aiToggle = document.getElementById("aiToggle");
            if (originalUrl) {
                fetchAiLyrics(originalUrl, aiToggle ? aiToggle.checked : false);
            } else {
                fetchAiLyrics(null, false); // Local music
            }

            loop(); // Bắt đầu vẽ Visualizer

        } catch (e) {
            console.error(e); 
            alert("Lỗi phát nhạc! (Có thể do trình duyệt chặn tự phát)");
            playBtn.style.display = "flex"; pauseBtn.style.display = "none";
        }
    };

    // --- SỰ KIỆN AUDIO ---
    // Tự động chuyển bài
    audioEl.addEventListener("ended", () => {
        if (isLooping) return;
        
        const list = currentPlaySource === "playlist" ? getPlaylistData() : getHistoryData();
        const currentIndex = list.findIndex(item => item.title === currentSong.title);
        const nextIndex = currentIndex + 1;
        
        if (nextIndex < list.length) {
            const next = list[nextIndex];
            window.playTrackGlobal(next.url, next.title, next.thumbnail, next.originalUrl, currentPlaySource);
        } else {
            playBtn.style.display = "flex"; pauseBtn.style.display = "none";
        }
    });

    // ============================================================
    // 🔥 CẬP NHẬT MỚI: LOGIC TUA NHẠC (DRAG & DROP)
    // ============================================================
    
    // Hàm tính toán vị trí khi kéo chuột
    function updateSeek(e) {
        if (!audioEl.duration) return;
        const r = progressBar.getBoundingClientRect();
        let p = (e.clientX - r.left) / r.width;
        p = Math.max(0, Math.min(1, p)); // Giới hạn 0-100%
        
        audioEl.currentTime = p * audioEl.duration;
        progressFill.style.width = p * 100 + "%";
    }

    // Bắt sự kiện chuột trên thanh tiến trình
    progressBar.addEventListener("mousedown", e => { 
        isDragging = true; 
        updateSeek(e); 
    });
    
    document.addEventListener("mousemove", e => { 
        if (isDragging) updateSeek(e); 
    });
    
    document.addEventListener("mouseup", () => { 
        isDragging = false; 
    });

    // Cập nhật giao diện khi nhạc chạy
    audioEl.addEventListener("timeupdate", () => {
        // Chỉ cập nhật khi người dùng KHÔNG đang kéo chuột (tránh giật)
        if (!isDragging && audioEl.duration) {
            const curTimeEl = document.getElementById("currentTime");
            const durTimeEl = document.getElementById("duration");
            
            const percent = (audioEl.currentTime / audioEl.duration) * 100;
            progressFill.style.width = percent + "%";
            
            curTimeEl.textContent = formatTime(audioEl.currentTime);
            durTimeEl.textContent = formatTime(audioEl.duration);
        }
        updateKaraoke(audioEl.currentTime);
    });
    // ============================================================


    // --- CÁC SỰ KIỆN NÚT BẤM (CONTROLS) ---
    playBtn.addEventListener("click", async () => { if(audioEl.src) { await initAudio(); audioEl.play(); playBtn.style.display="none"; pauseBtn.style.display="flex"; loop(); } });
    pauseBtn.addEventListener("click", () => { audioEl.pause(); playBtn.style.display="flex"; pauseBtn.style.display="none"; });
    
    loopBtn.addEventListener("click", () => {
        isLooping = !isLooping;
        audioEl.loop = isLooping;
        loopBtn.classList.toggle("active", isLooping);
    });

    // Tìm kiếm
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const loadingText = document.getElementById("loadingText");
    
    searchBtn.addEventListener("click", async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        loadingText.style.display = "block"; searchBtn.disabled = true;
        try {
            const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const d = await r.json();
            if (d.error) alert("Không tìm thấy!"); 
            else window.playTrackGlobal(d.url, d.title, d.thumbnail, d.webpage_url, "search");
        } catch (e) { alert("Lỗi mạng!"); } 
        finally { loadingText.style.display = "none"; searchBtn.disabled = false; }
    });
    searchInput.addEventListener("keypress", e => { if (e.key === "Enter") searchBtn.click(); });

    // Đổi màu / Giao diện
    const colorPicker = document.getElementById("colorPicker");
    if(colorPicker) colorPicker.addEventListener("input", (e) => setVisualColor(e.target.value));
    
    document.getElementById("themeSelect").addEventListener("change", (e) => {
        const val = e.target.value;
        const color = val === "blue" ? "#00c6ff" : (val === "purple" ? "#bc4e9c" : "#ff416c");
        setVisualColor(color);
        if(colorPicker) colorPicker.value = color;
    });
    
    document.getElementById("modeToggle").addEventListener("click", () => {
        // Toggle logic (nếu cần)
    });

    // Upload File Local
    document.getElementById("audioFile").addEventListener("change", e => { 
        if (e.target.files[0]) window.playTrackGlobal(URL.createObjectURL(e.target.files[0]), e.target.files[0].name, null, null, "history"); 
    });
    document.getElementById("imageFile").addEventListener("change", e => { 
        if (e.target.files[0]) setBgImage(URL.createObjectURL(e.target.files[0])); 
    });

    // Sidebar & Playlist Controls
    const sidePanel = document.getElementById("sidePanel");
    document.getElementById("togglePanelBtn").addEventListener("click", () => sidePanel.classList.add("open"));
    document.getElementById("closePanelBtn").addEventListener("click", () => sidePanel.classList.remove("open"));
    document.getElementById("clearHistory").addEventListener("click", () => { localStorage.setItem("musicHistory", "[]"); renderHistory(); });
    document.getElementById("clearPlaylist").addEventListener("click", clearPlaylist);
    document.getElementById("mainAddBtn").addEventListener("click", () => { if (currentSong) addToPlaylist(currentSong); });

    // Record
    const recordBtn = document.getElementById("recordBtn");
    const stopRecordBtn = document.getElementById("stopRecordBtn");
    recordBtn.addEventListener("click", () => {
        mediaRecorder = startRecording(document.getElementById("visualizer"), () => {
            recordBtn.style.display = "flex"; stopRecordBtn.style.display = "none";
        });
        if(mediaRecorder) { recordBtn.style.display = "none"; stopRecordBtn.style.display = "flex"; }
    });
    stopRecordBtn.addEventListener("click", () => { if(mediaRecorder) mediaRecorder.stop(); });

    // Expose các hàm lọc nhạc cho HTML gọi
    window.filterMusic = (type, btn) => {
        document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTrendingMusic(type);
    };

    // Hàm đổi giọng (Voice Change)
    window.changeVoice = async function(mode) {
        if (!currentSongUrl || !currentSongUrl.startsWith("http")) return alert("Chỉ hỗ trợ nhạc Online!");
        const msg = document.getElementById("processingMsg");
        if(msg) msg.style.display = "block";
        const oldLabel = audioName.textContent;
        if(!audioName.textContent.includes("Đang tách")) audioName.innerHTML += " <span style='color:#ffe600;font-size:12px;'>(⏳ Đang tách...)</span>";

        try {
            const res = await fetch(`/api/process_audio?url=${encodeURIComponent(currentSongUrl)}&mode=${mode}`);
            if (!res.ok) throw new Error("Lỗi Server");
            const blob = await res.blob();
            const audioUrl = URL.createObjectURL(blob);
            
            const t = audioEl.currentTime;
            audioEl.src = audioUrl; audioEl.load();
            await initAudio();
            audioEl.currentTime = t; await audioEl.play();

            if(msg) msg.style.display = "none";
            audioName.innerHTML = oldLabel.replace(" (⏳ Đang tách...)", "").split(" (✅")[0] + ` <span style='color:#0f0;font-size:12px;'>(✅ ${mode})</span>`;
            playBtn.style.display = "none"; pauseBtn.style.display = "flex";
            loop(); 
        } catch (e) { 
            alert("Lỗi xử lý!"); 
            if(msg) msg.style.display = "none"; 
            audioName.innerHTML = oldLabel.replace(" (⏳ Đang tách...)", "");
        } 
    };
});

function formatTime(t) { 
    if (isNaN(t)) return "00:00"; 
    return `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`; 
}