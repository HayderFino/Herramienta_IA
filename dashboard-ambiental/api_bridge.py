from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
import shutil, os, glob, json, sys

# Asegurar que modelo.py sea importable
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import modelo
    print("✅ Módulo 'modelo.py' cargado correctamente.")
except ImportError as e:
    print(f"⚠️ Error al cargar 'modelo.py': {e}")
    modelo = None

app = FastAPI(title="Ambiental ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── helpers ────────────────────────────────────────────────────────────────────
def _lote_mas_reciente() -> str | None:
    """Devuelve la ruta al archivo principal del lote de datos más reciente."""
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "datos")
    lotes = sorted(
        [d for d in glob.glob(os.path.join(base, "*")) if os.path.isdir(d)],
        reverse=True,
    )
    for lote in lotes:
        # Preferir CSV "_por hora_" (más datos históricos)
        csvs = sorted(glob.glob(os.path.join(lote, "*_por hora_*.csv")))
        if csvs:
            return csvs[0]
        # Cualquier CSV
        csvs = sorted(glob.glob(os.path.join(lote, "*.csv")))
        if csvs:
            return csvs[0]
        # DUSTMONITOR
        txts = glob.glob(os.path.join(lote, "DUSTMONITOR_*.txt"))
        if txts:
            return txts[0]
    return None

_FALLBACK = {
    "success": False,
    "labels": ["Ahora", "+1h", "+2h", "+3h", "+4h", "+5h"],
    "data": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    "data_unit": "µg/m³",
    "data_label": "PM2.5",
    "mainRisk": "Sin datos",
    "futureTrend": "Inicia api_bridge.py y carga un archivo CSV/TXT desde el panel.",
    "analysis_note": "No se detectaron archivos de datos (CSV/TXT) en la carpeta del proyecto.",
    "recommendations": [],
    "stats": {
        "pm25": 0, "pm25_max": 0, "pm25_p95": 0, "pm25_std": 0,
        "pm10": 0, "pm4": 0, "pm1": 0,
        "temp": 0, "temp_max": 0, "hum": 0,
        "pres": None, "viento_vel": None,
        "n_registros": 0, "n_total": 0, "n_fuentes": 0, "estaciones": [],
    },
}

# ── rutas ──────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API Bridge running correctly"}


@app.get("/api/predict")
async def get_predictions():
    """Análisis automático usando el lote de datos más reciente."""
    if not modelo:
        return _FALLBACK

    try:
        ruta = _lote_mas_reciente()
        result = modelo.analizar_archivo(ruta or "")
        if result.get("success"):
            return result
    except Exception as e:
        print(f"[ERROR] /api/predict: {e}")

    return _FALLBACK


@app.post("/api/predict/upload")
async def upload_file(file: UploadFile = File(...)):
    """Recibe un archivo subido y lo procesa con modelo.py."""
    import importlib
    global modelo
    try:
        importlib.reload(modelo)
        print(f"🔄 Modelo recargado para procesar: {file.filename}")
    except Exception:
        pass

    # Guardar en directorio temporal dentro del proyecto
    tmp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    temp_path = os.path.join(tmp_dir, f"upload_{file.filename}")

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if modelo:
            result = modelo.analizar_archivo(temp_path)
        else:
            result = {"success": False, "error": "Módulo modelo.py no disponible"}

        # Garantizar que stats siempre exista para el frontend
        if result.get("success") and "stats" not in result:
            result["stats"] = _FALLBACK["stats"]

        return result
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


# ── manual data (configuración admin) ─────────────────────────────────────────
MANUAL_DATA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "admin", "manual_data.json"
)


@app.post("/api/manual_data")
async def save_manual_data(request: Request):
    try:
        data = await request.json()
        os.makedirs(os.path.dirname(MANUAL_DATA_PATH), exist_ok=True)
        with open(MANUAL_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "Datos guardados"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/manual_data")
async def get_manual_data():
    if os.path.exists(MANUAL_DATA_PATH):
        try:
            with open(MANUAL_DATA_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando Bridge API para modelo.py...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
