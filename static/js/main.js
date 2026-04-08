/* --- static/js/main.js --- */
import { initVisualizer, renderFrame, setVisualColor, setBgImage } from './visualizer.js';
import { initAudio, audioEl, analyser, dataArray, startRecording, setBass, setTreble } from './audio.js';
import { fetchAiLyrics, clearLyrics, updateKaraoke, parseLRC } from './lyrics.js';
import { renderHistory, renderPlaylist, loadTrendingMusic, addToHistory, addToPlaylist, clearPlaylist, clearHistory, getHistoryData, getPlaylistData } from './playlist.js';

let isLooping = false;
let currentSongUrl = "";
let currentPlaySource = "history"; 
let currentSong = null; 
let isDragging = false; 

document.addEventListener("DOMContentLoaded", () => {
    initVisualizer();
    renderHistory();
    renderPlaylist();
    loadTrendingMusic('all');
    
    // ============================================================
    // 🔥 HỆ THỐNG ĐĂNG NHẬP / ĐĂNG KÝ / FIREBASE
    // ============================================================
    const authModal = document.getElementById("authModal");
    const openAuthBtn = document.getElementById("openAuthBtn");
    const closeAuthBtn = document.getElementById("closeAuthBtn");
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const loginFormBlock = document.getElementById("loginFormBlock");
    const registerFormBlock = document.getElementById("registerFormBlock");
    
    if (openAuthBtn) openAuthBtn.addEventListener("click", () => authModal.classList.add("active"));
    if (closeAuthBtn) closeAuthBtn.addEventListener("click", () => authModal.classList.remove("active"));
    
    if (tabLogin) tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active"); tabRegister.classList.remove("active");
        loginFormBlock.style.display = "block"; registerFormBlock.style.display = "none";
    });
    if (tabRegister) tabRegister.addEventListener("click", () => {
        tabRegister.classList.add("active"); tabLogin.classList.remove("active");
        registerFormBlock.style.display = "block"; loginFormBlock.style.display = "none";
    });

    async function checkLoginStatus() {
        try {
            const res = await fetch('/api/user_info');
            const data = await res.json();
            const userSection = document.getElementById("userAuthSection");
            if (!userSection) return;

            if (data.logged_in) {
                const displayName = data.username.split('@')[0];
                userSection.innerHTML = `
                    <div class="user-profile" title="Nhấn để Đăng xuất" style="cursor:pointer;" id="logoutBtn">
                        <div class="user-avatar">${displayName.charAt(0).toUpperCase()}</div>
                        <span style="color:#fff; font-size:13px; font-weight:bold;">${displayName}</span>
                    </div>
                `;
                
                document.getElementById("logoutBtn").addEventListener("click", () => {
                    const modal = document.getElementById("customModal");
                    if (modal) {
                        const titleEl = modal.querySelector(".modal-title");
                        const iconEl = modal.querySelector(".modal-icon");
                        const msgEl = document.getElementById("modalMessage");
                        const btnCancel = document.getElementById("btnCancel");
                        const btnConfirm = document.getElementById("btnConfirm");

                        const origTitle = titleEl.textContent;
                        const origIcon = iconEl ? iconEl.textContent : "";
                        const origBtnCancel = btnCancel.textContent;
                        const origBtnConfirm = btnConfirm.textContent;

                        titleEl.textContent = "Xác nhận Đăng xuất";
                        if (iconEl) iconEl.textContent = "🚪";
                        msgEl.innerHTML = `Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <b>${displayName}</b> không?`;
                        btnCancel.textContent = "Trở lại";
                        btnConfirm.textContent = "Đăng xuất ngay";

                        modal.classList.add("active");

                        const close = () => {
                            modal.classList.remove("active");
                            setTimeout(() => {
                                titleEl.textContent = origTitle;
                                if (iconEl) iconEl.textContent = origIcon;
                                btnCancel.textContent = origBtnCancel;
                                btnConfirm.textContent = origBtnConfirm;
                            }, 300); 
                            btnCancel.onclick = null;
                            btnConfirm.onclick = null;
                        };

                        btnCancel.onclick = () => close();
                        btnConfirm.onclick = async () => {
                            close();
                            await fetch('/api/logout', {method: 'POST'});
                            showToast("Đã đăng xuất an toàn!", "warning");
                            checkLoginStatus(); 
                        };
                    }
                });
            } else {
                userSection.innerHTML = `<button id="openAuthBtn" class="btn-mode" style="background: linear-gradient(45deg, #ff416c, #ff8b41); border:none; font-weight:bold; margin:0;"><i class="fas fa-user-circle"></i> Đăng nhập</button>`;
                document.getElementById("openAuthBtn").addEventListener("click", () => {
                    const am = document.getElementById("authModal");
                    if(am) am.classList.add("active");
                });
            }
        } catch(e) { console.log(e); }
    }
    checkLoginStatus(); 

    const firebaseConfig = {
        apiKey: "AIzaSy_DAY_LA_API_KEY_CUA_BAN",
        authDomain: "ten-project-cua-ban.firebaseapp.com",
        projectId: "ten-project-cua-ban"
    };

    let auth, googleProvider, fbProvider;
    if(window.firebaseModules) {
        const app = window.firebaseModules.initializeApp(firebaseConfig);
        auth = window.firebaseModules.getAuth(app);
        googleProvider = new window.firebaseModules.GoogleAuthProvider();
        fbProvider = new window.firebaseModules.FacebookAuthProvider();
    }

    const handleSocialLogin = async (provider) => {
        if(!auth) return showToast("Chưa kết nối API Mạng xã hội!", "warning");
        try {
            const result = await window.firebaseModules.signInWithPopup(auth, provider);
            const user = result.user;
            const res = await fetch('/api/social_login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email: user.email, name: user.displayName })
            });
            const data = await res.json();
            if(data.success) {
                showToast(data.message, "success");
                document.getElementById("authModal").classList.remove("active");
                checkLoginStatus(); 
            } else showToast(data.error, "error");
        } catch (error) { showToast("Đăng nhập thất bại hoặc bị hủy bỏ!", "error"); }
    };

    document.getElementById("btnGoogleLogin")?.addEventListener("click", () => handleSocialLogin(googleProvider));
    document.getElementById("btnFacebookLogin")?.addEventListener("click", () => handleSocialLogin(fbProvider));

    const btnSendOtp = document.getElementById("sendOtpBtn");
    if(btnSendOtp) {
        btnSendOtp.addEventListener("click", async () => {
            const email = document.getElementById("regEmail").value.trim();
            if(!email || !email.includes("@")) return showToast("Vui lòng nhập Email hợp lệ!", "error");
            const originalText = btnSendOtp.innerText;
            btnSendOtp.innerText = "Đang gửi...";
            btnSendOtp.disabled = true;
            try {
                const res = await fetch('/api/send_otp', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: email}) });
                const data = await res.json();
                if(data.success) {
                    showToast(data.message, "success");
                    let countdown = 60;
                    const timer = setInterval(() => {
                        btnSendOtp.innerText = `${countdown}s`;
                        countdown--;
                        if(countdown < 0) { clearInterval(timer); btnSendOtp.innerText = "Gửi lại"; btnSendOtp.disabled = false; }
                    }, 1000);
                } else { showToast(data.error, "error"); btnSendOtp.innerText = originalText; btnSendOtp.disabled = false; }
            } catch(e) { showToast("Lỗi mạng! Không thể gửi email.", "error"); btnSendOtp.innerText = originalText; btnSendOtp.disabled = false; }
        });
    }

    const btnReg = document.getElementById("submitRegisterBtn");
    if(btnReg) {
        btnReg.addEventListener("click", async () => {
            const email = document.getElementById("regEmail").value.trim();
            const pass = document.getElementById("regPass").value;
            const otp = document.getElementById("regOtp").value.trim();
            if(!email || !pass || !otp) return showToast("Vui lòng điền đủ Email, Mật khẩu và OTP!", "error");
            try {
                const res = await fetch('/api/verify_register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: email, password: pass, otp: otp}) });
                const data = await res.json();
                if(data.success) { showToast(data.message, "success"); tabLogin.click(); document.getElementById("loginUser").value = email; } 
                else { showToast(data.error, "error"); }
            } catch(e) { showToast("Lỗi kết nối Server!", "error"); }
        });
    }

    const btnLogin = document.getElementById("submitLoginBtn");
    if(btnLogin) {
        btnLogin.addEventListener("click", async () => {
            const u = document.getElementById("loginUser").value.trim();
            const p = document.getElementById("loginPass").value;
            try {
                const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p}) });
                const data = await res.json();
                if(data.success) {
                    showToast(data.message, "success");
                    document.getElementById("authModal").classList.remove("active"); checkLoginStatus(); 
                } else { showToast(data.error, "error"); }
            } catch(e) { showToast("Lỗi kết nối Server!", "error"); }
        });
    }

    // ============================================================
    // 🔍 MODULE: AUTOCOMPLETE SEARCH (DEBOUNCE 400MS)
    // ============================================================
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    const loadingText = document.getElementById("loadingText");
    const suggestBox = document.getElementById("searchSuggestions");
    let debounceTimer;
    let suggestIndex = -1;

    if(searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            const q = e.target.value.trim();
            suggestIndex = -1; 
            if (!q) { suggestBox.style.display = "none"; return; }
            debounceTimer = setTimeout(async () => {
                try {
                    const r = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
                    const data = await r.json();
                    if (data.length > 0) {
                        suggestBox.innerHTML = data.map((item, idx) => `<div class="suggest-item" data-index="${idx}"><i class="fas fa-search" style="margin-right:10px; color:#777;"></i>${item}</div>`).join('');
                        suggestBox.style.display = "block";
                        suggestBox.querySelectorAll(".suggest-item").forEach(el => {
                            el.addEventListener("click", () => {
                                searchInput.value = el.innerText.trim();
                                suggestBox.style.display = "none";
                                searchBtn.click();
                            });
                        });
                    } else suggestBox.style.display = "none";
                } catch(err) { console.error("Lỗi lấy gợi ý:", err); }
            }, 400); 
        });

        searchInput.addEventListener("keydown", (e) => {
            const items = suggestBox.querySelectorAll(".suggest-item");
            if (suggestBox.style.display === "none" || items.length === 0) {
                if (e.key === "Enter") searchBtn.click(); return;
            }
            if (e.key === "ArrowDown") { e.preventDefault(); suggestIndex = (suggestIndex + 1) % items.length; updateSuggestHighlight(items); } 
            else if (e.key === "ArrowUp") { e.preventDefault(); suggestIndex = (suggestIndex - 1 + items.length) % items.length; updateSuggestHighlight(items); } 
            else if (e.key === "Enter") { e.preventDefault(); if (suggestIndex >= 0) items[suggestIndex].click(); else searchBtn.click(); }
        });
    }

    function updateSuggestHighlight(items) {
        items.forEach(el => el.classList.remove("active"));
        if (suggestIndex >= 0) {
            items[suggestIndex].classList.add("active");
            items[suggestIndex].scrollIntoView({block: "nearest"});
            searchInput.value = items[suggestIndex].innerText.trim(); 
        }
    }

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-box") && suggestBox) suggestBox.style.display = "none";
    });

    if(searchBtn) {
        searchBtn.addEventListener("click", async () => {
            const q = searchInput.value.trim();
            if (!q) return;
            if(suggestBox) suggestBox.style.display = "none";
            loadingText.style.display = "block"; searchBtn.disabled = true;
            try {
                const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
                const d = await r.json();
                if (d.error) showToast("Không tìm thấy bài hát!", "error"); 
                else window.playTrackGlobal(d.url, d.title, d.thumbnail, d.webpage_url, "search");
            } catch (e) { showToast("Lỗi kết nối mạng!", "error"); } 
            finally { loadingText.style.display = "none"; searchBtn.disabled = false; }
        });
    }

    // ============================================================
    // 🎵 CÁC CHỨC NĂNG PHÁT NHẠC CƠ BẢN
    // ============================================================
    const audioName = document.getElementById("audioName");

    function loop() {
        requestAnimationFrame(loop);
        renderFrame(analyser, dataArray);
    }

    window.playTrackGlobal = async function(url, title, thumbnail, originalUrl = null, sourceList = "history") {
        currentSongUrl = originalUrl || url; 
        currentPlaySource = sourceList;
        currentSong = { title, url, thumbnail, originalUrl };
        
        const mainAddBtn = document.getElementById("mainAddBtn");
        if(mainAddBtn) mainAddBtn.style.display = "block";

        audioName.textContent = "⌛ " + title;
        window.playBtn.style.display = "none"; 
        window.pauseBtn.style.display = "flex";
        
        let playUrl = url.startsWith("http") ? `/proxy_audio?url=${encodeURIComponent(url)}` : url;
        audioEl.src = playUrl;
        
        const savedVol = localStorage.getItem('musicVolume') || 1;
        audioEl.volume = parseFloat(savedVol);
        const volInput = document.getElementById("volume");
        if(volInput) volInput.value = savedVol;
        updateVolumeIcon(savedVol);
        
        const speedInput = document.getElementById("speedRange");
        const speedLabel = document.getElementById("speedLabel");
        if(speedInput) { speedInput.value = 1; audioEl.playbackRate = 1; if(speedLabel) speedLabel.textContent = "x1.0"; }

        // 🛠️ KỸ SƯ FIX: Kế thừa Volume/Speed ngay khi load nhạc mới bên Youtube Iframe
        if (originalUrl && (originalUrl.includes("youtube.com") || originalUrl.includes("youtu.be"))) {
            let videoId = originalUrl.includes("v=") ? originalUrl.split("v=")[1].split("&")[0] : originalUrl.split("youtu.be/")[1].split("?")[0];
            if (videoId && window.ytPlayer && window.ytPlayer.loadVideoById) {
                if (window.currentAppMode === 'video') {
                    audioEl.pause(); 
                    window.ytPlayer.loadVideoById(videoId);
                    window.ytPlayer.setVolume(audioEl.volume * 100);
                    window.ytPlayer.setPlaybackRate(audioEl.playbackRate || 1);
                } else {
                    window.ytPlayer.cueVideoById(videoId);
                }
            }
        }

        audioEl.load();

        try {
            await initAudio();
            if (window.currentAppMode !== 'video') await audioEl.play();
            
            audioName.textContent = "🎵 " + title;
            if (thumbnail) setBgImage(thumbnail);

            if (sourceList === "search" || sourceList === "history") addToHistory(title, url, thumbnail, originalUrl);

            clearLyrics();
            const aiToggle = document.getElementById("aiToggle");
            if (originalUrl) fetchAiLyrics(originalUrl, aiToggle ? aiToggle.checked : false);
            else fetchAiLyrics(null, false);

            loop(); 

        } catch (e) {
            console.error(e); 
            window.playBtn.style.display = "flex"; window.pauseBtn.style.display = "none";
        }
    };

    audioEl.addEventListener("ended", () => {
        if (isLooping) return;
        const list = currentPlaySource === "playlist" ? getPlaylistData() : getHistoryData();
        const currentIndex = list.findIndex(item => item.title === currentSong.title);
        const nextIndex = currentIndex + 1;
        
        if (nextIndex < list.length) {
            const next = list[nextIndex];
            window.playTrackGlobal(next.url, next.title, next.thumbnail, next.originalUrl, currentPlaySource);
        } else {
            window.playBtn.style.display = "flex"; window.pauseBtn.style.display = "none";
        }
    });

    audioEl.addEventListener("timeupdate", () => {
        if (!isDragging && audioEl.duration && window.currentAppMode !== 'video') {
            const percent = (audioEl.currentTime / audioEl.duration) * 100;
            const progressFill = document.getElementById("progressFill");
            if(progressFill) progressFill.style.width = percent + "%";
            
            const curTimeEl = document.getElementById("currentTime");
            const durTimeEl = document.getElementById("duration");
            if(curTimeEl) curTimeEl.textContent = formatTime(audioEl.currentTime);
            if(durTimeEl) durTimeEl.textContent = formatTime(audioEl.duration);
            updateKaraoke(audioEl.currentTime);
        }
    });

    // ============================================================
    // 🛠️ ĐỒNG BỘ: TỐC ĐỘ, ÂM LƯỢNG, BASS, TREBLE 
    // ============================================================
    const speedInput = document.getElementById("speedRange"); 
    const speedLabel = document.getElementById("speedLabel"); 
    if (speedInput) {
        speedInput.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            audioEl.playbackRate = val; 
            // 🛠️ KỸ SƯ FIX: Cập nhật song song tốc độ cho Video Youtube
            if (window.currentAppMode === 'video' && window.ytPlayer && window.ytPlayer.setPlaybackRate) {
                window.ytPlayer.setPlaybackRate(val);
            }
            if (speedLabel) speedLabel.textContent = "x" + (Number.isInteger(val) ? val + ".0" : val);
        });
        speedInput.addEventListener("dblclick", () => { 
            speedInput.value = 1; 
            audioEl.playbackRate = 1; 
            // 🛠️ KỸ SƯ FIX
            if (window.currentAppMode === 'video' && window.ytPlayer && window.ytPlayer.setPlaybackRate) window.ytPlayer.setPlaybackRate(1);
            if (speedLabel) speedLabel.textContent = "x1.0"; 
        });
    }

    const volumeSlider = document.getElementById('volume');
    const volumeIcon = document.getElementById('volumeIcon');
    if (volumeSlider) {
        const savedVol = localStorage.getItem('musicVolume') || 1;
        volumeSlider.value = savedVol; audioEl.volume = savedVol; updateVolumeIcon(savedVol);

        volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value); 
            audioEl.volume = val;
            
            // 🛠️ KỸ SƯ FIX: Cập nhật song song Âm lượng Video Youtube (thang 100)
            if (window.currentAppMode === 'video' && window.ytPlayer && window.ytPlayer.setVolume) {
                window.ytPlayer.setVolume(val * 100);
            }
            localStorage.setItem('musicVolume', val); 
            updateVolumeIcon(val);
        });

        if(volumeIcon) {
            volumeIcon.addEventListener('click', () => {
                let newVal = 0;
                if (audioEl.volume > 0) { 
                    audioEl.dataset.prevVol = audioEl.volume; newVal = 0; 
                } else { 
                    newVal = parseFloat(audioEl.dataset.prevVol || 1); 
                }
                audioEl.volume = newVal; 
                volumeSlider.value = newVal;
                // 🛠️ KỸ SƯ FIX
                if (window.currentAppMode === 'video' && window.ytPlayer && window.ytPlayer.setVolume) {
                    window.ytPlayer.setVolume(newVal * 100);
                }
                updateVolumeIcon(newVal);
            });
        }
    }

    const bassSlider = document.getElementById("bassSlider");
    const trebleSlider = document.getElementById("trebleSlider");
    if (bassSlider) {
        bassSlider.addEventListener("input", (e) => { 
            // 🛠️ KỸ SƯ FIX: Chặn kéo Bass ở Video Mode
            if (window.currentAppMode === 'video') {
                showToast("Hiệu ứng Bass chỉ hỗ trợ ở chế độ Nghe Nhạc 🎧", "warning");
                bassSlider.value = 0; return;
            }
            setBass(parseFloat(e.target.value)); 
        });
        bassSlider.addEventListener("change", (e) => { 
            if (window.currentAppMode !== 'video') {
                const val = parseFloat(e.target.value); 
                showToast(val > 0 ? `Tăng Bass: +${val}dB 🥁` : (val < 0 ? `Giảm Bass: ${val}dB` : "Bass cân bằng (0dB)"), val > 0 ? "success" : "warning"); 
            }
        });
        bassSlider.addEventListener("dblclick", () => { bassSlider.value = 0; setBass(0); showToast("Bass cân bằng (0dB)", "success"); });
    }
    if (trebleSlider) {
        trebleSlider.addEventListener("input", (e) => { 
            // 🛠️ KỸ SƯ FIX: Chặn kéo Treble ở Video Mode
            if (window.currentAppMode === 'video') {
                showToast("Hiệu ứng Treble chỉ hỗ trợ ở chế độ Nghe Nhạc 🎧", "warning");
                trebleSlider.value = 0; return;
            }
            setTreble(parseFloat(e.target.value)); 
        });
        trebleSlider.addEventListener("change", (e) => { 
            if (window.currentAppMode !== 'video') {
                const val = parseFloat(e.target.value); 
                showToast(val > 0 ? `Tăng Treble: +${val}dB 🎸` : (val < 0 ? `Giảm Treble: ${val}dB` : "Treble cân bằng (0dB)"), val > 0 ? "success" : "warning"); 
            }
        });
        trebleSlider.addEventListener("dblclick", () => { trebleSlider.value = 0; setTreble(0); showToast("Treble cân bằng (0dB)", "success"); });
    }

    const loopBtn = document.getElementById("loopBtn");
    if(loopBtn) {
        loopBtn.addEventListener("click", () => {
            isLooping = !isLooping; audioEl.loop = isLooping;
            loopBtn.classList.toggle("active", isLooping); loopBtn.style.color = isLooping ? "#ff416c" : "#fff";
            showToast(isLooping ? "Bật Lặp lại bài 🔁" : "Tắt Lặp lại ➡️");
        });
    }

    const colorPicker = document.getElementById("colorPicker");
    if(colorPicker) colorPicker.addEventListener("input", (e) => { if(!window.isPartyMode) setVisualColor(e.target.value); });
    
    const themeSelect = document.getElementById("themeSelect");
    if(themeSelect) {
        themeSelect.addEventListener("change", (e) => {
            const val = e.target.value; const color = val === "blue" ? "#00c6ff" : (val === "purple" ? "#bc4e9c" : "#ff416c");
            if(!window.isPartyMode) setVisualColor(color);
            if(colorPicker) colorPicker.value = color;
        });
    }

    document.getElementById("audioFile")?.addEventListener("change", e => { if (e.target.files[0]) window.playTrackGlobal(URL.createObjectURL(e.target.files[0]), e.target.files[0].name, null, null, "history"); });
    document.getElementById("lrcFile")?.addEventListener("change", e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { parseLRC(evt.target.result); }; reader.readAsText(file); });
    document.getElementById("imageFile")?.addEventListener("change", e => { if (e.target.files[0]) setBgImage(URL.createObjectURL(e.target.files[0])); });

    const sidePanel = document.getElementById("sidePanel");
    if(sidePanel) {
        document.getElementById("togglePanelBtn").addEventListener("click", () => sidePanel.classList.add("open"));
        document.getElementById("closePanelBtn").addEventListener("click", () => sidePanel.classList.remove("open"));
        document.getElementById("clearHistory").addEventListener("click", clearHistory);    
        document.getElementById("clearPlaylist").addEventListener("click", clearPlaylist);
        document.getElementById("mainAddBtn").addEventListener("click", () => { if (currentSong) addToPlaylist(currentSong); });
    }

    window.filterMusic = (type, btn) => {
        document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); loadTrendingMusic(type);
    };

    const sleepTimerBtn = document.getElementById("sleepTimerBtn");
    let sleepTimer = null; let sleepMinutes = 0;
    
    if (sleepTimerBtn) {
        sleepTimerBtn.addEventListener("click", () => {
            sleepMinutes = sleepMinutes === 0 ? 15 : (sleepMinutes === 15 ? 30 : (sleepMinutes === 30 ? 60 : 0));
            if (sleepTimer) clearTimeout(sleepTimer);

            if (sleepMinutes === 0) {
                sleepTimerBtn.innerHTML = '<i class="fas fa-moon"></i>'; sleepTimerBtn.style.color = ""; sleepTimerBtn.style.textShadow = "none"; showToast("Đã TẮT hẹn giờ ngủ 🌙", "warning");
            } else {
                sleepTimerBtn.innerHTML = `<span style="font-size:12px;font-weight:bold;font-family:monospace;">${sleepMinutes}m</span>`;
                sleepTimerBtn.style.color = "#00c6ff"; sleepTimerBtn.style.textShadow = "0 0 10px #00c6ff"; showToast(`Đã BẬT hẹn giờ tắt nhạc sau ${sleepMinutes} phút ⏳`, "success");
                sleepTimer = setTimeout(() => {
                    if (window.currentAppMode === 'video' && window.ytPlayer) window.ytPlayer.pauseVideo(); else audioEl.pause();
                    window.playBtn.style.display = "flex"; window.pauseBtn.style.display = "none";
                    sleepMinutes = 0; sleepTimerBtn.innerHTML = '<i class="fas fa-moon"></i>'; sleepTimerBtn.style.color = ""; sleepTimerBtn.style.textShadow = "none";
                    showToast("Đã dừng nhạc theo hẹn giờ! Chúc ngủ ngon 💤", "success");
                }, sleepMinutes * 60000); 
            }
        });
    }

    const partyModeBtn = document.getElementById("partyModeBtn");
    const partyColorSelect = document.getElementById("partyColorSelect");
    const partyGroup = document.querySelector(".party-group");
    window.isPartyMode = false; window.partyColors = []; let originalColor = "#ff416c"; 

    const colorPalettes = {
        "3": ["#ff0000", "#00ff00", "#0000ff"], "4": ["#00ffff", "#ff00ff", "#ffff00", "#ff416c"], 
        "5": ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff"], "7": ["#ff416c", "#00c6ff", "#00ff00", "#ffe600", "#bc4e9c", "#ff00ff", "#00ffff"] 
    };

    function startParty() {
        const val = partyColorSelect ? partyColorSelect.value : "7";
        if (partyGroup) partyGroup.classList.add("active"); showToast(`Bật chế độ Party ${val} màu 🌈`, "success");
        window.isPartyMode = true; window.partyColors = colorPalettes[val] || colorPalettes["7"];
    }

    function stopParty() {
        window.isPartyMode = false; window.partyColors = [];
        if (partyGroup) partyGroup.classList.remove("active"); showToast("Đã TẮT chế độ Party 🪄", "warning");
        setVisualColor(originalColor);
        if(document.getElementById("colorPicker")) document.getElementById("colorPicker").value = originalColor;
    }

    if (partyModeBtn) {
        partyModeBtn.addEventListener("click", () => {
            if (!window.isPartyMode) { if (document.getElementById("colorPicker")) originalColor = document.getElementById("colorPicker").value; startParty(); } 
            else { stopParty(); }
        });
        if(partyColorSelect) partyColorSelect.addEventListener("change", () => { if (window.isPartyMode) startParty(); });
    }

    document.addEventListener('keydown', (e) => {
        if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 
        if(e.code === 'Space') { e.preventDefault(); window.playBtn.style.display === "none" ? window.pauseBtn.click() : window.playBtn.click(); }
        if(e.code === 'ArrowRight') { 
            // 🛠️ KỸ SƯ FIX: Tua phím tắt cho cả Youtube MV
            if (window.currentAppMode === 'video' && window.ytPlayer) window.ytPlayer.seekTo(window.ytPlayer.getCurrentTime() + 5, true);
            else if (audioEl.src) audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5); 
            showToast("Tua tới 5s ⏩"); 
        }
        if(e.code === 'ArrowLeft') { 
            // 🛠️ KỸ SƯ FIX: Tua phím tắt cho cả Youtube MV
            if (window.currentAppMode === 'video' && window.ytPlayer) window.ytPlayer.seekTo(window.ytPlayer.getCurrentTime() - 5, true);
            else if (audioEl.src) audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); 
            showToast("Tua lùi 5s ⏪"); 
        }
        if(e.key.toLowerCase() === 'm' && volumeIcon) volumeIcon.click();
        if(e.key.toLowerCase() === 'l' && loopBtn) loopBtn.click();
    });

    window.changeVoice = async function(mode) {
        if (!currentSongUrl || !currentSongUrl.startsWith("http")) return showToast("Chỉ hỗ trợ tách nhạc Online!", "warning");
        
        // 🛠️ KỸ SƯ FIX: Tự động thoát Video Mode để áp dụng hiệu ứng âm thanh đặc biệt
        if (window.currentAppMode === 'video') {
            showToast("Chuyển về Audio Mode để áp dụng hiệu ứng...", "warning");
            const toggleVideoBtn = document.getElementById("toggleVideoModeBtn");
            if (toggleVideoBtn) toggleVideoBtn.click();
        }

        const msg = document.getElementById("processingMsg");
        if(msg) { msg.innerHTML = (mode === '8d' || mode === 'reverb') ? "⏳ Đang mix hiệu ứng..." : "⏳ AI đang tách nhạc (1-2 phút)..."; msg.style.display = "block"; }
        const cleanLabel = audioName.textContent.replace(/\s*\(⏳.*?\)/g, "").replace(/\s*\(✅.*?\)/g, "");
        if(!audioName.textContent.includes("Đang xử lý")) audioName.innerHTML = cleanLabel + " <span style='color:#ffe600;font-size:12px;'>(⏳ Đang xử lý...)</span>";

        try {
            const res = await fetch(`/api/process_audio?url=${encodeURIComponent(currentSongUrl)}&mode=${mode}`);
            if (!res.ok) throw new Error("Lỗi Server");
            const blob = await res.blob();
            if(msg) msg.style.display = "none";

            audioEl.src = URL.createObjectURL(blob); audioEl.load(); await initAudio();
            const kc = document.getElementById("karaoke-container"), lc = document.getElementById("lyrics-content");
            if (kc) kc.style.display = (mode === "karaoke" && lc && lc.querySelectorAll(".lyric-line").length > 0) ? "flex" : "none";
            if (lc) { lc.scrollTop = 0; const ca = lc.querySelector(".lyric-line.active"); if (ca) { ca.classList.remove("active"); ca.classList.add("blur"); } }
            audioEl.currentTime = 0; await audioEl.play();
            audioName.innerHTML = cleanLabel + ` <span style='color:#0f0;font-size:12px;'>(✅ ${mode})</span>`;
            window.playBtn.style.display = "none"; window.pauseBtn.style.display = "flex"; loop(); 
        } catch (e) { showToast("Lỗi xử lý âm thanh!", "error"); if(msg) msg.style.display = "none"; audioName.innerHTML = cleanLabel; } 
    };

    // ============================================================
    // 🎬 MODULE: YOUTUBE IFRAME API & VIDEO MODE MANAGER
    // ============================================================
    window.ytPlayer = null;
    window.currentAppMode = 'audio'; 

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = function() {
        window.ytPlayer = new YT.Player('ytVideoBg', {
            height: '100%', width: '100%',
            playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'rel': 0, 'showinfo': 0, 'modestbranding': 1 },
            events: {
                'onStateChange': (event) => {
                    if (window.currentAppMode === 'video') {
                        if (event.data === YT.PlayerState.PLAYING) { window.playBtn.style.display = "none"; window.pauseBtn.style.display = "flex"; } 
                        else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) { window.playBtn.style.display = "flex"; window.pauseBtn.style.display = "none"; }
                    }
                }
            }
        });
    };

    const toggleVideoBtn = document.getElementById("toggleVideoModeBtn");
    if(toggleVideoBtn) {
        toggleVideoBtn.addEventListener("click", () => {
            const bgVideo = document.querySelector(".bg-video");
            if (window.currentAppMode === 'audio') {
                window.currentAppMode = 'video';
                toggleVideoBtn.innerHTML = '<i class="fas fa-music"></i> Quay lại Nghe Nhạc';
                toggleVideoBtn.style.background = 'linear-gradient(45deg, #ff416c, #ff8b41)';
                bgVideo.classList.add("video-mode-active");
                const ct = audioEl.currentTime; if (!audioEl.paused) audioEl.pause();
                
                // 🛠️ KỸ SƯ FIX: Nạp cấu hình Volume, Tốc độ, Thời gian ngay khi nhảy qua xem video
                if (window.ytPlayer && window.ytPlayer.seekTo) { 
                    window.ytPlayer.setVolume(audioEl.volume * 100);
                    window.ytPlayer.setPlaybackRate(audioEl.playbackRate || 1);
                    window.ytPlayer.seekTo(ct, true); 
                    window.ytPlayer.playVideo(); 
                }
                showToast("Đã bật Video Mode (Nhạc gốc, Tắt hiệu ứng) 🎬", "success");
            } else {
                window.currentAppMode = 'audio';
                toggleVideoBtn.innerHTML = '<i class="fas fa-tv"></i> Bật Xem MV';
                toggleVideoBtn.style.background = 'linear-gradient(45deg, #00c6ff, #0072ff)';
                bgVideo.classList.remove("video-mode-active");
                if (window.ytPlayer && window.ytPlayer.getPlayerState) { const ytTime = window.ytPlayer.getCurrentTime() || 0; window.ytPlayer.pauseVideo(); audioEl.currentTime = ytTime; }
                audioEl.play(); showToast("Quay lại Audio Mode (Kích hoạt Bass/Treble) 🎧", "success");
            }
        });
    }

    const oldPlayBtn = document.getElementById("playBtn");
    const oldPauseBtn = document.getElementById("pauseBtn");
    const oldPlayClone = oldPlayBtn.cloneNode(true);
    const oldPauseClone = oldPauseBtn.cloneNode(true);
    oldPlayBtn.parentNode.replaceChild(oldPlayClone, oldPlayBtn);
    oldPauseBtn.parentNode.replaceChild(oldPauseClone, oldPauseBtn);
    
    window.playBtn = document.getElementById("playBtn");
    window.pauseBtn = document.getElementById("pauseBtn");

    window.playBtn.addEventListener("click", async () => { 
        if (window.currentAppMode === 'video' && window.ytPlayer) window.ytPlayer.playVideo();
        else if(audioEl.src) { await initAudio(); audioEl.play(); requestAnimationFrame(function renderLoop() { requestAnimationFrame(renderLoop); renderFrame(analyser, dataArray); }); } 
        window.playBtn.style.display="none"; window.pauseBtn.style.display="flex"; 
    });

    window.pauseBtn.addEventListener("click", () => { 
        if (window.currentAppMode === 'video' && window.ytPlayer) window.ytPlayer.pauseVideo(); else audioEl.pause(); 
        window.playBtn.style.display="flex"; window.pauseBtn.style.display="none"; 
    });

    const progressBarDiv = document.getElementById("progressBar");
    if (progressBarDiv) {
        const newProgressBar = progressBarDiv.cloneNode(true);
        progressBarDiv.parentNode.replaceChild(newProgressBar, progressBarDiv);
        const progressFillDiv = document.getElementById("progressFill");

        const handleDualSeek = (e) => {
            const rect = newProgressBar.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            
            // 🛠️ KỸ SƯ FIX: Đồng bộ Seek Bar kéo chuột trên thanh tiến trình
            if (window.currentAppMode === 'video' && window.ytPlayer && window.ytPlayer.getDuration) window.ytPlayer.seekTo(percent * window.ytPlayer.getDuration(), true);
            else if (audioEl.duration) audioEl.currentTime = percent * audioEl.duration;
            
            if(progressFillDiv) progressFillDiv.style.width = (percent * 100) + "%";
        };

        newProgressBar.addEventListener("mousedown", (e) => { isDragging = true; handleDualSeek(e); });
        document.addEventListener("mousemove", (e) => { if (isDragging) handleDualSeek(e); });
        document.addEventListener("mouseup", () => { isDragging = false; });
    }

    setInterval(() => {
        if (window.currentAppMode === 'video' && window.ytPlayer && typeof window.ytPlayer.getPlayerState === 'function') {
            if (window.ytPlayer.getPlayerState() === 1 && !isDragging) {
                const currentTime = window.ytPlayer.getCurrentTime();
                const duration = window.ytPlayer.getDuration();
                if (duration) {
                    const percent = (currentTime / duration) * 100;
                    const fill = document.getElementById("progressFill");
                    if(fill) fill.style.width = percent + "%";
                    const curTimeEl = document.getElementById("currentTime");
                    const durTimeEl = document.getElementById("duration");
                    if(curTimeEl) curTimeEl.textContent = formatTime(currentTime);
                    if(durTimeEl) durTimeEl.textContent = formatTime(duration);
                    updateKaraoke(currentTime);
                }
            }
        }
    }, 250);
});

function formatTime(t) { 
    if (isNaN(t)) return "00:00"; 
    return `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`; 
}

function updateVolumeIcon(val) {
    const icon = document.getElementById('volumeIcon');
    if (!icon) return;
    icon.className = val == 0 ? 'fas fa-volume-mute' : (val < 0.5 ? 'fas fa-volume-down' : 'fas fa-volume-up');
}

// 🛠️ KỸ SƯ FIX LỖI CÚ PHÁP (Syntax Error) BỊ SAI Ở PHIÊN BẢN TRƯỚC
function showToast(message, type = "success") {
    let toast = document.getElementById("customToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "customToast";
        toast.style.position = "fixed"; 
        toast.style.bottom = "100px"; 
        toast.style.left = "50%"; 
        toast.style.transform = "translateX(-50%)";
        toast.style.background = "rgba(0, 0, 0, 0.7)"; 
        toast.style.backdropFilter = "blur(10px)";
        toast.style.border = "1px solid rgba(255,255,255,0.1)"; 
        toast.style.padding = "10px 24px";
        toast.style.borderRadius = "30px"; 
        toast.style.color = "#fff"; 
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "500"; 
        toast.style.zIndex = "9999"; 
        toast.style.opacity = "0";
        toast.style.pointerEvents = "none"; 
        toast.style.transition = "all 0.3s ease";
        document.body.appendChild(toast);
    }
    let color = type === "success" ? "#0f0" : (type === "warning" ? "#ffe600" : "#ff416c");
    toast.innerHTML = `<span style="color:${color}; margin-right:8px;">●</span> ${message}`;
    toast.style.opacity = "1"; 
    toast.style.bottom = "120px"; 
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => { 
        toast.style.opacity = "0"; 
        toast.style.bottom = "100px"; 
    }, 3000);
}