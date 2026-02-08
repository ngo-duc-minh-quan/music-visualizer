document.addEventListener("DOMContentLoaded", () => {
    /* =========================================
       1. KHAI BÁO CÁC PHẦN TỬ (DOM ELEMENTS)
    ========================================= */
    const canvas = document.getElementById("visualizer");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // UI Elements
    const audioInput = document.getElementById("audioFile");
    const imageInput = document.getElementById("imageFile");
    const bgDiv = document.getElementById("bgImage");
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const audioName = document.getElementById("audioName");

    // Controls
    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    const curTimeEl = document.getElementById("currentTime");
    const durTimeEl = document.getElementById("duration");
    const volumeEl = document.getElementById("volume");
    const speedRange = document.getElementById("speedRange");
    const speedLabel = document.getElementById("speedLabel");
    const themeSelect = document.getElementById("themeSelect");
    const modeToggle = document.getElementById("modeToggle");
    const recordBtn = document.getElementById("recordBtn");
    const stopRecordBtn = document.getElementById("stopRecordBtn");

    // --- MỚI: COLOR PICKER (CHỌN MÀU) ---
    const colorPicker = document.getElementById("colorPicker");

    // Sidebar & Karaoke
    const sidePanel = document.getElementById("sidePanel");
    const togglePanelBtn = document.getElementById("togglePanelBtn");
    const closePanelBtn = document.getElementById("closePanelBtn");
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const loadingText = document.getElementById("loadingText");
    const historyUl = document.getElementById("historyUl");
    const clearHistoryBtn = document.getElementById("clearHistory");
    const loopBtn = document.getElementById("loopBtn");
    const playlistUl = document.getElementById("playlistUl");
    const clearPlaylistBtn = document.getElementById("clearPlaylist");
    const aiToggle = document.getElementById("aiToggle");
    const mainAddBtn = document.getElementById("mainAddBtn");

    // Xử lý Karaoke HTML (Tự động tạo nếu thiếu trong HTML để tránh lỗi)
    let karaokeBox = document.getElementById("karaokeBox");
    if (!karaokeBox) {
        karaokeBox = document.createElement("div");
        karaokeBox.id = "karaokeBox";
        karaokeBox.className = "karaoke-container";
        const stage = document.querySelector(".stage") || document.body;
        stage.appendChild(karaokeBox);
    }

    /* =========================================
       2. TRẠNG THÁI (STATE)
    ========================================= */
    let audioCtx, analyser, source, dataArray;
    let audioEl = new Audio(); audioEl.crossOrigin = "anonymous";

    // MỚI: Biến lưu màu sắc (Mặc định là Red Neon)
    let visualColor = "#ff416c";

    let particles = [], lyrics = [], drawMode = "circle", isLooping = false, imgObj = new Image();
    let isDragging = false, mediaRecorder = null, recordedChunks = [];
    let history = JSON.parse(localStorage.getItem("musicHistory")) || [];
    let playlist = JSON.parse(localStorage.getItem("musicPlaylist")) || [];
    let currentSongUrl = "", currentPlaySource = "history", currentIndex = -1, currentSong = null;

    /* =========================================
       3. CẤU HÌNH CANVAS & XỬ LÝ MÀU
    ========================================= */
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // --- LOGIC ĐỔI MÀU (CẬP NHẬT) ---
    // 1. Khi người dùng tự chọn màu
    if (colorPicker) {
        colorPicker.addEventListener("input", (e) => {
            visualColor = e.target.value;
        });
    }

    // 2. Khi chọn Theme có sẵn (Đồng bộ với ô chọn màu)
    themeSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "blue") visualColor = "#00c6ff";
        else if (val === "purple") visualColor = "#bc4e9c";
        else visualColor = "#ff416c"; // red

        if (colorPicker) colorPicker.value = visualColor;
    });

    /* =========================================
       4. AUDIO SETUP
    ========================================= */
    async function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.85;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            source = audioCtx.createMediaElementSource(audioEl);
            source.connect(analyser); analyser.connect(audioCtx.destination);
        }
        if (audioCtx.state === "suspended") await audioCtx.resume();
    }

    /* =========================================
       5. KARAOKE HTML LOGIC (CHỮ TRÔI)
    ========================================= */
    function renderKaraokeHTML() {
        karaokeBox.innerHTML = "";
        if (lyrics.length === 0) {
            karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">...</div>';
            return;
        }
        const spacer = document.createElement("div"); spacer.style.height = "130px"; karaokeBox.appendChild(spacer);
        lyrics.forEach((line, index) => {
            const p = document.createElement("div"); p.className = "lyric-line"; p.id = `line-${index}`; p.innerText = line.text;
            karaokeBox.appendChild(p);
        });
        const endSpacer = document.createElement("div"); endSpacer.style.height = "130px"; karaokeBox.appendChild(endSpacer);
    }

    function updateKaraoke(currentTime) {
        if (lyrics.length === 0) return;
        const activeIndex = lyrics.findIndex(l => currentTime >= l.time && currentTime < l.endTime + 0.5);
        const currentActive = karaokeBox.querySelector(".lyric-line.active");
        if (currentActive) currentActive.classList.remove("active");
        if (activeIndex !== -1) {
            const activeLine = document.getElementById(`line-${activeIndex}`);
            if (activeLine) {
                activeLine.classList.add("active");
                activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }

    async function fetchAiLyrics(originalUrl) {
        if (!aiToggle.checked) return;
        lyrics = [];
        karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(🤖 AI đang nghe...)</div>';
        const loadingSpan = document.createElement("span"); loadingSpan.id = "aiMsg"; loadingSpan.style.color = "#aaa"; loadingSpan.style.fontSize = "11px"; loadingSpan.textContent = " (🤖 Đang nghe...)";
        audioName.appendChild(loadingSpan);

        try {
            const res = await fetch(`/api/generate_lyrics?url=${encodeURIComponent(originalUrl)}`);
            const data = await res.json();
            if (document.getElementById("aiMsg")) document.getElementById("aiMsg").remove();

            if (!data.error) {
                lyrics = data.map(seg => ({ time: seg.start, endTime: seg.end, text: seg.text.trim() }));
                const okSpan = document.createElement("span"); okSpan.style.color = "#0f0"; okSpan.style.fontSize = "11px"; okSpan.textContent = " (✅ Lyric)";
                audioName.appendChild(okSpan); setTimeout(() => okSpan.remove(), 3000);
                renderKaraokeHTML();
            } else {
                karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(Không tạo được Lyric)</div>';
            }
        } catch (e) {
            if (document.getElementById("aiMsg")) document.getElementById("aiMsg").remove();
            karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(Lỗi kết nối AI)</div>';
        }
    }

    /* =========================================
       6. PHÁT NHẠC
    ========================================= */
    async function playTrack(url, title, thumbnail, originalUrl = null, sourceList = "history") {
        currentSongUrl = originalUrl || url; currentPlaySource = sourceList; currentSong = { title, url, thumbnail, originalUrl };
        if (mainAddBtn) mainAddBtn.style.display = "block";
        if (sourceList === "playlist") currentIndex = playlist.findIndex(p => p.title === title);
        else currentIndex = history.findIndex(h => h.title === title);

        audioName.textContent = "⌛ " + title;
        let playUrl = url.startsWith("http") ? `/proxy_audio?url=${encodeURIComponent(url)}` : url;
        audioEl.src = playUrl; audioEl.load();

        try {
            await initAudio(); await audioEl.play();
            audioName.textContent = "🎵 " + title;
            playBtn.style.display = "none"; pauseBtn.style.display = "flex";
            if (thumbnail) { bgDiv.style.backgroundImage = `url("${thumbnail}")`; imgObj.src = thumbnail; }
            if (sourceList === "search" || sourceList === "history") addToHistory(title, url, thumbnail, originalUrl);

            renderLoop(); // Bắt đầu vẽ Visualizer

            // Reset Lyric
            lyrics = [];
            if (karaokeBox) karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">...</div>';

            if (originalUrl && aiToggle.checked) fetchAiLyrics(originalUrl);
            else if (!originalUrl) karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(Nhạc Local - Chưa hỗ trợ AI)</div>';
        } catch (e) { console.error(e); alert("Lỗi phát nhạc!"); }
    }

    audioEl.addEventListener("ended", () => {
        if (isLooping) return;
        let targetList = currentPlaySource === "playlist" ? playlist : history;
        let nextIndex = currentIndex + 1;
        if (nextIndex < targetList.length) {
            const next = targetList[nextIndex];
            playTrack(next.url, next.title, next.thumbnail, next.originalUrl, currentPlaySource);
        } else { playBtn.style.display = "flex"; pauseBtn.style.display = "none"; }
    });

    /* =========================================
       7. VISUALIZER LOOP (ĐÃ DÙNG MÀU TÙY CHỈNH)
    ========================================= */
    function createParticles(w, h) { if (particles.length > 50) return; particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1, alpha: Math.random() * 0.5 + 0.1 }); }
    function drawParticles(ctx, w, h) { ctx.fillStyle = "#fff"; particles.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0; ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1.0; }

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        const W = canvas.width / (window.devicePixelRatio || 1), H = canvas.height / (window.devicePixelRatio || 1), cx = W / 2, cy = H / 2;
        ctx.clearRect(0, 0, W, H);

        createParticles(W, H);
        drawParticles(ctx, W, H);

        let bassScale = 1;
        if (analyser) {
            analyser.getByteFrequencyData(dataArray);
            let bass = 0; for (let i = 0; i < 10; i++)bass += dataArray[i];
            bassScale = 1 + (bass / 2550) * 0.25;
        }

        // --- SỬ DỤNG MÀU TỪ BIẾN visualColor ---
        let color = visualColor;

        if (drawMode === "circle") {
            const r = Math.min(W, H) * 0.18; ctx.save(); ctx.translate(cx, cy); ctx.rotate(performance.now() * 0.0005);
            if (analyser) {
                for (let i = 0; i < 100; i++) {
                    const val = dataArray[i * Math.floor(dataArray.length / 100)];
                    ctx.save(); ctx.rotate((Math.PI * 2 / 100) * i);
                    ctx.fillStyle = color; ctx.shadowBlur = 15; ctx.shadowColor = color;
                    ctx.fillRect(0, r * bassScale + 5, 4, val * 0.8 * bassScale + 2); ctx.restore();
                }
            } else {
                ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2; ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();

            ctx.save(); ctx.translate(cx, cy); ctx.scale(bassScale, bassScale); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
            if (imgObj.src) ctx.drawImage(imgObj, -r, -r, r * 2, r * 2);
            else { ctx.fillStyle = "#222"; ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("♫", 0, 0); }
            ctx.restore();

            ctx.beginPath(); ctx.arc(cx, cy, r * bassScale, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.stroke();
        } else {
            if (analyser) {
                const bw = W / 64;
                for (let i = 0; i < 64; i++) {
                    const h = (dataArray[i * Math.floor(dataArray.length / 64)] / 255) * H * 0.6;
                    ctx.fillStyle = color; ctx.shadowBlur = 10; ctx.shadowColor = color;
                    ctx.fillRect(i * bw, H - h, bw - 2, h);
                }
            }
        }
    }

    // --- CÁC SỰ KIỆN UI KHÁC ---
    function updateSeek(e) { if (!audioEl.duration) return; const r = progressBar.getBoundingClientRect(); let p = (e.clientX - r.left) / r.width; p = Math.max(0, Math.min(1, p)); audioEl.currentTime = p * audioEl.duration; progressFill.style.width = p * 100 + "%"; curTimeEl.textContent = formatTime(audioEl.currentTime); }
    progressBar.addEventListener("mousedown", e => { isDragging = true; updateSeek(e); });
    document.addEventListener("mousemove", e => { if (isDragging) updateSeek(e); });
    document.addEventListener("mouseup", () => isDragging = false);

    audioEl.addEventListener("timeupdate", () => {
        if (!isDragging && audioEl.duration) {
            progressFill.style.width = (audioEl.currentTime / audioEl.duration) * 100 + "%";
            curTimeEl.textContent = formatTime(audioEl.currentTime);
            durTimeEl.textContent = formatTime(audioEl.duration);
        }
        updateKaraoke(audioEl.currentTime);
    });
    function formatTime(t) { if (isNaN(t)) return "00:00"; return `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`; }

    // UI Buttons
    searchBtn.addEventListener("click", async () => { const q = searchInput.value.trim(); if (!q) return; loadingText.style.display = "block"; searchBtn.disabled = true; try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`); const d = await r.json(); if (d.error) alert("Không thấy!"); else playTrack(d.url, d.title, d.thumbnail, d.webpage_url, "search"); } catch (e) { alert("Lỗi mạng!"); } finally { loadingText.style.display = "none"; searchBtn.disabled = false; } });
    searchInput.addEventListener("keypress", e => { if (e.key === "Enter") searchBtn.click(); });
    togglePanelBtn.addEventListener("click", () => sidePanel.classList.add("open")); closePanelBtn.addEventListener("click", () => sidePanel.classList.remove("open")); clearHistoryBtn.addEventListener("click", () => { history = []; localStorage.setItem("musicHistory", "[]"); renderHistory(); });
    playBtn.addEventListener("click", async () => { if (audioEl.src) { await initAudio(); audioEl.play(); playBtn.style.display = "none"; pauseBtn.style.display = "flex"; renderLoop(); } });
    pauseBtn.addEventListener("click", () => { audioEl.pause(); playBtn.style.display = "flex"; pauseBtn.style.display = "none"; });
    loopBtn.addEventListener("click", () => { isLooping = !isLooping; audioEl.loop = isLooping; loopBtn.classList.toggle("active", isLooping); });
    audioInput.addEventListener("change", e => { if (e.target.files[0]) playTrack(URL.createObjectURL(e.target.files[0]), e.target.files[0].name, null, null, "history"); });
    imageInput.addEventListener("change", e => { if (e.target.files[0]) { const u = URL.createObjectURL(e.target.files[0]); bgDiv.style.backgroundImage = `url("${u}")`; imgObj.src = u; } });
    volumeEl.addEventListener("input", e => audioEl.volume = e.target.value);
    speedRange.addEventListener("input", e => { audioEl.playbackRate = e.target.value; speedLabel.textContent = "x" + parseFloat(e.target.value).toFixed(2); });
    modeToggle.addEventListener("click", () => drawMode = drawMode === "circle" ? "bars" : "circle");

    // History & Playlist
    function renderHistory() { historyUl.innerHTML = ""; history.forEach(item => { const li = document.createElement("li"); li.className = "history-item"; const imgHtml = item.thumbnail ? `<img src="${item.thumbnail}">` : `<div>🎵</div>`; li.innerHTML = `<div style="display:flex;align-items:center;flex:1;cursor:pointer;">${imgHtml} <div style="font-size:12px;overflow:hidden;margin-left:5px;">${item.title}</div></div><button class="add-btn" title="Thêm vào Playlist" style="background:none;border:none;color:#0f0;font-size:16px;cursor:pointer;">+</button>`; li.querySelector('div').onclick = () => playTrack(item.url, item.title, item.thumbnail, item.originalUrl, "history"); li.querySelector('.add-btn').onclick = (e) => { e.stopPropagation(); addToPlaylist(item); }; historyUl.appendChild(li); }); }
    function addToHistory(t, u, th, o) { if (history.length > 0 && history[0].title === t) return; history = history.filter(h => h.title !== t); history.unshift({ title: t, url: u, thumbnail: th, originalUrl: o }); if (history.length > 30) history.pop(); localStorage.setItem("musicHistory", JSON.stringify(history)); renderHistory(); }
    function renderPlaylist() { playlistUl.innerHTML = ""; if (playlist.length === 0) { playlistUl.innerHTML = `<li style="color:#777;font-size:12px;text-align:center;padding:10px;">(Trống)</li>`; return; } playlist.forEach((item, index) => { const li = document.createElement("li"); li.className = "history-item"; const imgHtml = item.thumbnail ? `<img src="${item.thumbnail}">` : `<div>🎵</div>`; li.innerHTML = `<div style="display:flex;align-items:center;flex:1;cursor:pointer;"><span style="color:#ffe600;font-size:10px;margin-right:5px;">${index + 1}.</span>${imgHtml} <div style="font-size:12px;overflow:hidden;margin-left:5px;">${item.title}</div></div><button class="del-btn" title="Xóa" style="background:none;border:none;color:#f55;font-size:14px;cursor:pointer;">×</button>`; li.querySelector('div').onclick = () => playTrack(item.url, item.title, item.thumbnail, item.originalUrl, "playlist"); li.querySelector('.del-btn').onclick = (e) => { e.stopPropagation(); removeFromPlaylist(index); }; playlistUl.appendChild(li); }); }
    function addToPlaylist(i) { if (playlist.some(p => p.title === i.title)) return alert("Đã có trong Playlist!"); playlist.push(i); localStorage.setItem("musicPlaylist", JSON.stringify(playlist)); renderPlaylist(); if (event && event.target) { const b = event.target; b.textContent = "✔"; setTimeout(() => b.textContent = "+", 1000); } }
    function removeFromPlaylist(i) { playlist.splice(i, 1); localStorage.setItem("musicPlaylist", JSON.stringify(playlist)); renderPlaylist(); }
    clearPlaylistBtn.addEventListener("click", () => { if (confirm("Xóa hết?")) { playlist = []; localStorage.setItem("musicPlaylist", "[]"); renderPlaylist(); } });
    if (mainAddBtn) mainAddBtn.addEventListener("click", () => { if (currentSong) { addToPlaylist(currentSong); const i = mainAddBtn.querySelector("i"); if (i) { i.className = "fas fa-check"; setTimeout(() => i.className = "fas fa-plus-circle", 1500); } } });

    // Record & Change Voice
    recordBtn.addEventListener("click", () => { if (!analyser) return alert("Phát nhạc trước!"); const s = canvas.captureStream(30), d = audioCtx.createMediaStreamDestination(); source.connect(d); mediaRecorder = new MediaRecorder(new MediaStream([...s.getTracks(), ...d.stream.getTracks()]), { mimeType: 'video/webm' }); recordedChunks = []; mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data) }; mediaRecorder.onstop = () => { const b = new Blob(recordedChunks, { type: 'video/webm' }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `visualizer_${Date.now()}.webm`; a.click(); }; mediaRecorder.start(); recordBtn.style.display = "none"; stopRecordBtn.style.display = "flex"; });
    stopRecordBtn.addEventListener("click", () => { if (mediaRecorder) mediaRecorder.stop(); recordBtn.style.display = "flex"; stopRecordBtn.style.display = "none"; });

    // --- 8. HÀM ĐỔI GIỌNG (NÂNG CẤP: XỬ LÝ NGẦM, KHÔNG DỪNG NHẠC) ---
    window.changeVoice = async function (mode) {
        if (!currentSongUrl || !currentSongUrl.startsWith("http")) return alert("Chỉ hỗ trợ đổi giọng với nhạc Online!");

        // 1. Thông báo đang xử lý (KHÔNG dừng nhạc)
        const msg = document.getElementById("processingMsg");
        if (msg) msg.style.display = "block";

        const oldLabel = audioName.textContent;
        // Chỉ thêm chữ "Đang tách..." nếu chưa có
        if (!audioName.textContent.includes("Đang tách")) {
            audioName.innerHTML += " <span style='color:#ffe600; font-size:12px;'>(⏳ Đang tách nhạc ngầm...)</span>";
        }

        try {
            // 2. Gửi lệnh xử lý ngầm (Background Fetch) - Nhạc vẫn hát ở bước này
            const apiUrl = `/api/process_audio?url=${encodeURIComponent(currentSongUrl)}&mode=${mode}`;
            const response = await fetch(apiUrl);

            if (!response.ok) throw new Error("Lỗi Server");

            // 3. Khi Server làm xong -> Lấy file về
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            // 4. Lưu lại thời gian đang hát dở
            const currentTime = audioEl.currentTime;

            // 5. Chuyển đổi nguồn phát (Chỉ khựng lại 1 chút xíu ở đây để load file mới)
            audioEl.src = audioUrl;
            audioEl.load();
            await initAudio();
            audioEl.currentTime = currentTime; // Tua đến đúng đoạn cũ
            await audioEl.play();

            // Cập nhật giao diện
            if (msg) msg.style.display = "none";
            // Xóa thông báo cũ và thêm thông báo mới
            audioName.innerHTML = oldLabel.replace(" (⏳ Đang tách nhạc ngầm...)", "").split(" (✅")[0] + ` <span style='color:#0f0; font-size:12px;'>(✅ Chế độ: ${mode})</span>`;

            playBtn.style.display = "none";
            pauseBtn.style.display = "flex";
            renderLoop();

        } catch (e) {
            console.error(e);
            alert("Lỗi xử lý! Server đang bận.");
            if (msg) msg.style.display = "none";
            audioName.innerHTML = oldLabel.replace(" (⏳ Đang tách nhạc ngầm...)", "");
        }
    }
    // --- 1. HÀM TẢI NHẠC ĐỀ XUẤT (CÓ LỌC THEO THỂ LOẠI) ---
    async function loadTrendingMusic(type = 'all') {
        const grid = document.getElementById("recommendGrid");
        const loading = document.getElementById("recommendLoading");
        if(!grid) return;

        // Reset lưới và hiện loading khi đổi thể loại
        grid.innerHTML = ""; 
        if(loading) {
            loading.style.display = "block";
            // Đổi chữ loading cho sinh động
            const typeName = type === 'all' ? "HOT" : type.toUpperCase();
            loading.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Đang tìm nhạc <b>${typeName}</b>...`;
        }

        try {
            // Gửi yêu cầu kèm theo loại nhạc (type)
            const res = await fetch(`/api/trending?type=${type}`);
            const songs = await res.json();
            
            if(loading) loading.style.display = "none"; // Tắt loading

            if (songs.error) {
                grid.innerHTML = '<div style="color:#777; font-size:12px; text-align:center; width:100%;">Không tải được nhạc. Thử lại sau!</div>';
                return;
            }

            // Vẽ các ô nhạc
            songs.forEach(song => {
                const card = document.createElement("div");
                card.className = "song-card";
                card.innerHTML = `
                    <img src="${song.thumbnail}" alt="thumb">
                    <div class="song-title">${song.title}</div>
                `;
                
                // Bấm vào là phát ngay
                card.addEventListener("click", () => {
                    playTrack(song.url, song.title, song.thumbnail, song.webpage_url, "trending");
                });

                grid.appendChild(card);
            });

        } catch (e) {
            console.error(e);
            if(loading) loading.innerText = "Lỗi kết nối server.";
        }
    }

    // --- 2. HÀM XỬ LÝ KHI BẤM NÚT CHỌN THỂ LOẠI ---
    // (Gán vào window để HTML gọi được)
    window.filterMusic = function(type, btnElement) {
        // Xóa class active ở tất cả các nút cũ
        document.querySelectorAll('.genre-btn').forEach(btn => btn.classList.remove('active'));
        
        // Thêm class active cho nút vừa bấm (để nó sáng lên)
        btnElement.classList.add('active');
        
        // Gọi hàm tải nhạc mới
        loadTrendingMusic(type);
    }

    // Tự động tải nhạc "Tất cả" khi mới vào web
    loadTrendingMusic('all');
    // Init Views
    renderHistory();
    renderPlaylist();
});