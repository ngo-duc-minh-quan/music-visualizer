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
    // 🔥 HỆ THỐNG ĐĂNG NHẬP / ĐĂNG KÝ
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

    // ============================================================
    // 🔥 XỬ LÝ GỬI OTP VÀ ĐĂNG KÝ
    // ============================================================
    const btnSendOtp = document.getElementById("sendOtpBtn");
    if(btnSendOtp) {
        btnSendOtp.addEventListener("click", async () => {
            const email = document.getElementById("regEmail").value.trim();
            if(!email || !email.includes("@")) {
                return showToast("Vui lòng nhập Email hợp lệ!", "error");
            }
            
            const originalText = btnSendOtp.innerText;
            btnSendOtp.innerText = "Đang gửi...";
            btnSendOtp.disabled = true;
            
            try {
                const res = await fetch('/api/send_otp', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({email: email})
                });
                const data = await res.json();
                
                if(data.success) {
                    showToast(data.message, "success");
                    let countdown = 60;
                    const timer = setInterval(() => {
                        btnSendOtp.innerText = `${countdown}s`;
                        countdown--;
                        if(countdown < 0) {
                            clearInterval(timer);
                            btnSendOtp.innerText = "Gửi lại";
                            btnSendOtp.disabled = false;
                        }
                    }, 1000);
                } else {
                    showToast(data.error, "error");
                    btnSendOtp.innerText = originalText;
                    btnSendOtp.disabled = false;
                }
            } catch(e) {
                showToast("Lỗi mạng! Không thể gửi email.", "error");
                btnSendOtp.innerText = originalText;
                btnSendOtp.disabled = false;
            }
        });
    }

    const btnReg = document.getElementById("submitRegisterBtn");
    if(btnReg) {
        btnReg.addEventListener("click", async () => {
            const email = document.getElementById("regEmail").value.trim();
            const pass = document.getElementById("regPass").value;
            const otp = document.getElementById("regOtp").value.trim();
            
            if(!email || !pass || !otp) {
                return showToast("Vui lòng điền đủ Email, Mật khẩu và OTP!", "error");
            }

            try {
                const res = await fetch('/api/verify_register', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({email: email, password: pass, otp: otp}) 
                });
                const data = await res.json();
                if(data.success) { 
                    showToast(data.message, "success"); 
                    tabLogin.click(); 
                    document.getElementById("loginUser").value = email; // Điền sẵn email cho tiện
                } 
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
                    document.getElementById("authModal").classList.remove("active"); 
                    checkLoginStatus(); 
                } else { showToast(data.error, "error"); }
            } catch(e) { showToast("Lỗi kết nối Server!", "error"); }
        });
    }

    // ============================================================
    // CÁC CHỨC NĂNG PHÁT NHẠC
    // ============================================================
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const loopBtn = document.getElementById("loopBtn");
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
        playBtn.style.display = "none"; 
        pauseBtn.style.display = "flex";
        
        let playUrl = url.startsWith("http") ? `/proxy_audio?url=${encodeURIComponent(url)}` : url;
        audioEl.src = playUrl;
        
        const savedVol = localStorage.getItem('musicVolume');
        if (savedVol !== null) {
            audioEl.volume = parseFloat(savedVol);
            const volInput = document.getElementById("volume");
            if(volInput) volInput.value = savedVol;
            updateVolumeIcon(savedVol);
        }
        
        const speedInput = document.getElementById("speedRange");
        const speedLabel = document.getElementById("speedLabel");
        if(speedInput) {
             speedInput.value = 1;
             audioEl.playbackRate = 1;
             if(speedLabel) speedLabel.textContent = "x1.0";
        }

        const ytVideoBg = document.getElementById("ytVideoBg");
        if (originalUrl && (originalUrl.includes("youtube.com") || originalUrl.includes("youtu.be"))) {
            let videoId = "";
            if (originalUrl.includes("v=")) videoId = originalUrl.split("v=")[1].split("&")[0];
            else if (originalUrl.includes("youtu.be/")) videoId = originalUrl.split("youtu.be/")[1].split("?")[0];
            
            if (videoId && ytVideoBg) {
                ytVideoBg.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&playsinline=1`;
                ytVideoBg.parentElement.style.opacity = 1; 
            }
        } else {
            if (ytVideoBg) { ytVideoBg.src = ""; ytVideoBg.parentElement.style.opacity = 0; } 
        }

        audioEl.load();

        try {
            await initAudio();
            await audioEl.play();
            
            audioName.textContent = "🎵 " + title;
            if (thumbnail) setBgImage(thumbnail);

            if (sourceList === "search" || sourceList === "history") {
                addToHistory(title, url, thumbnail, originalUrl);
            }

            clearLyrics();
            const aiToggle = document.getElementById("aiToggle");
            if (originalUrl) {
                fetchAiLyrics(originalUrl, aiToggle ? aiToggle.checked : false);
            } else {
                fetchAiLyrics(null, false);
            }

            loop(); 

        } catch (e) {
            console.error(e); 
            playBtn.style.display = "flex"; pauseBtn.style.display = "none";
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
            playBtn.style.display = "flex"; pauseBtn.style.display = "none";
        }
    });

    const progressBar = document.getElementById("progressBar") || document.getElementById("seek");
    const progressFill = document.getElementById("progressFill"); 

    if (progressBar) {
        const handleSeek = (e) => {
            if (!audioEl.duration) return;
            const rect = progressBar.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let percent = (clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));
            
            audioEl.currentTime = percent * audioEl.duration;
            if(progressFill) progressFill.style.width = (percent * 100) + "%";
        };

        progressBar.addEventListener("mousedown", (e) => { isDragging = true; handleSeek(e); });
        document.addEventListener("mousemove", (e) => { if (isDragging) handleSeek(e); });
        document.addEventListener("mouseup", () => { isDragging = false; });
        progressBar.addEventListener("touchstart", (e) => { isDragging = true; handleSeek(e); });
        document.addEventListener("touchmove", (e) => { if (isDragging) handleSeek(e); });
        document.addEventListener("touchend", () => { isDragging = false; });
    }

    audioEl.addEventListener("timeupdate", () => {
        if (!isDragging && audioEl.duration) {
            const percent = (audioEl.currentTime / audioEl.duration) * 100;
            if(progressFill) progressFill.style.width = percent + "%";
            
            const curTimeEl = document.getElementById("currentTime");
            const durTimeEl = document.getElementById("duration");
            if(curTimeEl) curTimeEl.textContent = formatTime(audioEl.currentTime);
            if(durTimeEl) durTimeEl.textContent = formatTime(audioEl.duration);
        }
        updateKaraoke(audioEl.currentTime);
    });

    const speedInput = document.getElementById("speedRange"); 
    const speedLabel = document.getElementById("speedLabel"); 

    if (speedInput) {
        speedInput.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            audioEl.playbackRate = val; 
            if (speedLabel) {
                const displayVal = Number.isInteger(val) ? val + ".0" : val;
                speedLabel.textContent = "x" + displayVal;
            }
        });
        speedInput.addEventListener("dblclick", () => {
            speedInput.value = 1;
            audioEl.playbackRate = 1;
            if (speedLabel) speedLabel.textContent = "x1.0";
        });
    }

    const volumeSlider = document.getElementById('volume');
    const volumeIcon = document.getElementById('volumeIcon');

    if (volumeSlider) {
        const savedVol = localStorage.getItem('musicVolume') || 1;
        volumeSlider.value = savedVol;
        audioEl.volume = savedVol;
        updateVolumeIcon(savedVol);

        volumeSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            audioEl.volume = val;
            localStorage.setItem('musicVolume', val);
            updateVolumeIcon(val);
        });

        if(volumeIcon) {
            volumeIcon.addEventListener('click', () => {
                if (audioEl.volume > 0) {
                    audioEl.dataset.prevVol = audioEl.volume;
                    audioEl.volume = 0;
                    volumeSlider.value = 0;
                } else {
                    const prev = audioEl.dataset.prevVol || 1;
                    audioEl.volume = prev;
                    volumeSlider.value = prev;
                }
                updateVolumeIcon(audioEl.volume);
            });
        }
    }

    const bassSlider = document.getElementById("bassSlider");
    const trebleSlider = document.getElementById("trebleSlider");

    if (bassSlider) {
        bassSlider.addEventListener("input", (e) => { setBass(parseFloat(e.target.value)); });
        bassSlider.addEventListener("change", (e) => {
            const val = parseFloat(e.target.value);
            if (val > 0) showToast(`Tăng Bass: +${val}dB 🥁`, "success");
            else if (val < 0) showToast(`Giảm Bass: ${val}dB`, "warning");
            else showToast("Bass cân bằng (0dB)", "success");
        });
        bassSlider.addEventListener("dblclick", () => { bassSlider.value = 0; setBass(0); showToast("Bass cân bằng (0dB)", "success"); });
    }

    if (trebleSlider) {
        trebleSlider.addEventListener("input", (e) => { setTreble(parseFloat(e.target.value)); });
        trebleSlider.addEventListener("change", (e) => {
            const val = parseFloat(e.target.value);
            if (val > 0) showToast(`Tăng Treble: +${val}dB 🎸`, "success");
            else if (val < 0) showToast(`Giảm Treble: ${val}dB`, "warning");
            else showToast("Treble cân bằng (0dB)", "success");
        });
        trebleSlider.addEventListener("dblclick", () => { trebleSlider.value = 0; setTreble(0); showToast("Treble cân bằng (0dB)", "success"); });
    }

    playBtn.addEventListener("click", async () => { if(audioEl.src) { await initAudio(); audioEl.play(); playBtn.style.display="none"; pauseBtn.style.display="flex"; loop(); } });
    pauseBtn.addEventListener("click", () => { audioEl.pause(); playBtn.style.display="flex"; pauseBtn.style.display="none"; });
    
    loopBtn.addEventListener("click", () => {
        isLooping = !isLooping;
        audioEl.loop = isLooping;
        loopBtn.classList.toggle("active", isLooping);
        loopBtn.style.color = isLooping ? "#ff416c" : "#fff";
        showToast(isLooping ? "Bật Lặp lại bài 🔁" : "Tắt Lặp lại ➡️");
    });

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
            // 🔥 NÂNG CẤP BỎ ALERT MẶC ĐỊNH
            if (d.error) {
                showToast("Không tìm thấy bài hát!", "error");
            } else {
                window.playTrackGlobal(d.url, d.title, d.thumbnail, d.webpage_url, "search");
            }
        } catch (e) { 
            // 🔥 NÂNG CẤP BỎ ALERT MẶC ĐỊNH
            showToast("Lỗi kết nối mạng! Vui lòng thử lại.", "error"); 
        } 
        finally { loadingText.style.display = "none"; searchBtn.disabled = false; }
    });
    searchInput.addEventListener("keypress", e => { if (e.key === "Enter") searchBtn.click(); });

    const colorPicker = document.getElementById("colorPicker");
    if(colorPicker) colorPicker.addEventListener("input", (e) => {
        if(!window.isPartyMode) setVisualColor(e.target.value);
    });
    
    const themeSelect = document.getElementById("themeSelect");
    if(themeSelect) {
        themeSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            const color = val === "blue" ? "#00c6ff" : (val === "purple" ? "#bc4e9c" : "#ff416c");
            if(!window.isPartyMode) setVisualColor(color);
            if(colorPicker) colorPicker.value = color;
        });
    }

    const audioFileInput = document.getElementById("audioFile");
    if(audioFileInput) {
        audioFileInput.addEventListener("change", e => { 
            if (e.target.files[0]) window.playTrackGlobal(URL.createObjectURL(e.target.files[0]), e.target.files[0].name, null, null, "history"); 
        });
    }

    const lrcFileInput = document.getElementById("lrcFile");
    if(lrcFileInput) {
        lrcFileInput.addEventListener("change", e => { 
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => { parseLRC(evt.target.result); };
            reader.readAsText(file);
        });
    }

    const imageFileInput = document.getElementById("imageFile");
    if(imageFileInput) {
        imageFileInput.addEventListener("change", e => { 
            if (e.target.files[0]) setBgImage(URL.createObjectURL(e.target.files[0])); 
        });
    }

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
        btn.classList.add('active');
        loadTrendingMusic(type);
    };

    const sleepTimerBtn = document.getElementById("sleepTimerBtn");
    let sleepTimer = null;
    let sleepMinutes = 0;
    
    if (sleepTimerBtn) {
        sleepTimerBtn.addEventListener("click", () => {
            if (sleepMinutes === 0) sleepMinutes = 15;
            else if (sleepMinutes === 15) sleepMinutes = 30;
            else if (sleepMinutes === 30) sleepMinutes = 60;
            else sleepMinutes = 0;

            if (sleepTimer) clearTimeout(sleepTimer);

            if (sleepMinutes === 0) {
                sleepTimerBtn.innerHTML = '<i class="fas fa-moon"></i>';
                sleepTimerBtn.style.color = "";
                sleepTimerBtn.style.textShadow = "none";
                showToast("Đã TẮT hẹn giờ ngủ 🌙", "warning");
            } else {
                sleepTimerBtn.innerHTML = `<span style="font-size:12px;font-weight:bold;font-family:monospace;">${sleepMinutes}m</span>`;
                sleepTimerBtn.style.color = "#00c6ff"; 
                sleepTimerBtn.style.textShadow = "0 0 10px #00c6ff";
                showToast(`Đã BẬT hẹn giờ tắt nhạc sau ${sleepMinutes} phút ⏳`, "success");
                
                sleepTimer = setTimeout(() => {
                    audioEl.pause();
                    playBtn.style.display = "flex";
                    pauseBtn.style.display = "none";
                    sleepMinutes = 0;
                    sleepTimerBtn.innerHTML = '<i class="fas fa-moon"></i>';
                    sleepTimerBtn.style.color = "";
                    sleepTimerBtn.style.textShadow = "none";
                    showToast("Đã dừng nhạc theo hẹn giờ! Chúc ngủ ngon 💤", "success");
                }, sleepMinutes * 60000); 
            }
        });
    }

    const partyModeBtn = document.getElementById("partyModeBtn");
    const partyColorSelect = document.getElementById("partyColorSelect");
    const partyGroup = document.querySelector(".party-group");
    
    window.isPartyMode = false;
    window.partyColors = [];
    let originalColor = "#ff416c"; 

    const colorPalettes = {
        "3": ["#ff0000", "#00ff00", "#0000ff"], 
        "4": ["#00ffff", "#ff00ff", "#ffff00", "#ff416c"], 
        "5": ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff"], 
        "7": ["#ff416c", "#00c6ff", "#00ff00", "#ffe600", "#bc4e9c", "#ff00ff", "#00ffff"] 
    };

    function startParty() {
        const selectedValue = partyColorSelect ? partyColorSelect.value : "7";
        const currentPalette = colorPalettes[selectedValue] || colorPalettes["7"];

        if (partyGroup) partyGroup.classList.add("active");
        showToast(`Bật chế độ Party ${selectedValue} màu 🌈`, "success");
        
        window.isPartyMode = true;
        window.partyColors = currentPalette;
    }

    function stopParty() {
        window.isPartyMode = false;
        window.partyColors = [];

        if (partyGroup) partyGroup.classList.remove("active");
        showToast("Đã TẮT chế độ Party 🪄", "warning");

        setVisualColor(originalColor);
        const colorPickerEl = document.getElementById("colorPicker");
        if(colorPickerEl) {
            colorPickerEl.value = originalColor;
        }
    }

    if (partyModeBtn) {
        partyModeBtn.addEventListener("click", () => {
            if (!window.isPartyMode) {
                const colorPickerEl = document.getElementById("colorPicker");
                if (colorPickerEl) originalColor = colorPickerEl.value;
                startParty();
            } else {
                stopParty();
            }
        });

        if(partyColorSelect) {
            partyColorSelect.addEventListener("change", () => {
                if (window.isPartyMode) startParty();
            });
        }
    }

    // ============================================================
    // 🔥 CHỨC NĂNG MỚI: HỆ THỐNG PHÍM TẮT (KEYBOARD SHORTCUTS)
    // ============================================================
    document.addEventListener('keydown', (e) => {
        if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 

        if(e.code === 'Space') { 
            e.preventDefault(); 
            if(audioEl.paused && audioEl.src) playBtn.click(); else if(!audioEl.paused) pauseBtn.click(); 
        }
        if(e.code === 'ArrowRight' && audioEl.src) { 
            audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5); 
            showToast("Tua tới 5s ⏩");
        }
        if(e.code === 'ArrowLeft' && audioEl.src) { 
            audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); 
            showToast("Tua lùi 5s ⏪");
        }
        if(e.key.toLowerCase() === 'm') { if(volumeIcon) volumeIcon.click(); }
        if(e.key.toLowerCase() === 'l') { if(loopBtn) loopBtn.click(); }
    });

    function showVoiceConfirm(mode, applyCallback, cancelCallback) {
        const modal = document.getElementById("customModal");
        const titleEl = modal.querySelector(".modal-title");
        const iconEl = modal.querySelector(".modal-icon");
        const msgEl = document.getElementById("modalMessage");
        const btnCancel = document.getElementById("btnCancel");
        const btnConfirm = document.getElementById("btnConfirm");

        const origTitle = titleEl.textContent;
        const origIcon = iconEl.textContent;
        const origBtnCancel = btnCancel.textContent;
        const origBtnConfirm = btnConfirm.textContent;

        titleEl.textContent = "Xử lý thành công!";
        iconEl.textContent = mode === 'original' ? "🎧" : "🎤";
        msgEl.innerHTML = `Nhạc đã chuyển sang chế độ <b>${mode.toUpperCase()}</b>.<br><br>Bạn có muốn áp dụng và phát lại bài hát từ đầu không?`;
        btnCancel.textContent = "Bỏ qua";
        btnConfirm.textContent = "Áp dụng ngay";

        modal.classList.add("active");

        const close = () => {
            modal.classList.remove("active");
            setTimeout(() => {
                titleEl.textContent = origTitle;
                iconEl.textContent = origIcon;
                btnCancel.textContent = origBtnCancel;
                btnConfirm.textContent = origBtnConfirm;
            }, 300); 
            btnCancel.onclick = null;
            btnConfirm.onclick = null;
        };

        btnCancel.onclick = () => { close(); if(cancelCallback) cancelCallback(); };
        btnConfirm.onclick = () => { close(); if(applyCallback) applyCallback(); };
    }

    function showEarlyWarning(title, message, confirmCallback) {
        const modal = document.getElementById("customModal");
        const titleEl = modal.querySelector(".modal-title");
        const iconEl = modal.querySelector(".modal-icon");
        const msgEl = document.getElementById("modalMessage");
        const btnCancel = document.getElementById("btnCancel");
        const btnConfirm = document.getElementById("btnConfirm");

        const origTitle = titleEl.textContent;
        const origIcon = iconEl.textContent;
        const origBtnCancel = btnCancel.textContent;
        const origBtnConfirm = btnConfirm.textContent;

        titleEl.textContent = title;
        iconEl.textContent = "⚠️";
        msgEl.innerHTML = message;
        btnCancel.textContent = "Hủy bỏ";
        btnConfirm.textContent = "Vẫn tách nhạc";

        modal.classList.add("active");

        const close = () => {
            modal.classList.remove("active");
            setTimeout(() => {
                titleEl.textContent = origTitle;
                iconEl.textContent = origIcon;
                btnCancel.textContent = origBtnCancel;
                btnConfirm.textContent = origBtnConfirm;
            }, 300); 
            btnCancel.onclick = null;
            btnConfirm.onclick = null;
        };

        btnCancel.onclick = () => close(); 
        btnConfirm.onclick = () => { close(); if(confirmCallback) confirmCallback(); };
    }

    window.changeVoice = async function(mode) {
        // 🔥 NÂNG CẤP BỎ ALERT MẶC ĐỊNH
        if (!currentSongUrl || !currentSongUrl.startsWith("http")) {
            return showToast("Chỉ hỗ trợ tách/chỉnh nhạc Online!", "warning");
        }
        
        const startProcessing = async () => {
            const msg = document.getElementById("processingMsg");
            if(msg) {
                if (mode === '8d' || mode === 'reverb') {
                    msg.innerHTML = "⏳ Đang mix hiệu ứng âm thanh (khoảng 3-5 giây)...";
                } else {
                    msg.innerHTML = "⏳ AI đang xử lý tách nhạc (1-2 phút)...";
                }
                msg.style.display = "block";
            }
            
            const cleanLabel = audioName.textContent.replace(/\s*\(⏳ Đang tách...\)/g, "").replace(/\s*\(✅.*?\)/g, "");
            
            if(!audioName.textContent.includes("Đang tách")) {
                audioName.innerHTML = cleanLabel + " <span style='color:#ffe600;font-size:12px;'>(⏳ Đang xử lý...)</span>";
            }

            try {
                const res = await fetch(`/api/process_audio?url=${encodeURIComponent(currentSongUrl)}&mode=${mode}`);
                if (!res.ok) throw new Error("Lỗi Server");
                const blob = await res.blob();
                const audioUrl = URL.createObjectURL(blob);
                
                if(msg) msg.style.display = "none";

                showVoiceConfirm(mode, 
                    async () => {
                        audioEl.src = audioUrl; 
                        audioEl.load();
                        await initAudio();
                        
                        const karaokeContainer = document.getElementById("karaoke-container");
                        const lyricsContent = document.getElementById("lyrics-content");
                        
                        if (karaokeContainer) {
                            const hasLyrics = lyricsContent && lyricsContent.querySelectorAll(".lyric-line").length > 0;
                            
                            if (mode === "karaoke" && hasLyrics) {
                                karaokeContainer.style.display = "flex"; 
                            } else {
                                karaokeContainer.style.display = "none"; 
                            }
                        }
                        
                        if (lyricsContent) {
                            lyricsContent.scrollTop = 0; 
                            const currentActive = lyricsContent.querySelector(".lyric-line.active");
                            if (currentActive) {
                                currentActive.classList.remove("active");
                                currentActive.classList.add("blur");
                            }
                        }

                        audioEl.currentTime = 0; 
                        await audioEl.play();

                        audioName.innerHTML = cleanLabel + ` <span style='color:#0f0;font-size:12px;'>(✅ ${mode})</span>`;
                        playBtn.style.display = "none"; 
                        pauseBtn.style.display = "flex";
                        loop(); 
                    },
                    () => {
                        audioName.innerHTML = cleanLabel; 
                    }
                );

            } catch (e) { 
                // 🔥 NÂNG CẤP BỎ ALERT MẶC ĐỊNH
                showToast("Lỗi trong quá trình xử lý âm thanh!", "error"); 
                if(msg) msg.style.display = "none"; 
                audioName.innerHTML = cleanLabel; 
            } 
        };

        if (mode === "karaoke") {
            const msgSpan = document.getElementById("lyricStatusMsg");
            const lyricsContent = document.getElementById("lyrics-content");
            
            let isFailed = false;
            let isLoading = false;

            if (msgSpan) {
                const text = msgSpan.innerText;
                if (text.includes("Không tìm thấy") || text.includes("Lỗi") || text.includes("Offline")) isFailed = true;
                if (text.includes("Đang tải")) isLoading = true;
            }

            if (lyricsContent) {
                const lines = lyricsContent.querySelectorAll(".lyric-line");
                if (lines.length === 0 && !isLoading) isFailed = true; 
                for (let line of lines) {
                    if (line.innerText.includes("❌") || line.innerText.includes("Không thể")) isFailed = true;
                }
            }

            if (isFailed) {
                showEarlyWarning(
                    "Không có lời bài hát!", 
                    "Bài hát này là Nhạc Offline (hoặc AI bị lỗi).<br><br>Quá trình tách lấy Beat Karaoke sẽ mất 1-2 phút. Bạn có muốn tiếp tục tách để lấy Beat không?",
                    startProcessing
                );
                return; 
            }

            if (isLoading) {
                showEarlyWarning(
                    "Đang tải lời ngầm!", 
                    "Hệ thống vẫn đang phân tích lời bài hát.<br><br>Bạn có muốn bỏ qua và tiến hành tách nhạc Beat luôn không?",
                    startProcessing
                );
                return; 
            }
        }

        startProcessing();
    };
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