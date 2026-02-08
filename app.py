import os
import sys
import traceback
import subprocess
import platform 
import random 
import json # Import json để xử lý kết quả Gemini
from flask import Flask, render_template, request, jsonify, Response, stream_with_context, send_file
import requests
import yt_dlp
from pydub import AudioSegment

# --- THÊM THƯ VIỆN GEMINI ---
import google.generativeai as genai

# ==============================================================================
# 🔑 CẤU HÌNH API KEY 
# ==============================================================================
GOOGLE_API_KEY = "AIzaSyDgsXu6g86jzxtfap4srRYy6LdtBHLNwi4"
genai.configure(api_key=GOOGLE_API_KEY)
# ==============================================================================

# --- CẤU HÌNH HỆ THỐNG ---
project_dir = os.path.dirname(os.path.abspath(__file__))
output_folder = os.path.join(project_dir, "separated_files")
if not os.path.exists(output_folder): os.makedirs(output_folder)

# KIỂM TRA HỆ ĐIỀU HÀNH
is_windows = platform.system() == "Windows"
ffmpeg_executable = "ffmpeg" if not is_windows else "ffmpeg.exe"

app = Flask(__name__)

# --- CẤU HÌNH USER-AGENT MOBILE (FIX LỖI 403 & 500) ---
MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

@app.route('/')
def index():
    return render_template('index.html')

# --- HÀM CẤU HÌNH YT-DLP CHUNG (CÓ COOKIES) ---
def get_ydl_opts(noplaylist=True, count=1):
    opts = {
        'format': 'bestaudio/best', 
        'noplaylist': noplaylist, 
        'quiet': True, 
        'geo_bypass': True,
        'nocheckcertificate': True,
        'extractor_args': {'youtube': {'player_client': ['android']}}, # Dùng Android Client để ổn định
        'default_search': f'ytsearch{count}'
    }
    
    # --- TỰ ĐỘNG NẠP COOKIES NẾU CÓ ---
    cookie_path = os.path.join(project_dir, 'cookies.txt')
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
    else:
        print("⚠️ Cảnh báo: Không tìm thấy file cookies.txt!")
        
    return opts

# --- 1. SEARCH API ---
@app.route('/api/search')
def search_youtube():
    query = request.args.get('q')
    if not query: return jsonify({'error': 'No query'}), 400
    
    try:
        with yt_dlp.YoutubeDL(get_ydl_opts(count=1)) as ydl:
            result = ydl.extract_info(query, download=False)
            video = result['entries'][0] if 'entries' in result else result
            return jsonify({
                'title': video.get('title'), 'url': video.get('url'), 
                'thumbnail': video.get('thumbnail'), 'duration': video.get('duration'), 
                'webpage_url': video.get('webpage_url')
            })
    except Exception as e: return jsonify({'error': str(e)}), 500

# --- 2. TRENDING API ---
@app.route('/api/trending')
def get_trending():
    category = request.args.get('type', 'all')
    queries = {
        'all': ["nhạc trẻ hot tiktok 2026", "nhạc remix edm gaming", "top hits vietnam"], 
        'lofi': "lofi chill tiếng việt dễ ngủ", 'rap': "rap việt hay nhất mới nhất",
        'ballad': "nhạc trẻ ballad buồn tâm trạng", 'karaoke': "karaoke tone nam nữ hot nhất",
        'remix': "nhạc trẻ remix vinahouse căng cực"
    }
    search_query = random.choice(queries['all']) if category == 'all' else queries.get(category, "nhạc trẻ hay nhất")
    
    try:
        opts = get_ydl_opts(count=6)
        with yt_dlp.YoutubeDL(opts) as ydl:
            result = ydl.extract_info(search_query, download=False)
            suggestions = [{'title': v.get('title'), 'url': v.get('url'), 'webpage_url': v.get('webpage_url'), 'thumbnail': v.get('thumbnail')} for v in result.get('entries', [])]
            return jsonify(suggestions)
    except Exception as e: return jsonify({'error': str(e)}), 500

# --- 3. GENERATE LYRIC (ĐÃ NÂNG CẤP LÊN GEMINI) ---
@app.route('/api/generate_lyrics')
def generate_lyrics():
    url = request.args.get('url')
    if not url: return jsonify({'error': 'Thiếu URL'}), 400
    
    # File tạm
    audio_path = os.path.join(project_dir, "temp_lyric_audio.mp3")
    
    try:
        if os.path.exists(audio_path): os.remove(audio_path)
        
        # 1. Tải nhạc (Nén 64k cho nhanh)
        opts = get_ydl_opts()
        opts.update({
            'outtmpl': 'temp_lyric_audio.%(ext)s',
            'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '64'}],
            'overwrites': True
        })
        if is_windows: opts['ffmpeg_location'] = project_dir

        with yt_dlp.YoutubeDL(opts) as ydl: ydl.download([url])

        # 2. Gửi file lên Gemini
        print("🤖 Đang gửi file lên Gemini để tạo Karaoke...")
        sample_audio = genai.upload_file(path=audio_path)
        
        # 3. Yêu cầu Gemini
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = """
        Nghe bài hát này và tạo dữ liệu Karaoke JSON.
        Yêu cầu tuyệt đối:
        1. Trả về định dạng JSON List thuần túy: [{"start": 0.0, "end": 2.5, "text": "Câu hát 1"}, ...]
        2. KHÔNG dùng markdown (```json), KHÔNG giải thích.
        3. "text" phải là Tiếng Việt chuẩn, đúng chính tả, có dấu.
        4. Chia nhỏ từng câu (segment) để chữ chạy khớp nhạc.
        """
        
        response = model.generate_content([prompt, sample_audio])
        
        # 4. Xử lý kết quả
        json_str = response.text.replace("```json", "").replace("```", "").strip()
        lyrics_data = json.loads(json_str)
        
        if os.path.exists(audio_path): os.remove(audio_path)
        return jsonify(lyrics_data)

    except Exception as e:
        traceback.print_exc()
        if os.path.exists(audio_path): os.remove(audio_path)
        return jsonify({'error': "Gemini Error: " + str(e)}), 500

# --- 4. PROCESS AUDIO (DEMUCS + PYDUB) ---
@app.route('/api/process_audio')
def process_audio():
    url = request.args.get('url')
    mode = request.args.get('mode') 
    if not url: return jsonify({'error': 'Thiếu URL'}), 400

    filename = "processed_song"
    original_path = os.path.join(output_folder, f"{filename}.mp3")
    
    # Tải nhạc gốc nếu chưa có
    if not os.path.exists(original_path):
        print(f"⬇️ Đang tải nhạc gốc: {url}")
        opts = get_ydl_opts()
        opts.update({
            'outtmpl': os.path.join(output_folder, filename + ".%(ext)s"),
            'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}],
            'overwrites': True
        })
        if is_windows: opts['ffmpeg_location'] = project_dir
        try:
            with yt_dlp.YoutubeDL(opts) as ydl: ydl.download([url])
        except Exception as e: return jsonify({'error': "Lỗi tải nhạc: " + str(e)}), 500

    if mode == 'original': return send_file(original_path, mimetype="audio/mpeg")

    # Demucs logic (Local Processing)
    demucs_base_folder = os.path.join(output_folder, "htdemucs")
    found_folder = None
    if os.path.exists(demucs_base_folder):
        subfolders = [f.path for f in os.scandir(demucs_base_folder) if f.is_dir()]
        subfolders.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        if subfolders: found_folder = subfolders[0]

    need_separation = True
    if found_folder and os.path.exists(os.path.join(found_folder, "vocals.wav")):
        need_separation = False
    
    if need_separation:
        print("🤖 AI Demucs đang tách lời...")
        python_exec = sys.executable 
        env = os.environ.copy()
        if is_windows: env["PATH"] += os.pathsep + project_dir
        cmd = f'"{python_exec}" -m demucs.separate --two-stems=vocals -n htdemucs -o "{output_folder}" "{original_path}"'
        subprocess.run(cmd, shell=True, env=env)
        if os.path.exists(demucs_base_folder):
            subfolders = [f.path for f in os.scandir(demucs_base_folder) if f.is_dir()]
            subfolders.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            if subfolders: found_folder = subfolders[0]

    if not found_folder: return jsonify({'error': "Lỗi tách nhạc"}), 500
        
    vocals_path = os.path.join(found_folder, "vocals.wav")
    no_vocals_path = os.path.join(found_folder, "no_vocals.wav")

    try:
        final_file = None
        if mode == 'karaoke': final_file = no_vocals_path
        elif mode == 'vocal_only': final_file = vocals_path
        
        # Hiệu ứng đổi giọng (Chipmunk / Deep) dùng Pydub
        elif mode == 'chipmunk':
            vocal = AudioSegment.from_file(vocals_path)
            beat = AudioSegment.from_file(no_vocals_path)
            # Tăng tốc độ giọng hát (làm méo tiếng cao lên)
            new_sample_rate = int(vocal.frame_rate * 1.5)
            vocal_high = vocal._spawn(vocal.raw_data, overrides={'frame_rate': new_sample_rate}).set_frame_rate(vocal.frame_rate)
            mixed = vocal_high.overlay(beat)
            out_path = os.path.join(output_folder, "chipmunk.mp3")
            mixed.export(out_path, format="mp3")
            final_file = out_path
            
        elif mode == 'deep':
            vocal = AudioSegment.from_file(vocals_path)
            beat = AudioSegment.from_file(no_vocals_path)
            # Giảm tốc độ giọng hát (làm trầm tiếng xuống)
            new_sample_rate = int(vocal.frame_rate * 0.75) 
            vocal_low = vocal._spawn(vocal.raw_data, overrides={'frame_rate': new_sample_rate}).set_frame_rate(vocal.frame_rate)
            mixed = vocal_low.overlay(beat)
            out_path = os.path.join(output_folder, "deep.mp3")
            mixed.export(out_path, format="mp3",bitrate="192k")
            final_file = out_path

        return send_file(final_file, mimetype="audio/mpeg")
    except Exception as e: return jsonify({'error': str(e)}), 500

# --- 5. PROXY AUDIO (FIX LỖI 403) ---
@app.route('/proxy_audio')
def proxy_audio():
    url = request.args.get('url')
    if not url: return "No URL", 400
    
    headers = { "User-Agent": MOBILE_USER_AGENT, "Accept": "*/*", "Range": request.headers.get('Range', 'bytes=0-') }

    try:
        req = requests.get(url, headers=headers, stream=True)
        # Fallback nếu vẫn bị chặn 403
        if req.status_code == 403:
            headers.pop("User-Agent", None)
            req = requests.get(url, headers=headers, stream=True)

        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        resp_headers = [(name, value) for (name, value) in req.headers.items() if name.lower() not in excluded_headers]
        if 'Content-Length' in req.headers: resp_headers.append(('Content-Length', req.headers['Content-Length']))
        if 'Content-Range' in req.headers: resp_headers.append(('Content-Range', req.headers['Content-Range']))

        return Response(stream_with_context(req.iter_content(chunk_size=4096)), status=req.status_code, headers=resp_headers)
    except Exception as e: return "Error", 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)