from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
import shutil, os, glob, json, sys
from datetime import datetime

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
            # Auto-actualizar datos 'tiempo real' para el dashboard
            if "stats" in result:
                _update_manual_weather_from_stats(result["stats"], result.get("mainRisk", "BAJO"))
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

        if result.get("success"):
            # Auto-actualizar datos 'tiempo real' para el dashboard
            if "stats" in result:
                _update_manual_weather_from_stats(result["stats"], result.get("mainRisk", "BAJO"))
            # Garantizar que stats siempre exista para el frontend
            if "stats" not in result:
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
MANUAL_WEATHER_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "admin", "manual_weather.json"
)
PM25_HISTORY_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "admin", "pm25_history.json"
)


def _update_pm25_history(pm25_val: float):
    """Guarda un registro histórico del PM2.5 general."""
    history = []
    if os.path.exists(PM25_HISTORY_PATH):
        try:
            with open(PM25_HISTORY_PATH, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            history = []
    
    # Limitar a los últimos 50 registros para no sobrecargar el gráfico
    if len(history) > 50:
        history = history[-50:]

    history.append({
        "timestamp": datetime.now().strftime("%H:%M"),
        "value": round(float(pm25_val), 2)
    })

    try:
        with open(PM25_HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] No se pudo guardar pm25_history: {e}")


def _update_manual_weather_from_stats(stats: dict, risk: str = "BAJO"):
    """
    Toma los resultados del modelo.py y los guarda como los datos 'en tiempo real'
    para que el dashboard se actualice automáticamente tras un análisis.
    """
    # Mapeo simple de Riesgo a AQI (1-5)
    # 1: Muy Bueno, 2: Bueno, 3: Moderado, 4: Pobre, 5: Muy Pobre
    aqi_map = {
        "BAJO": 2,
        "MODERADO": 3,
        "ALTO": 4,
        "MUY ALTO": 5
    }
    
    pm25_val = stats.get("pm25", 24.3)
    
    manual_weather = {
        "temp": stats.get("temp", 30.0),
        "humidity": stats.get("hum", 74),
        "wind_speed": stats.get("viento_vel", 4.8) or 0.0,
        "pm10": stats.get("pm10", 36.4),
        "pm2_5": pm25_val,
        "aqi": aqi_map.get(risk, 2),
        "timestamp": datetime.now().isoformat(),
        "source": "analytics"
    }
    
    # Actualizar histórico para el gráfico acumulado
    _update_pm25_history(pm25_val)
    
    try:
        os.makedirs(os.path.dirname(MANUAL_WEATHER_PATH), exist_ok=True)
        with open(MANUAL_WEATHER_PATH, "w", encoding="utf-8") as f:
            json.dump(manual_weather, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] No se pudo auto-actualizar manual_weather: {e}")


@app.get("/api/pm25_history")
async def get_pm25_history():
    """Devuelve el historial de PM2.5 para el gráfico de tendencias."""
    if os.path.exists(PM25_HISTORY_PATH):
        try:
            with open(PM25_HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _update_general_weather_from_stations(data: dict):
    """
    Calcula el promedio de todas las estaciones manuales y actualiza
    el estado general del dashboard (manual_weather.json).
    """
    count = 0
    sums = {"temp": 0.0, "hum": 0.0, "wind": 0.0, "pm10": 0.0, "pm25": 0.0, "aqi": 0}
    
    for s_name, s_data in data.items():
        all_d = s_data.get("allData", {})
        try:
            sums["temp"] += float(all_d.get("tem", 0))
            sums["hum"] += float(all_d.get("hum", 0))
            sums["wind"] += float(all_d.get("vel", 0))
            sums["pm10"] += float(all_d.get("pm10", 0))
            sums["pm25"] += float(all_d.get("pm2_5", 0))
            
            # Aproximación de AQI por estación
            pm25 = float(all_d.get("pm2_5", 0))
            aqi = 1
            if pm25 > 75: aqi = 4
            elif pm25 > 50: aqi = 3
            elif pm25 > 25: aqi = 2
            sums["aqi"] += aqi
            
            count += 1
        except (ValueError, TypeError):
            continue
            
    if count > 0:
        avg_stats = {
            "temp": round(sums["temp"] / count, 1),
            "hum": round(sums["hum"] / count, 0),
            "viento_vel": round(sums["wind"] / count, 1),
            "pm10": round(sums["pm10"] / count, 1),
            "pm25": round(sums["pm25"] / count, 1)
        }
        avg_aqi = round(sums["aqi"] / count)
        
        # Mapeo de riesgo basado en AQI promedio
        risk_map = {1: "BAJO", 2: "MODERADO", 3: "ALTO", 4: "MUY ALTO"}
        risk = risk_map.get(avg_aqi, "BAJO")
        
        _update_manual_weather_from_stats(avg_stats, risk)


@app.post("/api/manual_data")
async def save_manual_data(request: Request):
    try:
        data = await request.json()
        os.makedirs(os.path.dirname(MANUAL_DATA_PATH), exist_ok=True)
        with open(MANUAL_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # Sincronizar el panel general con el promedio de las estaciones
        _update_general_weather_from_stations(data)
            
        return {"success": True, "message": "Datos guardados y sincronizados"}
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


@app.post("/api/manual_weather")
async def save_manual_weather(request: Request):
    try:
        data = await request.json()
        os.makedirs(os.path.dirname(MANUAL_WEATHER_PATH), exist_ok=True)
        with open(MANUAL_WEATHER_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "Datos ambientales guardados"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/manual_weather")
async def get_manual_weather():
    if os.path.exists(MANUAL_WEATHER_PATH):
        try:
            with open(MANUAL_WEATHER_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando Bridge API para modelo.py...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
