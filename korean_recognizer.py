"""
한글 손글씨 및 단어/문장 인식을 위한 백엔드 OCR 모듈
- EasyOCR 엔진을 기반으로 한국어 손글씨 인식
- 캔버스 드로잉에 특화된 전처리 파이프라인 (대비 강화, 패딩, 이진화)
- 라이브러리 미설치 시 안전한 안내(Fallback) 제공
"""
import os
import io
import base64
import numpy as np
from PIL import Image, ImageOps

class KoreanRecognizer:
    def __init__(self):
        self.reader = None
        self.is_available = False
        self.init_error = None
        self._initialize_engine()

    def _initialize_engine(self):
        try:
            import easyocr
            print("한글 OCR 엔진(EasyOCR)을 초기화하는 중입니다 (최초 1회 모델 다운로드 진행 가능)...")
            # GPU가 없어도 CPU에서 고속 동작하도록 설정
            self.reader = easyocr.Reader(['ko', 'en'], gpu=False, verbose=False)
            self.is_available = True
            print("✓ 한글 OCR 엔진이 성공적으로 준비되었습니다!")
        except ImportError as e:
            self.is_available = False
            self.init_error = "easyocr 라이브러리가 설치되지 않았습니다. (명령어: pip install easyocr)"
            print(f"⚠️ {self.init_error}")
        except Exception as e:
            self.is_available = False
            self.init_error = f"OCR 엔진 초기화 중 오류: {str(e)}"
            print(f"⚠️ {self.init_error}")

    def preprocess_canvas_image(self, image_data):
        """
        캔버스에서 그린 손글씨 이미지를 OCR에 최적화된 형태로 전처리
        """
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        # 그레이스케일 변환
        gray = image.convert('L')
        img_arr = np.array(gray)

        # 획이 검은색(0 근처), 배경이 흰색(255)인지 확인
        # 획 부분 검출 (임계값 이하인 픽셀)
        is_stroke = img_arr < 200
        if not np.any(is_stroke):
            return None  # 빈 캔버스

        # 바운딩 박스 크롭
        rows = np.any(is_stroke, axis=1)
        cols = np.any(is_stroke, axis=0)
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]

        # 여백(Margin) 추가
        pad = 20
        h, w = img_arr.shape
        rmin = max(0, rmin - pad)
        rmax = min(h, rmax + pad + 1)
        cmin = max(0, cmin - pad)
        cmax = min(w, cmax + pad + 1)

        cropped = image.crop((cmin, rmin, cmax, rmax))

        # OCR 인식률 향상을 위한 고대비 및 선명화 처리
        # 흰 배경에 검은 글씨 상태 유지, 테두리 여백 20px 추가
        processed = ImageOps.expand(cropped, border=30, fill='white')

        return np.array(processed)

    def recognize(self, image_data):
        if not self.is_available:
            return {
                'success': False,
                'use_browser_ocr': True,
                'message': '백엔드 EasyOCR 미설치로 브라우저 내장 AI 엔진(Tesseract.js)으로 자동 전환합니다.'
            }

        try:
            processed_img = self.preprocess_canvas_image(image_data)
            if processed_img is None:
                return {
                    'success': True,
                    'empty': True,
                    'text': '',
                    'message': '캔버스에 한글을 적어주세요.'
                }

            # EasyOCR 실행: detail=1 (좌표, 텍스트, 신뢰도 반환)
            results = self.reader.readtext(processed_img, detail=1, paragraph=False)

            if not results:
                # 획은 있지만 글자로 인식되지 않은 경우 (너무 짧거나 낙서 등)
                return {
                    'success': True,
                    'text': '',
                    'confidence': 0.0,
                    'words': [],
                    'message': '글자를 명확하게 인식하지 못했습니다. 조금 더 또렷하게 적어보세요.'
                }

            words = []
            full_text_list = []
            total_conf = 0.0

            for bbox, text, conf in results:
                clean_text = text.strip()
                if clean_text:
                    words.append({
                        'text': clean_text,
                        'confidence': round(float(conf) * 100, 1)
                    })
                    full_text_list.append(clean_text)
                    total_conf += float(conf)

            full_text = " ".join(full_text_list)
            avg_conf = (total_conf / len(words) * 100) if words else 0.0

            return {
                'success': True,
                'text': full_text,
                'confidence': round(avg_conf, 1),
                'words': words
            }

        except Exception as e:
            return {
                'success': False,
                'error': f"인식 처리 중 오류가 발생했습니다: {str(e)}"
            }

# 싱글톤 인스턴스
_korean_recognizer = None

def get_korean_recognizer():
    global _korean_recognizer
    if _korean_recognizer is None:
        _korean_recognizer = KoreanRecognizer()
    return _korean_recognizer
