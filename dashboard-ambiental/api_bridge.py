from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import random
import shutil
import os

import sys
import os

# Asegurar que el directorio actual esté en la ruta para importar 'modelo'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import modelo
    print("✅ Módulo 'modelo.py' cargado correctamente.")
except ImportError as e:
    print(f"⚠️ Error al cargar 'modelo.py': {e}")
    modelo = None

app = FastAPI(title="Ambiental ML API")

# Permitir comunicaciones con el dashboard frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/predict")
async def get_predictions():
    """
    Este endpoint será llamado por predictionService.js en el dashboard.
    """
    if modelo:
        data = modelo.obtener_prediccion_actual()
    else:
        data = [random.randint(30,36) for _ in range(6)]
        
    return {
        "labels": ["1h", "2h", "3h", "4h", "5h", "6h"],
        "data": data,
        "mainRisk": "Aumento de temperatura",
        "futureTrend": "Tendencia generada dinámicamente por modelo.py"
    }

@app.post("/api/predict/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Recibe un archivo y lo procesa con la lógica de modelo.py
    """
    import importlib
    global modelo
    try:
        importlib.reload(modelo)
        print(f"🔄 Modelo recargado para procesar: {file.filename}")
    except:
        pass

    temp_path = f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # LLAMADA REAL AL MODELO
        if modelo:
            result = modelo.analizar_archivo(temp_path)
        else:
            result = { "success": False, "error": "Módulo modelo.py no disponible" }
            
        return result
    except Exception as e:
        return { "success": False, "error": str(e) }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando Bridge API para modelo.py...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
