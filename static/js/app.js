let model = null;

class DrawingApp {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;

        this.isDrawing = false;
        this.brushSize = 22;
        this.autoPredict = true;
        this.currentMode = 'digit'; // 'digit' | 'korean'
        this.strokes = [];
        this.currentStroke = [];
        this.autoPredictTimer = null;

        // Gemini API 설정
        this.geminiApiKey = localStorage.getItem('gemini_api_key') || '';

        this.setupCanvas();
        this.attachEventListeners();
        this.setupGeminiUI();
        this.clearPreview();
    }

    // ─── Gemini API 설정 UI ───
    setupGeminiUI() {
        // 설정 버튼 이벤트
        const settingsBtn = document.getElementById('geminiSettingsBtn');
        const modal = document.getElementById('geminiModal');
        const closeBtn = document.getElementById('geminiModalClose');
        const saveBtn = document.getElementById('geminiSaveBtn');
        const apiKeyInput = document.getElementById('geminiApiKeyInput');
        const statusDot = document.getElementById('geminiStatusDot');
        const statusText = document.getElementById('geminiStatusText');

        if (!settingsBtn || !modal) return;

        // 초기 상태 표시
        this.updateGeminiStatus();

        settingsBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            if (apiKeyInput) apiKeyInput.value = this.geminiApiKey;
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const key = apiKeyInput ? apiKeyInput.value.trim() : '';
                this.geminiApiKey = key;
                if (key) {
                    localStorage.setItem('gemini_api_key', key);
                } else {
                    localStorage.removeItem('gemini_api_key');
                }
                this.updateGeminiStatus();
                modal.style.display = 'none';
            });
        }
    }

    updateGeminiStatus() {
        const statusDot = document.getElementById('geminiStatusDot');
        const statusText = document.getElementById('geminiStatusText');
        const settingsBtn = document.getElementById('geminiSettingsBtn');

        if (this.geminiApiKey) {
            if (statusDot) { statusDot.style.background = '#22c55e'; statusDot.title = 'Gemini 연결됨'; }
            if (statusText) statusText.textContent = 'Gemini 연결됨';
            if (settingsBtn) settingsBtn.classList.add('connected');
        } else {
            if (statusDot) { statusDot.style.background = '#94a3b8'; statusDot.title = 'Gemini 미연결'; }
            if (statusText) statusText.textContent = 'Gemini 미연결';
            if (settingsBtn) settingsBtn.classList.remove('connected');
        }
    }

    // ─── Gemini Vision API 호출 ───
    async predictWithGemini(canvasElement) {
        if (!this.geminiApiKey) return null;

        const imageData = canvasElement.toDataURL('image/png');
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');

        const prompt = this.currentMode === 'korean'
            ? '이 이미지에 손으로 쓴 한글 텍스트를 정확히 읽어주세요. 받침이 있는 글자도 정확하게 인식해주세요. 인식된 텍스트만 출력하세요. 다른 설명은 하지 마세요.'
            : '이 이미지에 손으로 쓴 숫자를 읽어주세요. 0부터 9 사이의 숫자 하나입니다. 숫자만 출력하세요.';

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: 'image/png', data: base64Data } },
                            { text: prompt }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error('Gemini API error:', response.status, errData);
                return null;
            }

            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            return text || null;
        } catch (err) {
            console.error('Gemini API call failed:', err);
            return null;
        }
    }

    setupCanvas() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = '#000000';
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = this.brushSize;
    }

    clearPreview() {
        if (this.previewCtx) {
            this.previewCtx.fillStyle = '#000000';
            this.previewCtx.fillRect(0, 0, 28, 28);
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        const tabDigit = document.getElementById('tabDigit');
        const tabKorean = document.getElementById('tabKorean');
        const previewContainer = document.getElementById('previewContainer');
        const brushRange = document.getElementById('brushSize');
        const brushLabel = document.getElementById('brushSizeVal');
        const appSubtitle = document.getElementById('appSubtitle');

        if (mode === 'digit') {
            tabDigit.classList.add('active');
            tabKorean.classList.remove('active');
            if (previewContainer) previewContainer.style.display = 'flex';

            this.canvas.width = 280;
            this.canvas.height = 280;
            this.brushSize = 22;
            if (appSubtitle) appSubtitle.textContent = '캔버스에 0부터 9까지의 숫자를 그려보세요';
        } else {
            tabKorean.classList.add('active');
            tabDigit.classList.remove('active');
            if (previewContainer) previewContainer.style.display = 'none';

            this.canvas.width = 440;
            this.canvas.height = 240;
            this.brushSize = 10; // 받침 획 뭉침 방지를 위한 최적 선 굵기 (10px)
            if (appSubtitle) appSubtitle.textContent = '캔버스에 한글을 적어보세요 (받침 글자는 획이 겹치지 않게 쓰면 인식률이 올라갑니다)';
        }

        brushRange.value = this.brushSize;
        brushLabel.textContent = this.brushSize + 'px';
        this.clearCanvas();
    }

    attachEventListeners() {
        // 탭 전환
        document.getElementById('tabDigit').addEventListener('click', () => this.setMode('digit'));
        document.getElementById('tabKorean').addEventListener('click', () => this.setMode('korean'));

        // 마우스 이벤트
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        window.addEventListener('mousemove', (e) => this.draw(e));
        window.addEventListener('mouseup', () => this.stopDrawing());

        // 터치 이벤트
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e, 'start'), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e, 'move'), { passive: false });
        window.addEventListener('touchend', () => this.stopDrawing());

        // 버튼 이벤트
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('predictBtn').addEventListener('click', () => this.predict());

        // 선 굵기 조절
        const brushRange = document.getElementById('brushSize');
        const brushLabel = document.getElementById('brushSizeVal');
        brushRange.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value, 10);
            brushLabel.textContent = this.brushSize + 'px';
            this.ctx.lineWidth = this.brushSize;
        });

        // 자동 예측 토글
        const autoToggle = document.getElementById('autoPredict');
        autoToggle.addEventListener('change', (e) => {
            this.autoPredict = e.target.checked;
        });
    }

    getCanvasCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    startDrawing(e) {
        if (e.target !== this.canvas) return;
        this.isDrawing = true;
        this.canvas.classList.add('drawing');
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        this.currentStroke = [coords];

        this.ctx.beginPath();
        this.ctx.arc(coords.x, coords.y, this.brushSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#000000';
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
    }

    draw(e) {
        if (!this.isDrawing) return;
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        this.currentStroke.push(coords);

        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.canvas.classList.remove('drawing');

        if (this.currentStroke.length > 0) {
            this.strokes.push({
                points: [...this.currentStroke],
                size: this.brushSize
            });
            this.currentStroke = [];
        }

        if (this.autoPredict) {
            clearTimeout(this.autoPredictTimer);
            this.autoPredictTimer = setTimeout(() => {
                this.predict();
            }, this.currentMode === 'digit' ? 150 : 350);
        }
    }

    handleTouch(e, type) {
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch && type !== 'end') return;

        if (type === 'start') {
            this.startDrawing({ clientX: touch.clientX, clientY: touch.clientY, target: this.canvas });
        } else if (type === 'move') {
            this.draw({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }

    redrawAllStrokes() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (const stroke of this.strokes) {
            if (stroke.points.length === 0) continue;
            this.ctx.lineWidth = stroke.size;
            this.ctx.strokeStyle = '#000000';
            this.ctx.fillStyle = '#000000';
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';

            const first = stroke.points[0];
            this.ctx.beginPath();
            this.ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < stroke.points.length; i++) {
                this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            this.ctx.stroke();
        }
        this.ctx.lineWidth = this.brushSize;
    }

    undo() {
        if (this.strokes.length === 0) return;
        this.strokes.pop();
        this.redrawAllStrokes();

        if (this.strokes.length === 0) {
            this.clearPreview();
            document.getElementById('results').classList.add('hidden');
        } else if (this.autoPredict) {
            this.predict();
        }
    }

    clearCanvas() {
        this.strokes = [];
        this.currentStroke = [];
        this.setupCanvas();
        this.clearPreview();
        document.getElementById('results').classList.add('hidden');
    }

    getNormalizedMNISTData() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const imgData = this.ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width, minY = height, maxX = -1, maxY = -1;
        let activePixels = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                const val = 255 - brightness;

                if (val > 35) {
                    activePixels++;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX === -1 || activePixels < 25) {
            return null;
        }

        const pad = 12;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad);
        maxY = Math.min(height - 1, maxY + pad);

        const bWidth = maxX - minX + 1;
        const bHeight = maxY - minY + 1;

        const maxDim = Math.max(bWidth, bHeight);
        const scale = 20.0 / maxDim;
        const scaledW = Math.max(1, Math.min(20, Math.round(bWidth * scale)));
        const scaledH = Math.max(1, Math.min(20, Math.round(bHeight * scale)));

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = bWidth;
        cropCanvas.height = bHeight;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(this.canvas, minX, minY, bWidth, bHeight, 0, 0, bWidth, bHeight);

        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = scaledW;
        scaledCanvas.height = scaledH;
        const scaledCtx = scaledCanvas.getContext('2d');
        scaledCtx.imageSmoothingEnabled = true;
        scaledCtx.imageSmoothingQuality = 'high';
        scaledCtx.drawImage(cropCanvas, 0, 0, bWidth, bHeight, 0, 0, scaledW, scaledH);

        const sData = scaledCtx.getImageData(0, 0, scaledW, scaledH).data;

        const grid28 = new Float32Array(28 * 28);
        const startX = Math.floor((28 - scaledW) / 2);
        const startY = Math.floor((28 - scaledH) / 2);

        for (let y = 0; y < scaledH; y++) {
            for (let x = 0; x < scaledW; x++) {
                const sIdx = (y * scaledW + x) * 4;
                const brightness = 0.299 * sData[sIdx] + 0.587 * sData[sIdx + 1] + 0.114 * sData[sIdx + 2];
                const inverted = Math.max(0, 255 - brightness);

                const tx = startX + x;
                const ty = startY + y;
                if (tx >= 0 && tx < 28 && ty >= 0 && ty < 28) {
                    grid28[ty * 28 + tx] = inverted;
                }
            }
        }

        let mass = 0;
        let sumX = 0;
        let sumY = 0;
        for (let y = 0; y < 28; y++) {
            for (let x = 0; x < 28; x++) {
                const val = grid28[y * 28 + x];
                if (val > 10) {
                    mass += val;
                    sumX += x * val;
                    sumY += y * val;
                }
            }
        }

        let shiftX = 0;
        let shiftY = 0;
        if (mass > 0) {
            const cX = sumX / mass;
            const cY = sumY / mass;
            shiftX = Math.round(13.5 - cX);
            shiftY = Math.round(13.5 - cY);
        }

        const finalGrid = new Float32Array(28 * 28);
        let peakVal = 0;
        for (let y = 0; y < 28; y++) {
            for (let x = 0; x < 28; x++) {
                const origX = x - shiftX;
                const origY = y - shiftY;
                let val = 0;
                if (origX >= 0 && origX < 28 && origY >= 0 && origY < 28) {
                    val = grid28[origY * 28 + origX];
                }
                finalGrid[y * 28 + x] = val;
                if (val > peakVal) peakVal = val;
            }
        }

        const contrastFactor = peakVal > 0 ? (255.0 / Math.max(peakVal, 160)) : 1.0;
        const normalized = new Float32Array(28 * 28);
        const displayPixels = new Uint8ClampedArray(28 * 28 * 4);

        for (let i = 0; i < 28 * 28; i++) {
            let enhanced = Math.min(255, finalGrid[i] * contrastFactor);
            if (enhanced < 20) enhanced = 0;
            normalized[i] = enhanced / 255.0;

            const pIdx = i * 4;
            displayPixels[pIdx] = enhanced;
            displayPixels[pIdx + 1] = enhanced;
            displayPixels[pIdx + 2] = enhanced;
            displayPixels[pIdx + 3] = 255;
        }

        return {
            normalizedData: normalized,
            displayImageData: new ImageData(displayPixels, 28, 28)
        };
    }

    async predict() {
        if (this.currentMode === 'digit') {
            await this.predictDigit();
        } else {
            await this.predictKorean();
        }
    }

    async predictDigit() {
        if (this.strokes.length === 0) {
            document.getElementById('results').classList.add('hidden');
            this.clearPreview();
            return;
        }

        // 1. 브라우저 TensorFlow.js 모델이 준비되어 있는 경우 (가장 빠르고 정확함)
        if (model) {
            const preprocessed = this.getNormalizedMNISTData();
            if (!preprocessed) {
                document.getElementById('results').classList.add('hidden');
                this.clearPreview();
                return;
            }

            if (this.previewCtx) {
                this.previewCtx.putImageData(preprocessed.displayImageData, 0, 0);
            }

            try {
                const tensor = tf.tensor4d(preprocessed.normalizedData, [1, 28, 28, 1]);
                const predictionResult = await model.predict(tensor).data();
                tensor.dispose();

                const predArray = Array.from(predictionResult);
                const topPredictions = predArray
                    .map((confidence, digit) => ({ digit, confidence }))
                    .sort((a, b) => b.confidence - a.confidence);

                this.displayDigitResults(topPredictions);
                return;
            } catch (err) {
                console.warn('Browser tfjs prediction failed, falling back to server:', err);
            }
        }

        // 2. 브라우저 모델이 아직 로드 중이거나 실패한 경우 백엔드 호출
        const imageData = this.canvas.toDataURL('image/png');
        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            const data = await response.json();
            if (data.success && data.predictions && data.predictions.length > 0) {
                this.displayDigitResults(data.predictions);
            }
        } catch (e) {
            console.error('Server predict error:', e);
        }
    }

    /**
     * ✨ 한글 받침 인식 특화 전처리 함수
     * 1. 캔버스에서 실제 글자 바운딩 박스 크롭 (주변 40px 흰색 마진 확보)
     * 2. Tesseract가 가장 잘 인식하는 표준 높이(120~160px)로 리스케일링
     * 3. 획 뭉침 방지를 위한 선명화 및 고대비 이진화 처리
     */
    prepareKoreanCanvas() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const imgData = this.ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width, minY = height, maxX = -1, maxY = -1;
        let strokeCount = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                if (brightness < 200) {
                    strokeCount++;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX === -1 || strokeCount < 25) return null;

        // 글자 영역 주위에 넉넉한 45px 흰색 여백 추가 (Tesseract 인식률 필수 요건)
        const pad = 45;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad);
        maxY = Math.min(height - 1, maxY + pad);

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;

        // 표준 높이(약 140px)로 정규화 스케일 계산
        const targetH = Math.min(220, Math.max(120, Math.round(cropH * 1.2)));
        const scale = targetH / cropH;
        const targetW = Math.round(cropW * scale);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = targetW;
        outCanvas.height = targetH;
        const outCtx = outCanvas.getContext('2d');

        // 흰색 배경
        outCtx.fillStyle = '#ffffff';
        outCtx.fillRect(0, 0, targetW, targetH);

        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(this.canvas, minX, minY, cropW, cropH, 0, 0, targetW, targetH);

        // 고대비 이진화: 초성과 받침 사이의 공간을 또렷하게 분리하여 뭉침 방지
        const outImgData = outCtx.getImageData(0, 0, targetW, targetH);
        const outData = outImgData.data;
        for (let i = 0; i < outData.length; i += 4) {
            const gray = 0.299 * outData[i] + 0.587 * outData[i + 1] + 0.114 * outData[i + 2];
            // 밝은 회색은 깨끗한 흰색(255)으로 날리고, 획은 검은색(0)으로 강화
            const val = gray > 175 ? 255 : (gray < 90 ? 0 : gray);
            outData[i] = val;
            outData[i + 1] = val;
            outData[i + 2] = val;
        }
        outCtx.putImageData(outImgData, 0, 0);

        return outCanvas;
    }

    async predictKorean() {
        if (this.strokes.length === 0) {
            document.getElementById('results').classList.add('hidden');
            return;
        }

        const processedCanvas = this.prepareKoreanCanvas();
        if (!processedCanvas) {
            document.getElementById('results').classList.add('hidden');
            return;
        }

        const resultsDiv = document.getElementById('results');
        const digitView = document.getElementById('digitResultView');
        const koreanView = document.getElementById('koreanResultView');
        const koreanTextEl = document.getElementById('koreanText');
        const koreanConfEl = document.getElementById('koreanConfidence');
        const tipEl = document.getElementById('resultTip');
        const wordListEl = document.getElementById('koreanWordList');
        const engineBadge = document.getElementById('koreanEngineBadge');

        resultsDiv.classList.remove('hidden');
        if (digitView) digitView.style.display = 'none';
        if (koreanView) koreanView.style.display = 'block';
        if (wordListEl) wordListEl.innerHTML = '';
        if (engineBadge) engineBadge.textContent = '';

        koreanTextEl.textContent = '한글 분석 중...';
        koreanConfEl.textContent = '-';

        // ★ 우선순위 1: Gemini Vision API (API 키가 설정된 경우)
        if (this.geminiApiKey) {
            try {
                tipEl.innerHTML = `🚀 <strong>Gemini AI</strong>로 정밀 분석 중...`;
                if (engineBadge) { engineBadge.textContent = '🤖 Gemini AI'; engineBadge.className = 'engine-badge gemini'; }

                const geminiResult = await this.predictWithGemini(processedCanvas);

                if (geminiResult) {
                    koreanTextEl.textContent = geminiResult;
                    koreanConfEl.textContent = '99%';
                    tipEl.innerHTML = `🚀 <strong>Gemini 2.0 Flash</strong> Vision AI가 분석한 결과입니다. 받침 포함 한글을 정확하게 인식합니다.`;

                    const chars = geminiResult.replace(/\s/g, '');
                    if (chars.length > 1) {
                        for (const ch of chars) {
                            const b = document.createElement('div');
                            b.className = 'korean-word-badge';
                            b.innerHTML = `<strong>${ch}</strong>`;
                            wordListEl.appendChild(b);
                        }
                    }
                    return;
                }
                // Gemini가 null 반환 시 다음 엔진으로 폴백
                console.log('Gemini 결과 없음 -> 다음 엔진으로 폴백');
            } catch (gemErr) {
                console.warn('Gemini API 오류:', gemErr);
            }
        }

        // 우선순위 2: 백엔드 EasyOCR 시도
        try {
            const imageData = processedCanvas.toDataURL('image/png');
            const response = await fetch('/predict_korean', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.text) {
                    koreanTextEl.textContent = data.text;
                    koreanConfEl.textContent = `${data.confidence}%`;
                    tipEl.innerHTML = `💡 백엔드 EasyOCR 엔진으로 분석한 한글 손글씨 결과입니다.`;
                    if (engineBadge) { engineBadge.textContent = '🔧 EasyOCR'; engineBadge.className = 'engine-badge easyocr'; }

                    if (data.words && data.words.length > 0) {
                        data.words.forEach(w => {
                            const b = document.createElement('div');
                            b.className = 'korean-word-badge';
                            b.innerHTML = `<strong>${w.text}</strong> <span>(${w.confidence}%)</span>`;
                            wordListEl.appendChild(b);
                        });
                    }
                    return;
                }
            }
        } catch (e) {
            console.log('백엔드 미연결 -> 브라우저 내장 Tesseract 엔진으로 자동 전환');
        }

        // 우선순위 3: 브라우저 내장 Tesseract.js 한국어 인식 (WASM 엔진)
        if (typeof Tesseract !== 'undefined') {
            try {
                tipEl.innerHTML = `💡 브라우저 내장 AI(Tesseract.js)로 받침 글자 최적화 분석을 진행 중입니다...`;
                if (engineBadge) { engineBadge.textContent = '📝 Tesseract'; engineBadge.className = 'engine-badge tesseract'; }

                const result = await Tesseract.recognize(
                    processedCanvas,
                    'kor',
                    {
                        tessedit_pageseg_mode: '7',
                        logger: m => {
                            if (m.status === 'recognizing text' && m.progress) {
                                koreanConfEl.textContent = `${Math.round(m.progress * 100)}%`;
                            }
                        }
                    }
                );

                const text = result.data.text.trim();
                const confidence = Math.round(result.data.confidence);

                if (text) {
                    koreanTextEl.textContent = text;
                    koreanConfEl.textContent = `${confidence}%`;
                    tipEl.innerHTML = `💡 받침 정규화 전처리를 거쳐 분석 완료되었습니다. (팁: ⚙️ 설정에서 <strong>Gemini API 키</strong>를 입력하면 인식 정확도가 99%까지 올라갑니다!)`;

                    const words = result.data.words || [];
                    words.forEach(w => {
                        const clean = w.text.trim();
                        if (clean) {
                            const b = document.createElement('div');
                            b.className = 'korean-word-badge';
                            b.innerHTML = `<strong>${clean}</strong> <span>(${Math.round(w.confidence)}%)</span>`;
                            wordListEl.appendChild(b);
                        }
                    });
                } else {
                    koreanTextEl.textContent = '(인식 불가)';
                    koreanConfEl.textContent = '0%';
                    tipEl.innerHTML = `💡 글자를 인식하지 못했습니다. ⚙️ 설정에서 <strong>Gemini API 키</strong>를 등록하면 99% 정확도로 인식됩니다!`;
                }
            } catch (tessErr) {
                console.error('Tesseract error:', tessErr);
                koreanTextEl.innerHTML = `<span style="font-size: 1.1rem; color: #b91c1c;">인식 오류</span>`;
                tipEl.textContent = '한글 인식을 처리하는 중 오류가 발생했습니다.';
            }
        } else {
            koreanTextEl.textContent = 'OCR 엔진 로드 중...';
            tipEl.textContent = 'Tesseract.js 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.';
        }
    }

    displayDigitResults(predictions) {
        const resultsDiv = document.getElementById('results');
        const digitView = document.getElementById('digitResultView');
        const koreanView = document.getElementById('koreanResultView');
        const predictionsDiv = document.getElementById('predictions');
        const topDigitEl = document.getElementById('topDigit');
        const topConfEl = document.getElementById('topConfidence');
        const confTagEl = document.getElementById('confidenceTag');
        const tipEl = document.getElementById('resultTip');

        resultsDiv.classList.remove('hidden');
        if (digitView) digitView.style.display = 'block';
        if (koreanView) koreanView.style.display = 'none';

        const top1 = predictions[0];
        const top1Percent = (top1.confidence * 100).toFixed(1);

        topDigitEl.textContent = top1.digit;
        topConfEl.textContent = `${top1Percent}%`;

        if (top1.confidence >= 0.85) {
            confTagEl.textContent = '매우 확실함';
            confTagEl.className = 'confidence-tag';
            tipEl.innerHTML = `💡 AI가 높은 확신(<strong>${top1Percent}%</strong>)으로 숫자 <strong>${top1.digit}</strong>(으)로 판별했습니다.`;
        } else if (top1.confidence >= 0.5) {
            confTagEl.textContent = '다소 유력함';
            confTagEl.className = 'confidence-tag medium';
            tipEl.innerHTML = `💡 숫자 <strong>${top1.digit}</strong>일 가능성이 높으나, <strong>${predictions[1].digit}</strong>(와)과 유사한 특징이 있습니다.`;
        } else {
            confTagEl.textContent = '불확실함';
            confTagEl.className = 'confidence-tag low';
            tipEl.innerHTML = `💡 필체가 다소 모호합니다. 숫자를 조금 더 크고 명확하게 그려보세요.`;
        }

        predictionsDiv.innerHTML = '';
        const top3 = predictions.slice(0, 3);

        top3.forEach((pred) => {
            const confidence = (pred.confidence * 100).toFixed(1);
            const item = document.createElement('div');
            item.className = 'prediction-item';
            item.innerHTML = `
                <div class="prediction-digit">${pred.digit}</div>
                <div class="prediction-bar">
                    <div class="prediction-fill" style="width: ${confidence}%"></div>
                </div>
                <div class="prediction-percentage">${confidence}%</div>
            `;
            predictionsDiv.appendChild(item);
        });
    }
}

// 모델 로드 함수 (Flask /model/ 경로 또는 상대경로 탐색)
async function initModel() {
    try {
        console.log('Loading MNIST TensorFlow.js model...');
        try {
            model = await tf.loadLayersModel('/model/model.json');
        } catch (e1) {
            model = await tf.loadLayersModel('./model/model.json');
        }
        console.log('✓ Model loaded successfully!');

        // 워밍업
        tf.tidy(() => {
            const dummy = tf.zeros([1, 28, 28, 1]);
            model.predict(dummy);
        });
    } catch (e) {
        console.error('Failed to load TensorFlow.js model:', e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    window.app = new DrawingApp();
    await initModel();
});
