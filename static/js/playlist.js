/* --- static/js/playlist.js --- */
let history = JSON.parse(localStorage.getItem("musicHistory")) || [];
let playlist = JSON.parse(localStorage.getItem("musicPlaylist")) || [];

export function getHistoryData() { return history; }
export function getPlaylistData() { return playlist; }

// ============================================================
//  HÀM HIỂN THỊ MODAL ĐẸP (Thay thế confirm mặc định)
// ============================================================
function showCustomConfirm(message, callback) {
    const modal = document.getElementById("customModal");
    const msgEl = document.getElementById("modalMessage");
    const btnCancel = document.getElementById("btnCancel");
    const btnConfirm = document.getElementById("btnConfirm");

    // Nếu quên chưa thêm HTML bên index.html thì dùng tạm cái cũ
    if (!modal) {
        if(confirm(message)) callback();
        return;
    }

    // 1. Hiển thị nội dung
    msgEl.textContent = message;
    modal.classList.add("active");

    // 2. Hàm đóng modal
    const close = () => modal.classList.remove("active");
    
    // 3. Gán sự kiện cho nút
    btnCancel.onclick = close;
    
    btnConfirm.onclick = () => {
        close();
        callback(); // Thực hiện hành động
    };

    // Bấm ra vùng đen bên ngoài cũng đóng modal
    modal.onclick = (e) => {
        if (e.target === modal) close();
    };
}

// ============================================================
// RENDER GIAO DIỆN (ĐÃ NÂNG CẤP ICON & STYLING)
// ============================================================

export function renderHistory() {
    const ul = document.getElementById("historyUl");
    if(!ul) return;
    ul.innerHTML = "";
    
    if (history.length === 0) {
        ul.innerHTML = `<li style="color:#777;font-size:12px;text-align:center;padding:10px;">(Lịch sử trống)</li>`;
        return;
    }

    history.forEach(item => {
        const li = document.createElement("li"); li.className = "history-item";
        const imgHtml = item.thumbnail ? `<img src="${item.thumbnail}">` : `<div>🎵</div>`;
        
        // UPDATE: Layout Flexbox chuẩn + Nút Icon Add
        li.innerHTML = `
            <div style="display:flex;align-items:center;flex:1;cursor:pointer;overflow:hidden;">
                ${imgHtml} 
                <div style="font-size:12px;margin-left:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title}</div>
            </div>
            <button class="item-icon-btn add" title="Thêm vào Playlist"><i class="fas fa-plus-circle"></i></button>
        `;
        
        li.querySelector('div').onclick = () => window.playTrackGlobal(item.url, item.title, item.thumbnail, item.originalUrl, "history");
        
        // Bắt sự kiện nút thêm (class .add)
        li.querySelector('.add').onclick = (e) => { e.stopPropagation(); addToPlaylist(item); };
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
        
        // UPDATE: Số thứ tự + Layout gọn + Nút Icon Delete
        li.innerHTML = `
            <div style="display:flex;align-items:center;flex:1;cursor:pointer;overflow:hidden;">
                <span style="color:#ffe600;font-size:10px;margin-right:8px;min-width:15px;">${index+1}.</span>
                ${imgHtml} 
                <div style="font-size:12px;margin-left:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title}</div>
            </div>
            <button class="item-icon-btn del" title="Xóa khỏi Playlist"><i class="fas fa-trash"></i></button>
        `;
        
        li.querySelector('div').onclick = () => window.playTrackGlobal(item.url, item.title, item.thumbnail, item.originalUrl, "playlist");
        
        // Bắt sự kiện nút xóa (class .del)
        li.querySelector('.del').onclick = (e) => { 
            e.stopPropagation(); 
            showCustomConfirm("Bạn muốn xóa bài này khỏi Playlist?", () => {
                playlist.splice(index, 1); 
                localStorage.setItem("musicPlaylist", JSON.stringify(playlist)); 
                renderPlaylist(); 
            });
        };
        ul.appendChild(li);
    });
}

// --- LOGIC DỮ LIỆU ---
export function addToHistory(t, u, th, o) {
    if (history.length > 0 && history[0].title === t) return;
    history = history.filter(h => h.title !== t);
    history.unshift({ title: t, url: u, thumbnail: th, originalUrl: o });
    if (history.length > 30) history.pop();
    localStorage.setItem("musicHistory", JSON.stringify(history));
    renderHistory();
}

export function addToPlaylist(item) {
    if (playlist.some(p => p.title === item.title)) return alert("Đã có trong Playlist!");
    playlist.push(item);
    localStorage.setItem("musicPlaylist", JSON.stringify(playlist));
    renderPlaylist();
    
    // Hiệu ứng nút thêm chính (Main Button)
    const btn = document.getElementById("mainAddBtn");
    if(btn) { 
        btn.innerHTML = '<i class="fas fa-check" style="color:#0f0;"></i>';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-plus-circle"></i>', 1500);
    }
}

export function clearPlaylist() {
    if (playlist.length === 0) return;
    showCustomConfirm("Bạn có chắc chắn muốn xóa TOÀN BỘ Playlist không?", () => { 
        playlist = []; 
        localStorage.setItem("musicPlaylist", "[]"); 
        renderPlaylist(); 
    });
}

export function clearHistory() {
    if (history.length === 0) return;
    showCustomConfirm("Xóa sạch lịch sử nghe nhạc nhé?", () => {
        history = []; 
        localStorage.setItem("musicHistory", "[]"); 
        renderHistory(); 
    });
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