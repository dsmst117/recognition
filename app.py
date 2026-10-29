import os
import sys
import io
import base64

# 필수 라이브러리 설치 확인 및 친절한 안내
missing_libs = []
try:
    import numpy as np
except ImportError:
    missing_libs.append("numpy")

try:
    from PIL import Image
except ImportError:
    missing_libs.append("Pillow")

try:
    from flask import Flask, render_template, request, jsonify, send_from_directory
    from flask_cors import CORS
except ImportError:
    missing_libs.append("Flask Flask-Cors")

if missing_libs:
    print("\n" + "=" * 60)
    print("❌ 실행에 필요한 파이썬 패키지가 설치되어 있지 않습니다!")
    print(f"누락된 패키지: {', '.join(missing_libs)}")
    print("-" * 60)
    print("👉 해결 방법 1 (가장 추천):")
    print("   파이썬 패키지 설치 없이 브라우저에서 즉시 실행하려면,")
    print("   프로젝트 폴더의 'run_server.bat'을 더블클릭하세요.")
    print("\n👉 해결 방법 2 (Flask 서버 실행):")
    print("   아래 명령어로 필요한 패키지를 먼저 설치해주세요:")
    print("   pip install -r requirements.txt")
    print("=" * 60 + "\n")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'mnist_model.h5')

class DigitRecognizer:
    def __init__(self):
        self.model = None
        try:
            import tensorflow as tf
            from tensorflow import keras
            self.tf = tf
            self.keras = keras

            # 저장된 사전 학습 모델이 있으면 로드, 없으면 새로 학습
            if os.path.exists(MODEL_PATH):
                print(f"Loading pre-trained model from {MODEL_PATH}...")
                self.model = self.keras.models.load_model(MODEL_PATH)
                print("✓ Model loaded successfully!")
            else:
                print("Pre-trained model not found. Training a high-accuracy model...")
                self.model = self.build_and_train_model()
                self.model.save(MODEL_PATH)
                print(f"✓ Model trained and saved to {MODEL_PATH}!")
        except ImportError:
            print("💡 [안내] TensorFlow 라이브러리가 없습니다 (Python 3.14 환경 등).")
            print("   숫자 인식은 브라우저(TensorFlow.js)에서 고속으로 직접 수행됩니다.")
        except Exception as e:
            print(f"⚠️ 모델 로드 중 예외 발생: {e}")

    def build_and_train_model(self):
        # MNIST 데이터셋 로드
        (x_train, y_train), (x_test, y_test) = self.keras.datasets.mnist.load_data()
        x_train = x_train.reshape(-1, 28, 28, 1).astype('float32') / 255.0
        y_train = self.keras.utils.to_categorical(y_train, 10)
        x_test = x_test.reshape(-1, 28, 28, 1).astype('float32') / 255.0
        y_test = self.keras.utils.to_categorical(y_test, 10)

        # 향상된 CNN 구조 (Conv2D -> Conv2D -> MaxPool -> Dropout -> Dense)
        model = self.keras.Sequential([
            self.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(28, 28, 1)),
            self.keras.layers.Conv2D(64, (3, 3), activation='relu'),
            self.keras.layers.MaxPooling2D((2, 2)),
            self.keras.layers.Dropout(0.25),
            self.keras.layers.Flatten(),
            self.keras.layers.Dense(128, activation='relu'),
            self.keras.layers.Dropout(0.5),
            self.keras.layers.Dense(10, activation='softmax')
        ])

        model.compile(optimizer='adam',
                             loss='categorical_crossentropy',
                             metrics=['accuracy'])

        # 학습 (8 에포크)
        model.fit(x_train, y_train,
                  epochs=8, batch_size=128,
                  validation_split=0.1, verbose=1)

        test_loss, test_acc = model.evaluate(x_test, y_test, verbose=0)
        print(f"Test accuracy: {test_acc:.4f}")
        return model

    def preprocess_image(self, image_data):
        """
        ✨ MNIST 규격 정규화 전처리 함수
        1. Base64 디코딩 및 그레이스케일 변환
        2. 배경 흰색(255) -> 0, 획 검은색(0) -> 255 반전
        3. 획의 Bounding Box 추출 (빈 캔버스 예외처리)
        4. 종횡비 유지하여 20x20 크기 내로 리사이즈
        5. 28x28 캔버스에 배치 후 질량 중심(Center of Mass)을 (13.5, 13.5)로 정밀 이동
        6. 선명도 복원 및 [0, 1] 정규화
        """
        # Base64 헤더 분리
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert('L')
        img_arr = np.array(image, dtype=np.float32)

        # 캔버스 색상 반전 (배경 흰색->0, 글씨 검은색->255)
        # 만약 이미 반전되어 있다면 평균 밝기로 감지
        if np.mean(img_arr) > 127:
            img_arr = 255.0 - img_arr

        # 1. 획이 있는 바운딩 박스 찾기 (임계값 30 이상인 픽셀)
        rows = np.any(img_arr > 30, axis=1)
        cols = np.any(img_arr > 30, axis=0)

        if not np.any(rows) or not np.any(cols):
            return None  # 빈 캔버스

        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]

        # 약간의 마진(Padding) 추가
        pad = 10
        h_img, w_img = img_arr.shape
        rmin = max(0, rmin - pad)
        rmax = min(h_img, rmax + pad + 1)
        cmin = max(0, cmin - pad)
        cmax = min(w_img, cmax + pad + 1)

        cropped = img_arr[rmin:rmax, cmin:cmax]
        crop_h, crop_w = cropped.shape

        # 2. 가로세로 비율 유지하며 20x20 박스 내로 리사이즈
        max_dim = max(crop_h, crop_w)
        scale = 20.0 / max_dim
        new_w = max(1, min(20, int(round(crop_w * scale))))
        new_h = max(1, min(20, int(round(crop_h * scale))))

        crop_pil = Image.fromarray(cropped.astype(np.uint8))
        resized_pil = crop_pil.resize((new_w, new_h), Image.Resampling.LANCZOS)
        resized_arr = np.array(resized_pil, dtype=np.float32)

        # 3. 28x28 검은 캔버스에 초기 중앙 배치
        canvas28 = np.zeros((28, 28), dtype=np.float32)
        start_y = (28 - new_h) // 2
        start_x = (28 - new_w) // 2
        canvas28[start_y:start_y + new_h, start_x:start_x + new_w] = resized_arr

        # 4. 질량 중심 (Center of Mass) 계산
        cy, cx = self.calculate_center_of_mass(canvas28)

        # (13.5, 13.5) 중심 정렬을 위한 평행 이동
        shift_x = int(round(13.5 - cx))
        shift_y = int(round(13.5 - cy))

        centered = np.roll(canvas28, shift_y, axis=0)
        centered = np.roll(centered, shift_x, axis=1)

        # roll로 인해 반대편으로 넘어간 픽셀 클리어
        if shift_y > 0:
            centered[:shift_y, :] = 0
        elif shift_y < 0:
            centered[shift_y:, :] = 0

        if shift_x > 0:
            centered[:, :shift_x] = 0
        elif shift_x < 0:
            centered[:, shift_x:] = 0

        # 5. 대비 강화 및 정규화 (0.0 ~ 1.0)
        peak = np.max(centered)
        if peak > 0:
            contrast_boost = 255.0 / max(peak, 160.0)
            centered = np.clip(centered * contrast_boost, 0, 255.0)

        # 노이즈 제거
        centered[centered < 20] = 0
        normalized = centered / 255.0

        return normalized.reshape(1, 28, 28, 1)

    def calculate_center_of_mass(self, img):
        total_mass = np.sum(img)
        if total_mass <= 0:
            return 13.5, 13.5
        y_indices, x_indices = np.indices(img.shape)
        cy = np.sum(y_indices * img) / total_mass
        cx = np.sum(x_indices * img) / total_mass
        return cy, cx

    def predict_digit(self, image_data):
        if self.model is None:
            return []

        preprocessed = self.preprocess_image(image_data)
        if preprocessed is None:
            return []

        predictions = self.model.predict(preprocessed, verbose=0)[0]
        top_indices = np.argsort(predictions)[-3:][::-1]

        results = []
        for idx in top_indices:
            results.append({
                'digit': int(idx),
                'confidence': float(predictions[idx])
            })
        return results

from korean_recognizer import get_korean_recognizer

# Recognizer 싱글톤 인스턴스 (lazy initialize 가능하도록 예외처리)
recognizer = None

def get_recognizer():
    global recognizer
    if recognizer is None:
        print("Initializing digit recognizer...")
        recognizer = DigitRecognizer()
    return recognizer

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/model/<path:filename>')
def serve_model(filename):
    """TensorFlow.js 모델 파일 (model.json, group1-*.bin) 서빙"""
    model_dir = os.path.join(os.path.dirname(__file__), 'model')
    return send_from_directory(model_dir, filename)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(force=True)
        image_data = data.get('image', '')
        if not image_data:
            return jsonify({'success': False, 'error': '이미지 데이터가 없습니다.'})

        rec = get_recognizer()
        predictions = rec.predict_digit(image_data)

        if not predictions:
            return jsonify({
                'success': True,
                'empty': True,
                'message': '캔버스에 숫자를 그려주세요.',
                'predictions': []
            })

        return jsonify({'success': True, 'predictions': predictions})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/predict_korean', methods=['POST'])
def predict_korean():
    try:
        data = request.get_json(force=True)
        image_data = data.get('image', '')
        if not image_data:
            return jsonify({'success': False, 'error': '이미지 데이터가 없습니다.'})

        k_rec = get_korean_recognizer()
        result = k_rec.recognize(image_data)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    get_recognizer()
    app.run(debug=True, port=5000)
