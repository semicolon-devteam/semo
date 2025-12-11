# SEMO RAG Indexer Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
RUN pip install --no-cache-dir \
    qdrant-client \
    requests \
    schedule

# 스크립트 복사
COPY index_feedback.py .

# 주기적 실행 (1시간마다)
CMD ["python", "-c", "\
import schedule, time; \
from index_feedback import main; \
main(); \
schedule.every(1).hours.do(main); \
while True: schedule.run_pending(); time.sleep(60)"]
