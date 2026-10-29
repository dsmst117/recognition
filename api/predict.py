"""
Vercel Serverless Function API Endpoint
클라이언트 사이드 TensorFlow.js가 주된 방식이지만,
서버리스 API 엔드포인트 요청이 올 경우 처리하는 핸들러입니다.
"""
from http.server import BaseHTTPRequestHandler
import json
import base64
from PIL import Image
import io
import numpy as np

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            image_data = data.get('image', '')
            if not image_data:
                self.send_error_response("이미지 데이터가 없습니다.")
                return

            if ',' in image_data:
                image_data = image_data.split(',')[1]

            image = Image.open(io.BytesIO(base64.b64decode(image_data))).convert('L')
            img_arr = np.array(image, dtype=np.float32)

            # 반전
            if np.mean(img_arr) > 127:
                img_arr = 255.0 - img_arr

            # Bounding Box 감지
            rows = np.any(img_arr > 30, axis=1)
            cols = np.any(img_arr > 30, axis=0)

            if not np.any(rows) or not np.any(cols):
                self.send_success_response([])
                return

            # 정규화된 상위 예측 계산
            predictions = self.analyze_digit(img_arr)

            self.send_success_response(predictions)

        except Exception as e:
            self.send_error_response(str(e))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_success_response(self, predictions):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            'success': True,
            'predictions': predictions
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))

    def send_error_response(self, error_msg):
        self.send_response(500)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            'success': False,
            'error': error_msg
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))

    def analyze_digit(self, img_arr):
        """
        경량 기하학적 형태 분석 (클라이언트의 TF.js 모델이 기본 권장됨)
        """
        # Bounding Box 크롭
        rows = np.where(np.any(img_arr > 30, axis=1))[0]
        cols = np.where(np.any(img_arr > 30, axis=0))[0]
        crop = img_arr[rows[0]:rows[-1]+1, cols[0]:cols[-1]+1]

        pil_crop = Image.fromarray(crop.astype(np.uint8)).resize((20, 20), Image.Resampling.LANCZOS)
        norm28 = np.zeros((28, 28), dtype=np.float32)
        norm28[4:24, 4:24] = np.array(pil_crop, dtype=np.float32) / 255.0

        # 구역별 질량 비율 분석
        top = np.sum(norm28[4:14, :])
        bottom = np.sum(norm28[14:24, :])
        left = np.sum(norm28[:, 4:14])
        right = np.sum(norm28[:, 14:24])
        center = np.sum(norm28[9:19, 9:19])
        total = np.sum(norm28) + 1e-6

        scores = [0.1] * 10

        # 형태학적 비율 기반 점수
        if center / total < 0.15 and total > 15:
            scores[0] += 0.7  # 0 (가운데가 빈 원형)
        if right / left > 2.0 or (total < 25 and (bottom / (top + 1e-6)) > 0.8):
            scores[1] += 0.8  # 1 (세로 직선)
        if top / bottom > 1.3:
            scores[7] += 0.6  # 7
        if bottom / top > 1.4:
            scores[4] += 0.5  # 4
        if center / total > 0.35:
            scores[8] += 0.6  # 8

        total_score = sum(scores)
        norm_scores = [s / total_score for s in scores]
        top3_idx = np.argsort(norm_scores)[-3:][::-1]

        return [{'digit': int(i), 'confidence': float(norm_scores[i])} for i in top3_idx]
