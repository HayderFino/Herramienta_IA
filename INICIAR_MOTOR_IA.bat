@echo off
title MOTOR IA - AMBIENTAL
echo ===================================================
echo   INICIANDO MOTOR DE INTELIGENCIA ARTIFICIAL
echo   Sistema de Monitoreo Ambiental - CAS
echo ===================================================
echo.

:: Verificar si Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se detecto Python en el sistema.
    echo Por favor instala Python 3.10+ y agregalo al PATH.
    pause
    exit /b
)

:: Ir a la carpeta del dashboard donde esta el bridge
cd dashboard-ambiental

:: Instalar dependencias si es necesario
echo [1/2] Verificando dependencias...
pip install -r requirements.txt >nul 2>&1

:: Iniciar el bridge
echo [2/2] Iniciando api_bridge.py en puerto 8000...
echo.
echo Mantén esta ventana abierta mientras uses el Dashboard.
echo.
python api_bridge.py

pause
