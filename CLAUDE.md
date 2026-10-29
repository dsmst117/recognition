# CLAUDE.md - AI Handwriting Recognition (Digits & Korean)

## 프로젝트 개요
손글씨 **숫자(0-9)** 및 **한글(단어/문장)**을 인식할 수 있는 하이브리드 인공지능 웹 애플리케이션입니다.
- **숫자 모드**: 브라우저 TensorFlow.js 기반 고성능 MNIST 정규화 추론 (설치 불필요, 즉시 동작)
- **한글 모드**: Flask 백엔드 EasyOCR 엔진 기반 한국어 손글씨 단어/문장 인식

## 주요 기능 및 아키텍처

### 1. 탭 기반 모드 전환
- `[🔢 숫자 모드]`: $280 \times 280$ 캔버스, $20 \times 20$ Bounding Box 정규화 + 질량 중심(13.5, 13.5) 정렬, AI 28x28 실시간 뷰어 제공
- `[🇰🇷 한글 모드]`: $440 \times 240$ 확장 가로형 캔버스, 한글 최적화 펜 굵기(12px), 백엔드 EasyOCR 연동 및 단어별 신뢰도 카드 표시

### 2. 백엔드 구성
- `app.py`:
  - `POST /predict`: 숫자 인식 (Center of Mass 전처리 + CNN)
  - `POST /predict_korean`: 한글 손글씨 인식 (EasyOCR 모듈 연동)
- `korean_recognizer.py`:
  - EasyOCR 기반 한국어 OCR 및 캔버스 손글씨 최적화 전처리 모듈

## 실행 방법

### 방법 1. 브라우저에서 숫자 모드 즉시 실행
```batch
run_server.bat
```
접속: `http://localhost:3000` (숫자 인식은 파이썬 설치 없이 즉시 실행 가능)

### 방법 2. 한글 모드 포함 전체 실행 (Flask 서버)
```batch
pip install -r requirements.txt
python app.py
```
접속: `http://localhost:5000`

## 주요 파일 목록
- `index.html`: 메인 웹 UI (숫자/한글 탭, 실시간 프리뷰, Undo 기능)
- `korean_recognizer.py`: 한글 손글씨 OCR 엔진 모듈
- `app.py`: Flask 백엔드 서버
- `model/`: 숫자 인식용 사전 학습 가중치 (model.json, group1-*.bin)
- `templates/` & `static/`: Flask 웹 리소스
- `requirements.txt`: Python 의존성 목록
