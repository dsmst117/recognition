"""
MNIST 고정확도 및 실전 손글씨 강건성(Robustness) 향상 모델 학습 스크립트
- 데이터 증강 (회전, 이동, 줌) 적용으로 실전 마우스/터치 드로잉 일반화 극대화
- CNN + Batch Normalization + Dropout 구조
"""
import os
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np

def train_robust_mnist_model():
    print("1. MNIST 데이터셋 로드 및 전처리 중...")
    (x_train, y_train), (x_test, y_test) = keras.datasets.mnist.load_data()

    # [0, 1] 정규화 및 채널 차원 추가 (28, 28, 1)
    x_train = x_train.reshape(-1, 28, 28, 1).astype('float32') / 255.0
    x_test = x_test.reshape(-1, 28, 28, 1).astype('float32') / 255.0
    y_train = keras.utils.to_categorical(y_train, 10)
    y_test = keras.utils.to_categorical(y_test, 10)

    print("2. 데이터 증강(Data Augmentation) 및 고성능 CNN 모델 구성 중...")
    # 실전 필체 왜곡에 강건하도록 데이터 증강 레이어 포함
    model = keras.Sequential([
        layers.Input(shape=(28, 28, 1)),
        # 증강 레이어: 가벼운 회전, 이동, 줌 (손글씨 변형 커버)
        layers.RandomRotation(0.08, fill_mode='constant', fill_value=0.0),
        layers.RandomTranslation(0.08, 0.08, fill_mode='constant', fill_value=0.0),
        layers.RandomZoom(0.08, fill_mode='constant', fill_value=0.0),

        # 첫 번째 합성곱 블록
        layers.Conv2D(32, (3, 3), padding='same', activation='relu'),
        layers.BatchNormalization(),
        layers.Conv2D(32, (3, 3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # 두 번째 합성곱 블록
        layers.Conv2D(64, (3, 3), padding='same', activation='relu'),
        layers.BatchNormalization(),
        layers.Conv2D(64, (3, 3), activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),

        # 완전 연결 계층
        layers.Flatten(),
        layers.Dense(128, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.4),
        layers.Dense(10, activation='softmax')
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    model.summary()

    # 콜백: 조기 종료 및 학습률 감쇠
    callbacks = [
        keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, min_lr=1e-5)
    ]

    print("3. 모델 학습 시작 (최대 15 에포크)...")
    history = model.fit(
        x_train, y_train,
        epochs=15,
        batch_size=128,
        validation_split=0.1,
        callbacks=callbacks,
        verbose=1
    )

    print("4. 테스트 세트 최종 평가 중...")
    test_loss, test_acc = model.evaluate(x_test, y_test, verbose=0)
    print(f"=====================================")
    print(f"  최종 테스트 정확도: {test_acc * 100:.2f}%")
    print(f"=====================================")

    # 모델 저장 (H5 및 SavedModel 포맷)
    output_path = 'mnist_model.h5'
    model.save(output_path)
    print(f"✓ 모델이 성공적으로 저장되었습니다: {output_path}")

    return model

if __name__ == '__main__':
    train_robust_mnist_model()
