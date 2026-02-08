/* --- static/js/playlist.js --- */
// Import hàm playTrack từ main (sẽ được gán vào window sau)
let history = JSON.parse(localStorage.getItem("musicHistory")) || [];
let playlist = JSON.parse(localStorage.getItem("musicPlaylist")) || [];

export function getHistoryData() { return history; }
export function getPlaylistData() { return playlist; }

// --- RENDER GIAO DIỆN ---
export function renderHistory() {
    const ul = document.getElementById("historyUl");
    if(!ul) return;
    ul.innerHTML = "";
    
    // Kiểm tra nếu lịch sử trống
    if (history.length === 0) {
        ul.innerHTML = `<li style="color:#777;font-size:12px;text-align:center;padding:10px;">(Lịch sử trống)</li>`;
        return;
    }

    history.forEach(item => {
        const li = document.createElement("li"); li.className = "history-item";
        const imgHtml = item.thumbnail ? `<img src="${item.thumbnail}">` : `<div>🎵</div>`;
        li.innerHTML = `<div style="display:flex;align-items:center;flex:1;cursor:pointer;">${imgHtml} <div style="font-size:12px;margin-left:5px;">${item.title}</div></div><button class="add-btn" style="color:#0f0;">+</button>`;
        
        // Gọi hàm playTrack toàn cục
        li.querySelector('div').onclick = () => window.playTrackGlobal(item.url, item.title, item.thumbnail, item.originalUrl, "history");
        li.querySelector('.add-btn').onclick = (e) => { e.stopPropagation(); addToPlaylist(item); };
        ul.appendChild(li);
    });
}

export function renderPlaylist() {
    const ul = document.getElementById("playlistUl");
    if(!ul) return;
    ul.innerHTML = "";
    if (playlist.length === 0) { ul.innerHTML = `<li style="color:#777;font-size:12px;text-align:center;padding:10px;">(Trống)</li>`; return; }
    
    playlist.forEach((item, index) => {
        const li = document.createElement("li"); li.className = "history-item";
        const imgHtml = item.thumbnail ? `<img src="${item.thumbnail}">` : `<div>🎵</div>`;
        li.innerHTML = `<div style="display:flex;align-items:center;flex:1;cursor:pointer;"><span style="color:#ffe600;font-size:10px;margin-right:5px;">${index+1}.</span>${imgHtml} <div style="font-size:12px;margin-left:5px;">${item.title}</div></div><button class="del-btn" style="color:#f55;">×</button>`;
        
        li.querySelector('div').onclick = () => window.playTrackGlobal(item.url, item.title, item.thumbnail, item.originalUrl, "playlist");
        li.querySelector('.del-btn').onclick = (e) => { 
            e.stopPropagation(); 
            playlist.splice(index, 1); 
            localStorage.setItem("musicPlaylist", JSON.stringify(playlist)); 
            renderPlaylist(); 
        };
        ul.appendChild(li);
    });
}

// --- LOGIC DỮ LIỆU ---
export function addToHistory(t, u, th, o) {
    if (history.length > 0 && history[0].title === t) return; // Trùng bài đầu thì thôi
    history = history.filter(h => h.title !== t); // Xóa bài trùng cũ
    history.unshift({ title: t, url: u, thumbnail: th, originalUrl: o });
    if (history.length > 30) history.pop(); // Giới hạn 30 bài
    localStorage.setItem("musicHistory", JSON.stringify(history));
    renderHistory();
}

export function addToPlaylist(item) {
    if (playlist.some(p => p.title === item.title)) return alert("Đã có trong Playlist!");
    playlist.push(item);
    localStorage.setItem("musicPlaylist", JSON.stringify(playlist));
    renderPlaylist();
    // Hiệu ứng nút bấm
    const btn = document.getElementById("mainAddBtn");
    if(btn) { 
        const i = btn.querySelector("i"); 
        if(i) { i.className = "fas fa-check"; setTimeout(() => i.className = "fas fa-plus-circle", 1500); }
    }
}

export function clearPlaylist() {
    if (confirm("Xóa hết Playlist?")) { 
        playlist = []; 
        localStorage.setItem("musicPlaylist", "[]"); 
        renderPlaylist(); 
    }
}

// 🔥 CẬP NHẬT MỚI: HÀM XÓA LỊCH SỬ 🔥
export function clearHistory() {
    if (confirm("Xóa toàn bộ lịch sử nghe nhạc?")) {
        history = []; // Xóa biến trong RAM
        localStorage.setItem("musicHistory", "[]"); // Xóa trong ổ cứng
        renderHistory(); // Vẽ lại giao diện
    }
}

// --- API TRENDING ---
export async function loadTrendingMusic(type = 'all') {
    const grid = document.getElementById("recommendGrid");
    const loading = document.getElementById("recommendLoading");
    if(!grid) return;
    
    grid.innerHTML = ""; 
    if(loading) {
        loading.style.display = "block";
        const typeName = type === 'all' ? "HOT" : type.toUpperCase();
        loading.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Đang tìm nhạc <b>${typeName}</b>...`;
    }

    try {
        const res = await fetch(`/api/trending?type=${type}`);
        const songs = await res.json();
        if(loading) loading.style.display = "none";
        
        if (songs.error) { grid.innerHTML = '<div style="color:#777;">Lỗi tải nhạc.</div>'; return; }

        songs.forEach(song => {
            const card = document.createElement("div"); card.className = "song-card";
            card.innerHTML = `<img src="${song.thumbnail}"><div class="song-title">${song.title}</div>`;
            card.addEventListener("click", () => window.playTrackGlobal(song.url, song.title, song.thumbnail, song.webpage_url, "trending"));
            grid.appendChild(card);
        });
    } catch (e) { if(loading) loading.innerText = "Lỗi kết nối."; }
}