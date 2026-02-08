/* --- static/js/lyrics.js --- */
let lyrics = [];
const karaokeBox = document.getElementById("karaokeBox");
const audioName = document.getElementById("audioName");

export function clearLyrics() {
    lyrics = [];
    if(karaokeBox) karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">...</div>';
}

export async function fetchAiLyrics(originalUrl, useAi) {
    if (!useAi) {
        karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(Nhạc Local - Chưa hỗ trợ AI)</div>';
        return;
    }
    
    lyrics = [];
    karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(🤖 AI đang nghe...)</div>';
    
    // Hiện thông báo nhỏ cạnh tên bài hát
    const loadingSpan = document.createElement("span"); 
    loadingSpan.id = "aiMsg"; loadingSpan.style.color = "#aaa"; loadingSpan.style.fontSize = "11px"; 
    loadingSpan.textContent = " (🤖 Đang nghe...)";
    if(audioName) audioName.appendChild(loadingSpan);

    try {
        const res = await fetch(`/api/generate_lyrics?url=${encodeURIComponent(originalUrl)}`);
        const data = await res.json();
        
        if(document.getElementById("aiMsg")) document.getElementById("aiMsg").remove();

        if (!data.error) {
            // Chuyển đổi dữ liệu về dạng chuẩn
            lyrics = data.map(seg => ({ time: seg.start, endTime: seg.end, text: seg.text.trim() }));
            
            // Báo thành công
            const okSpan = document.createElement("span"); 
            okSpan.style.color = "#0f0"; okSpan.style.fontSize = "11px"; 
            okSpan.textContent = " (✅ Lyric)";
            if(audioName) audioName.appendChild(okSpan); 
            setTimeout(() => okSpan.remove(), 3000);
            
            renderKaraokeHTML();
        } else {
            karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(Không tạo được Lyric)</div>';
        }
    } catch (e) {
        if(document.getElementById("aiMsg")) document.getElementById("aiMsg").remove();
        karaokeBox.innerHTML = '<div class="lyric-line" style="margin-top:130px;">(Lỗi kết nối AI)</div>';
    }
}

function renderKaraokeHTML() {
    karaokeBox.innerHTML = "";
    if (lyrics.length === 0) return;
    
    const spacer = document.createElement("div"); spacer.style.height = "130px"; karaokeBox.appendChild(spacer);
    lyrics.forEach((line, index) => {
        const p = document.createElement("div"); p.className = "lyric-line"; p.id = `line-${index}`; p.innerText = line.text;
        karaokeBox.appendChild(p);
    });
    const endSpacer = document.createElement("div"); endSpacer.style.height = "130px"; karaokeBox.appendChild(endSpacer);
}

export function updateKaraoke(currentTime) {
    if (lyrics.length === 0 || !karaokeBox) return;
    
    // Tìm câu hát hiện tại
    const activeIndex = lyrics.findIndex(l => currentTime >= l.time && currentTime < l.endTime + 0.5);
    
    // Xóa active cũ
    const currentActive = karaokeBox.querySelector(".lyric-line.active");
    if (currentActive) currentActive.classList.remove("active");
    
    // Active câu mới
    if (activeIndex !== -1) {
        const activeLine = document.getElementById(`line-${activeIndex}`);
        if (activeLine) {
            activeLine.classList.add("active");
            activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }
}   