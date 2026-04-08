import os
import sys
import traceback
import subprocess
import platform 
import random 
import json 
import sqlite3
import smtplib 
from email.mime.text import MIMEText 
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, render_template, request, jsonify, Response, stream_with_context, send_file, session
import requests
import yt_dlp
import shutil
import glob
from pydub import AudioSegment
import google.generativeai as genai

# ==============================================================================
# 🔑 CẤU HÌNH API
# ==============================================================================
GOOGLE_API_KEY = "AIzaSyDgsXu6g86jzxtfap4srRYy6LdtBHLNwi4"
genai.configure(api_key=GOOGLE_API_KEY)

SENDER_EMAIL = "email_cua_ban@gmail.com" # THAY BẰNG GMAIL CỦA BẠN
SENDER_PASSWORD = "xxxx xxxx xxxx xxxx"  # THAY BẰNG APP PASSWORD MẬT KHẨU ỨNG DỤNG 16 SỐ

otp_storage = {} 

project_dir = os.path.dirname(os.path.abspath(__file__))
output_folder = os.path.join(project_dir, "separated_files")
if not os.path.exists(output_folder): os.makedirs(output_folder)

is_windows = platform.system() == "Windows"
ffmpeg_executable = "ffmpeg" if not is_windows else "ffmpeg.exe"

app = Flask(__name__)
app.secret_key = "newgen_music_super_secret_key_2026" 

MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

# ==============================================================================
# 🗄️ KHỞI TẠO DATABASE
# ==============================================================================
def init_db():
    conn = sqlite3.connect('newgen_music.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, url TEXT, thumbnail TEXT, original_url TEXT)''')
    conn.commit()
    conn.close()

init_db() 

# ==============================================================================
# 🔐 CÁC API AUTH (ĐĂNG KÝ / ĐĂNG NHẬP / OTP / MXH)
# ==============================================================================
@app.route('/api/send_otp', methods=['POST'])
def send_otp():
    data = request.json
    email = data.get('email')
    if not email or "@" not in email: return jsonify({'error': 'Email không hợp lệ!'}), 400

    conn = sqlite3.connect('newgen_music.db')
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username = ?", (email,))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Email này đã được đăng ký!'}), 400
    conn.close()

    otp = str(random.randint(100000, 999999))
    otp_storage[email] = otp 

    msg = MIMEText(f"Chào bạn,\n\nMã OTP để xác nhận đăng ký tài khoản Newgen Music của bạn là: {otp}\n\nChúc bạn nghe nhạc vui vẻ!")
    msg['Subject'] = "[Newgen Music] Mã xác nhận đăng ký"
    msg['From'] = f"Newgen Music <{SENDER_EMAIL}>"
    msg['To'] = email

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        return jsonify({'success': True, 'message': 'Đã gửi mã OTP! Vui lòng kiểm tra hộp thư.'})
    except Exception as e:
        print("Lỗi gửi mail:", e)
        return jsonify({'error': 'Lỗi Server: Không thể gửi email. Bạn đã cấu hình App Password chưa?'}), 500

@app.route('/api/verify_register', methods=['POST'])
def verify_register():
    data = request.json
    email = data.get('email') 
    password = data.get('password')
    user_otp = data.get('otp')

    if not email or not password or not user_otp: return jsonify({'error': 'Vui lòng điền đủ thông tin!'}), 400
    if len(password) < 6: return jsonify({'error': 'Mật khẩu phải >= 6 ký tự!'}), 400
    if email not in otp_storage or otp_storage[email] != str(user_otp): return jsonify({'error': 'Mã OTP không chính xác!'}), 400

    hashed_pw = generate_password_hash(password)
    try:
        conn = sqlite3.connect('newgen_music.db')
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (email, hashed_pw))
        conn.commit()
        conn.close()
        del otp_storage[email] 
        return jsonify({'success': True, 'message': 'Đăng ký thành công! Hãy đăng nhập.'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email này đã có người sử dụng!'}), 400

@app.route('/api/social_login', methods=['POST'])
def social_login():
    data = request.json
    email = data.get('email')
    name = data.get('name')
    if not email: return jsonify({'error': 'Không lấy được Email từ MXH!'}), 400
        
    conn = sqlite3.connect('newgen_music.db')
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username = ?", (email,))
    user = c.fetchone()
    
    if not user:
        import string
        random_pw = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
        hashed_pw = generate_password_hash(random_pw)
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (email, hashed_pw))
        conn.commit()
        user_id = c.lastrowid
    else: user_id = user[0]
    conn.close()
    
    session['user_id'] = user_id
    session['username'] = email
    display_name = name if name else email.split('@')[0]
    return jsonify({'success': True, 'message': f'Chào mừng {display_name}'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    conn = sqlite3.connect('newgen_music.db')
    c = conn.cursor()
    c.execute("SELECT id, password FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        session['username'] = username
        return jsonify({'success': True, 'message': f'Đăng nhập thành công!'})
    return jsonify({'error': 'Sai Email hoặc mật khẩu!'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({'success': True, 'message': 'Đã đăng xuất.'})

@app.route('/api/user_info', methods=['GET'])
def user_info():
    if 'user_id' in session: return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

# ==============================================================================
# 🎵 CÁC API MUSIC (SEARCH, SUGGEST, AUDIO, LYRICS)
# ==============================================================================
@app.route('/')
def index(): return render_template('index.html')

def get_ydl_opts(noplaylist=True, count=1):
    opts = {
        'format': 'bestaudio/best', 'noplaylist': noplaylist, 'quiet': True, 'geo_bypass': True,
        'nocheckcertificate': True, 'no_continue': True, 'cachedir': False,   
        'extractor_args': {'youtube': {'player_client': ['web', 'tv', 'default']}}, 
        'default_search': f'ytsearch{count}'
    }
    cookie_path = os.path.join(project_dir, 'cookies.txt')
    if os.path.exists(cookie_path): opts['cookiefile'] = cookie_path
    return opts

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

@app.route('/api/suggest')
def suggest_youtube():
    query = request.args.get('q', '')
    if not query: return jsonify([])
    try:
        url = f"http://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q={query}"
        resp = requests.get(url, timeout=3)
        data = resp.json()
        suggestions = data[1] if len(data) > 1 else []
        return jsonify(suggestions)
    except Exception as e: return jsonify([])

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

@app.route('/api/generate_lyrics')
def generate_lyrics():
    url = request.args.get('url')
    if not url: return jsonify({'error': 'Thiếu URL'}), 400
    audio_path = os.path.join(project_dir, "temp_lyric_audio.mp3")
    mock_lyrics = [
        {"start": 0.0, "end": 5.0, "text": "❌ Rất tiếc, AI không thể tạo lời cho bài này."},
        {"start": 5.0, "end": 999.0, "text": "Lý do: File nhạc quá dài hoặc Server YouTube từ chối tải."}
    ]
    try:
        if os.path.exists(audio_path): os.remove(audio_path)
        opts = get_ydl_opts()
        opts.update({
            'outtmpl': os.path.join(project_dir, 'temp_lyric_audio.%(ext)s'),
            'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '64'}],
            'overwrites': True, 'no_continue': True, 'cachedir': False    
        })
        if is_windows: opts['ffmpeg_location'] = project_dir
        with yt_dlp.YoutubeDL(opts) as ydl: ydl.download([url])

        sample_audio = genai.upload_file(path=audio_path)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = "Nghe bài hát này và tạo dữ liệu Karaoke JSON. Yêu cầu tuyệt đối: Trả về JSON List thuần túy: [{\"start\": 0.0, \"end\": 2.5, \"text\": \"Câu hát 1\"}]. KHÔNG dùng markdown, KHÔNG giải thích. text phải là Tiếng Việt chuẩn."
        response = model.generate_content([prompt, sample_audio])
        json_str = response.text.replace("```json", "").replace("```", "").strip()
        lyrics_data = json.loads(json_str)
        if os.path.exists(audio_path): os.remove(audio_path)
        return jsonify(lyrics_data)
    except Exception as e:
        if os.path.exists(audio_path): os.remove(audio_path)
        return jsonify(mock_lyrics)

@app.route('/api/process_audio')
def process_audio():
    url = request.args.get('url')
    mode = request.args.get('mode', 'original') 
    if not url: return jsonify({'error': 'Thiếu URL'}), 400

    import hashlib
    video_id = hashlib.md5(url.encode()).hexdigest()
    filename = f"song_{video_id}"
    original_path = os.path.join(output_folder, f"{filename}.mp3")
    
    try:
        if not os.path.exists(original_path):
            opts = get_ydl_opts()
            opts.update({
                'outtmpl': os.path.join(output_folder, filename + ".%(ext)s"),
                'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}],
                'overwrites': True, 'no_continue': True, 'cachedir': False
            })
            if is_windows: opts['ffmpeg_location'] = project_dir
            with yt_dlp.YoutubeDL(opts) as ydl: ydl.download([url])
    except Exception as e: return jsonify({'error': "Lỗi tải nhạc: " + str(e)}), 500

    if mode == 'original': return send_file(original_path, mimetype="audio/mpeg")
    mp3_path = os.path.join(output_folder, f"{filename}_{mode}.mp3")
    if os.path.exists(mp3_path): os.remove(mp3_path)

    if mode == '8d':
        cmd = f'"{ffmpeg_executable}" -y -i "{original_path}" -af "apulsator=hz=0.125" "{mp3_path}"'
        subprocess.run(cmd, shell=True)
        return send_file(mp3_path, mimetype="audio/mpeg")
    elif mode == 'reverb':
        cmd = f'"{ffmpeg_executable}" -y -i "{original_path}" -af "aecho=0.8:0.9:1000:0.3" "{mp3_path}"'
        subprocess.run(cmd, shell=True)
        return send_file(mp3_path, mimetype="audio/mpeg")

    demucs_base_folder = os.path.join(output_folder, "htdemucs")
    target_demucs_folder = os.path.join(demucs_base_folder, filename)
    vocals_wav = os.path.join(target_demucs_folder, "vocals.wav")
    no_vocals_wav = os.path.join(target_demucs_folder, "no_vocals.wav")

    need_separation = True
    if os.path.exists(vocals_wav) and os.path.exists(no_vocals_wav):
        if os.path.getsize(vocals_wav) > 1024: need_separation = False
    
    if need_separation:
        python_exec = sys.executable 
        env = os.environ.copy()
        if is_windows: env["PATH"] += os.pathsep + project_dir
        if os.path.exists(target_demucs_folder): shutil.rmtree(target_demucs_folder)
        cmd = f'"{python_exec}" -m demucs.separate --two-stems=vocals -n htdemucs -o "{output_folder}" "{original_path}"'
        subprocess.run(cmd, shell=True, env=env)

    if not os.path.exists(vocals_wav): return jsonify({'error': "Lỗi tách nhạc"}), 500
        
    try:
        if mode == 'karaoke': AudioSegment.from_wav(no_vocals_wav).export(mp3_path, format="mp3")
        elif mode == 'vocal_only': AudioSegment.from_wav(vocals_wav).export(mp3_path, format="mp3")

        if os.path.exists(mp3_path):
            response = send_file(mp3_path, mimetype="audio/mpeg")
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            return response
        else: return jsonify({'error': "Không tạo được file"}), 500
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/proxy_audio')
def proxy_audio():
    url = request.args.get('url')
    if not url: return "No URL", 400
    headers = { "Range": request.headers.get('Range', 'bytes=0-') }
    if 'c=ANDROID' in url: headers["User-Agent"] = "com.google.android.youtube/17.36.4 (Linux; U; Android 12; GB) gzip"
    else:
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        headers["Referer"] = "https://www.youtube.com/"
        headers["Origin"] = "https://www.youtube.com"

    try:
        req = requests.get(url, headers=headers, stream=True)
        if req.status_code == 403:
            headers.pop("User-Agent", None)
            req = requests.get(url, headers=headers, stream=True)
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        resp_headers = [(name, value) for (name, value) in req.headers.items() if name.lower() not in excluded_headers]
        if 'Content-Length' in req.headers: resp_headers.append(('Content-Length', req.headers['Content-Length']))
        if 'Content-Range' in req.headers: resp_headers.append(('Content-Range', req.headers['Content-Range']))
        return Response(stream_with_context(req.iter_content(chunk_size=1024*1024)), status=req.status_code, headers=resp_headers)
    except Exception as e: return str(e), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)