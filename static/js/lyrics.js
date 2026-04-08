/* --- static/js/lyrics.js --- */

let lyrics = [];
const lyricsContent = document.getElementById("lyrics-content"); 
const mainContainer = document.getElementById("karaoke-container"); 
const audioName = document.getElementById("audioName");

// Hàm hỗ trợ hiện thông báo nhỏ cạnh tên bài hát
function setStatusMessage(htmlContent, isTemp = false) {
    let msgSpan = document.getElementById("lyricStatusMsg");
    if (!msgSpan) {
        msgSpan = document.createElement("span");
        msgSpan.id = "lyricStatusMsg";
        msgSpan.style.fontSize = "12px";
        msgSpan.style.marginLeft = "8px";
        msgSpan.style.fontWeight = "normal";
        if (audioName) audioName.appendChild(msgSpan);
    }
    msgSpan.innerHTML = htmlContent;
    
    // Nếu là thông báo tạm thời (như báo Thành công), tự xóa sau 4 giây
    if (isTemp) {
        setTimeout(() => { if (msgSpan) msgSpan.remove(); }, 4000);
    }
}

// 1. Dọn dẹp khi đổi bài
export function clearLyrics() {
    lyrics = [];
    if (lyricsContent) lyricsContent.innerHTML = "";
    
    // 🔥 LUÔN ẨN KHUNG KHI MỞ BÀI MỚI (CHỜ NGƯỜI DÙNG CHỌN KARAOKE MỚI HIỆN)
    if (mainContainer) {
        mainContainer.style.display = "none"; 
    }

    // Xóa thông báo cũ
    const oldMsg = document.getElementById("lyricStatusMsg");
    if (oldMsg) oldMsg.remove();
}

// 2. Gọi API lấy lời (Chạy ngầm cho nhạc Online)
export async function fetchAiLyrics(originalUrl, useAi) {
    clearLyrics(); // Dọn dẹp & Ẩn khung

    if (!useAi || !originalUrl) {
        setStatusMessage("<span style='color: #777;'>(Nhạc Offline - Dùng nút [CC] để tải lời)</span>");
        return;
    }
    
    // Báo đang tìm lời ngầm
    setStatusMessage("<span style='color: #ff416c;'><i class='fas fa-magic fa-spin'></i> Đang tải lời ngầm...</span>");

    try {
        const res = await fetch(`/api/generate_lyrics?url=${encodeURIComponent(originalUrl)}`);
        const data = await res.json();
        
        if (!data.error && data.length > 0) {
            // Thành công
            lyrics = data.map(seg => ({ 
                time: seg.start, 
                endTime: seg.end, 
                text: seg.text.trim() 
            }));
            
            // Báo thành công và ẩn thông báo sau 4 giây
            setStatusMessage("<span style='color: #0f0;'>(✅ Lời đã sẵn sàng)</span>", true);
            
            // 🔥 KHÔNG tự động hiện khung nữa, chỉ vẽ HTML sẵn để đó
            renderKaraokeHTML();
        } else {
            // Thất bại
            setStatusMessage("<span style='color: #aaa;'>(Không tìm thấy lời)</span>");
        }
    } catch (e) {
        console.error("Lỗi:", e);
        setStatusMessage("<span style='color: #ff416c;'>⚠️ Lỗi AI</span>");
    }
}

// 🔥 3. NÂNG CẤP MỚI: Dịch file LRC khi người dùng Upload nhạc Offline
export function parseLRC(lrcText) {
    clearLyrics();
    const lines = lrcText.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2}\.\d{2,3})\]/; // Tìm chuỗi thời gian dạng [00:00.00]
    
    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseFloat(match[2]);
            const time = minutes * 60 + seconds;
            const text = line.replace(timeRegex, '').trim();
            if (text) lyrics.push({ time: time, text: text, endTime: time + 5 }); // Mặc định mỗi câu hiện 5s
        }
    });

    // Làm mượt thời gian tắt chữ (Câu này kết thúc khi câu tiếp theo bắt đầu)
    for(let i = 0; i < lyrics.length - 1; i++) {
        lyrics[i].endTime = lyrics[i + 1].time;
    }

    if(lyrics.length > 0) {
        setStatusMessage("<span style='color: #0f0;'>(✅ Đã nạp file Lời Offline)</span>", true);
        if (mainContainer) mainContainer.style.display = "block"; // Ép hiện khung lời
        renderKaraokeHTML();
    } else {
        setStatusMessage("<span style='color: #ff416c;'>(❌ File LRC không đúng chuẩn)</span>", true);
    }
}

// 4. Vẽ giao diện lời
function renderKaraokeHTML() {
    if(!lyricsContent) return;
    lyricsContent.innerHTML = "";
    if (lyrics.length === 0) return;
    
    // Tạo khoảng đệm để cuộn không bị kịch viền
    const spacer = document.createElement("div"); 
    spacer.style.height = "50px"; 
    lyricsContent.appendChild(spacer);

    lyrics.forEach((line, index) => {
        const p = document.createElement("div"); 
        p.className = "lyric-line"; 
        p.id = `line-${index}`; 
        p.innerText = line.text;
        
        // Tua nhạc khi click vào lời
        p.onclick = () => {
             const audio = document.querySelector("audio"); 
             if(audio) audio.currentTime = line.time;
        };
        lyricsContent.appendChild(p);
    });
    
    const endSpacer = document.createElement("div"); 
    endSpacer.style.height = "50px"; 
    lyricsContent.appendChild(endSpacer);
}

// 5. Cập nhật chữ chạy khớp nhạc
export function updateKaraoke(currentTime) {
    // Nếu khung đang bị ẩn (người dùng chưa bật Karaoke) thì không làm gì cả
    if (lyrics.length === 0 || !lyricsContent || (mainContainer && mainContainer.style.display === "none")) return;
    
    // Tìm dòng hát hiện tại
    const activeIndex = lyrics.findIndex(l => currentTime >= l.time && currentTime < l.endTime + 0.5);
    
    // Gỡ highlight cũ
    const currentActive = lyricsContent.querySelector(".lyric-line.active");
    if (currentActive) {
        currentActive.classList.remove("active");
        currentActive.classList.add("blur");
    }
    
    // Bôi sáng dòng mới
    if (activeIndex !== -1) {
        const activeLine = document.getElementById(`line-${activeIndex}`);
        if (activeLine) {
            activeLine.classList.remove("blur");
            activeLine.classList.add("active");
            activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }
}