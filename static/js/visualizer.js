/* --- static/js/visualizer.js --- */
let canvas, ctx, particles = [], imgObj = new Image();
let visualColor = "#ff416c"; // Màu mặc định
let drawMode = "circle";

export function initVisualizer() {
    canvas = document.getElementById("visualizer");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
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

// Hàm tạo hiệu ứng hạt
function createParticles(w, h) {
    if (particles.length > 50) return;
    particles.push({ 
        x: Math.random() * w, y: Math.random() * h, 
        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, 
        size: Math.random() * 2 + 1, alpha: Math.random() * 0.5 + 0.1 
    });
}

// Hàm vẽ chính (sẽ được gọi liên tục 60 lần/giây)
export function renderFrame(analyser, dataArray) {
    if (!canvas || !ctx) return;
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const cx = W / 2, cy = H / 2;
    
    ctx.clearRect(0, 0, W, H);
    
    // 1. Vẽ hạt
    createParticles(W, H);
    particles.forEach(p => { 
        p.x += p.vx; p.y += p.vy; 
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; 
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; 
        ctx.fillStyle = "#fff"; ctx.globalAlpha = p.alpha; 
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); 
    }); 
    ctx.globalAlpha = 1.0;

    // 2. Lấy dữ liệu Bass
    let bassScale = 1;
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        let bass = 0; for (let i = 0; i < 10; i++) bass += dataArray[i];
        bassScale = 1 + (bass / 2550) * 0.25;
    }

    // 3. Vẽ Sóng nhạc
    if (drawMode === "circle") {
        const r = Math.min(W, H) * 0.18; 
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(performance.now() * 0.0005);
        
        if (analyser) {
            for (let i = 0; i < 100; i++) {
                const val = dataArray[i * Math.floor(dataArray.length / 100)];
                ctx.save(); ctx.rotate((Math.PI * 2 / 100) * i);
                ctx.fillStyle = visualColor; ctx.shadowBlur = 15; ctx.shadowColor = visualColor;
                ctx.fillRect(0, r * bassScale + 5, 4, val * 0.8 * bassScale + 2); ctx.restore();
            }
        } else {
            // Vòng tròn chờ khi chưa có nhạc
            ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2; 
            ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();

        // Ảnh tròn ở giữa
        ctx.save(); ctx.translate(cx, cy); ctx.scale(bassScale, bassScale); 
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        if (imgObj.src) ctx.drawImage(imgObj, -r, -r, r * 2, r * 2);
        else { 
            ctx.fillStyle = "#222"; ctx.fill(); ctx.fillStyle = "#fff"; 
            ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
            ctx.fillText("♫", 0, 0); 
        }
        ctx.restore();
        
        // Vòng viền sáng
        ctx.beginPath(); ctx.arc(cx, cy, r * bassScale, 0, Math.PI * 2); 
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.stroke();

    } else {
        // Chế độ Bars (Cột sóng ngang)
        if (analyser) {
            const bw = W / 64;
            for (let i = 0; i < 64; i++) {
                const h = (dataArray[i * Math.floor(dataArray.length / 64)] / 255) * H * 0.6;
                ctx.fillStyle = visualColor; ctx.shadowBlur = 10; ctx.shadowColor = visualColor;
                ctx.fillRect(i * bw, H - h, bw - 2, h);
            }
        }
    }
}