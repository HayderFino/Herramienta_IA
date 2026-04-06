# Dashboard Ambiental - Guía de Configuración y Uso

Este proyecto consiste en un **Dashboard Ambiental** con una **API de Machine Learning** integrada. Sigue estos pasos para portar el proyecto a otro computador y activarlo correctamente.

## 1. Requisitos Previos
- Tener instalado **Python 3.10** o superior.
- Asegúrate de tener los archivos del proyecto en una carpeta (ej: `herrameinta IA`).

## 2. Preparación del Entorno (Solo la primera vez)

Abre una terminal en la carpeta principal del proyecto y ejecuta:

```powershell
# Crear el entorno virtual
python -m venv .venv

# Activar el entorno (Windows)
.\.venv\Scripts\activate

# Actualizar pip
python -m pip install --upgrade pip

# Instalar las librerías necesarias
pip install -r dashboard-ambiental/requirements.txt
```

## 3. Activación de Servicios

Para visualizar el dashboard completo, necesitas abrir **dos terminales** diferentes:

### Terminal A: Backend (API Bridge)
Es el "cerebro" que procesa los archivos CSV y genera las predicciones.
```powershell
# En la primera terminal ativa el entorno e inicia la API:
.\.venv\Scripts\activate
python dashboard-ambiental/api_bridge.py
```
*El servicio se activará en: `http://localhost:8000`*

### Terminal B: Frontend (Visualización)
Es la interfaz web para el usuario.
```powershell
# En la segunda terminal ativa el entorno e inicia el servidor de archivos:
.\.venv\Scripts\activate
python -m http.server 3000 --directory dashboard-ambiental
```
*El dashboard se activará en: `http://localhost:3000`*

## 4. Visualización e Interaccón
Una vez ambos servicios estén corriendo, abre tu navegador y entra a:
👉 [**http://localhost:3000**](http://localhost:3000)

## Estructura de Puertos
- **Puerto 3000**: Interfaz visual (Dashboard).
- **Puerto 8000**: Conexión con el modelo de ML (API).
