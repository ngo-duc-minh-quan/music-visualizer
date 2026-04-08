/* --- static/js/visualizer.js --- */
let canvas, ctx, particles = [];
let imgObj = new Image();
let visualColor = "#f6f6f6"; 
let drawMode = "circle";

export function initVisualizer() {
    canvas = document.getElementById("visualizer");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
}

export function setVisualColor(color) { visualColor = color; }
export function setDrawMode(mode) { drawMode = mode; }
export function setBgImage(url) { 
    imgObj.src = url; 
    const bgDiv = document.getElementById("bgImage");
    if(bgDiv) bgDiv.style.backgroundImage = `url("${url}")`;
}

function createParticles(w, h) {
    if (particles.length > 40) return; 
    particles.push({ 
        x: Math.random() * w, y: Math.random() * h, 
        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, 
        size: Math.random() * 2, alpha: Math.random() * 0.5 + 0.1 
    });
}

export function renderFrame(analyser, dataArray) {
    if (!canvas || !ctx) return;
    
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    
    ctx.clearRect(0, 0, W, H);
    
    // 1. Vẽ hạt vũ trụ
    createParticles(W, H);
    particles.forEach(p => { 
        p.x += p.vx; p.y += p.vy; 
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; 
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; 
        ctx.fillStyle = "#fff"; ctx.globalAlpha = p.alpha; 
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); 
    }); 
    ctx.globalAlpha = 1.0;

    // 2. Tính độ nảy Bass
    let bassScale = 1;
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        let bass = 0; for (let i = 0; i < 10; i++) bass += dataArray[i];
        bassScale = 1 + (bass / 2550) * 0.15; 
    }

    if (drawMode === "circle") {
        const r = Math.max(Math.min(W, H) * 0.22, 130); 
        
        ctx.save(); ctx.translate(cx, cy); 
        ctx.rotate(performance.now() * 0.0005); 
        
        // 3. VẼ SÓNG ÂM (NÂNG CẤP ĐA MÀU SẮC LÚC PARTY)
        if (analyser) {
            const bars = 90; 
            const step = Math.floor(dataArray.length / bars);
            for (let i = 0; i < bars; i++) {
                const val = dataArray[i * step];
                ctx.save(); 
                ctx.rotate((Math.PI * 2 / bars) * i);
                
                let currentColor = visualColor;
                
                // 🌟 PHÉP THUẬT Ở ĐÂY: Nếu Party Mode bật, trộn màu xuất hiện cùng lúc!
                if (window.isPartyMode && window.partyColors && window.partyColors.length > 0) {
                    // Dùng thời gian thực để dải màu xoay tròn mượt mà quanh đĩa
                    const timeOffset = Math.floor(performance.now() / 150); 
                    // Cứ mỗi 2 vạch sóng sẽ chung 1 cụm màu, tạo hiệu ứng dải gradient đan xen
                    const colorIndex = Math.floor((i + timeOffset) / 2) % window.partyColors.length;
                    currentColor = window.partyColors[colorIndex];
                }

                ctx.fillStyle = currentColor; 
                ctx.shadowBlur = 10; 
                ctx.shadowColor = currentColor;
                ctx.fillRect(0, r * bassScale + 5, 4, val * 0.6 * bassScale + 2); 
                ctx.restore();
            }
        } else {
            ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2; 
            ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();

        // 4. Vẽ ảnh tròn ở giữa
        ctx.save(); ctx.translate(cx, cy); ctx.scale(bassScale, bassScale); 
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        
        if (imgObj.src && imgObj.complete && imgObj.naturalWidth > 0) {
            ctx.drawImage(imgObj, -r, -r, r * 2, r * 2);
        } else { 
            ctx.fillStyle = "#111"; ctx.fill(); 
            ctx.fillStyle = "#fff"; ctx.font = "40px Arial"; 
            ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
            ctx.fillText("♫", 0, 0); 
        }
        ctx.restore();
        
        // Viền sáng
        ctx.beginPath(); ctx.arc(cx, cy, r * bassScale, 0, Math.PI * 2); 
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; ctx.stroke();
    }
}