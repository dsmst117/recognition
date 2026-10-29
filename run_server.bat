@echo off
chcp 65001 > nul
echo ========================================================
echo   손글씨 숫자 인식 웹 서버를 실행합니다
echo ========================================================
echo.

:: 1. Node.js npx serve 시도
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [Node.js 감지됨] 로컬 웹 서버를 구동합니다...
    echo 브라우저에서 아래 주소로 접속하세요:
    echo http://localhost:3000 또는 http://localhost:5000
    echo.
    start http://localhost:3000
    npx -y serve . -p 3000
    goto end
)

:: 2. Python http.server 시도
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [Python 감지됨] 로컬 웹 서버를 구동합니다...
    echo http://localhost:8000 으로 접속합니다.
    start http://localhost:8000
    python -m http.server 8000
    goto end
)

:: 3. 기본 브라우저로 index.html 열기
echo 브라우저로 index.html을 직접 엽니다.
echo (주의: 브라우저 보안에 따라 로컬 model.json 파일 읽기가 제한될 수 있습니다)
start index.html

:end
pause
