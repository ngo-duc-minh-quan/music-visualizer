# Sử dụng Python 3.9
FROM python:3.9

# Cài đặt FFmpeg (Cần thiết cho xử lý âm thanh)
RUN apt-get update && apt-get install -y ffmpeg

# Tạo thư mục làm việc
WORKDIR /code

# Copy file requirements và cài đặt thư viện
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy toàn bộ code của bạn vào
COPY . /code

# Tạo các thư mục cần thiết và cấp quyền (tránh lỗi Permission denied)
RUN mkdir -p /code/separated_files /code/cache
RUN chmod -R 777 /code/separated_files /code/cache

# Mở cổng 7860 (Hugging Face bắt buộc dùng cổng này)
EXPOSE 7860

# Lệnh chạy ứng dụng
CMD ["python", "app.py"]