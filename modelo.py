"""
modelo.py — Motor de análisis de calidad del aire
Versión 2.0 — Producción

Fuentes soportadas:
  1. DUSTMONITOR_<serial>_<fecha>.txt  — sensor minuto a minuto, separado por TAB
  2. <Estacion>_perfil_horario_*.csv   — perfil horario de 24h, separado por ';'

Autor: refactorizado para precisión y robustez en producción.
"""

from __future__ import annotations

import glob
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
# Forzar encoding UTF-8 en el handler para evitar UnicodeEncodeError en Windows
for _h in logging.root.handlers:
    if hasattr(_h, 'stream') and hasattr(_h.stream, 'reconfigure'):
        try:
            _h.stream.reconfigure(encoding='utf-8')
        except Exception:
            pass
log = logging.getLogger("modelo")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Normas ICA Colombia — Resolución 2254 de 2017
# Promedio 24 h para PM2.5 (µg/m³)
# ---------------------------------------------------------------------------
_ICA_PM25_24H: list[tuple[float, float, str, str, str]] = [
    (0,    12.0,  "Buena",           "success", "fa-leaf"),
    (12.0, 37.5,  "Moderada",        "info",    "fa-check-circle"),
    (37.5, 55.0,  "Dañina GS",       "warning", "fa-mask"),
    (55.0, 150.0, "Dañina",          "danger",  "fa-skull-crossbones"),
    (150.0, 9999, "Peligrosa",       "danger",  "fa-biohazard"),
]

# Límite anual OMS 2021: 5 µg/m³ (referencia adicional)
OMS_ANUAL_PM25 = 5.0

def clasificar_pm25(valor: float) -> tuple[str, str, str]:
    """Devuelve (etiqueta, tipo_bootstrap, icono_fa) según ICA Colombia 24 h."""
    for lo, hi, label, tipo, icon in _ICA_PM25_24H:
        if lo <= valor < hi:
            return label, tipo, icon
    return "Peligrosa", "danger", "fa-biohazard"


# ---------------------------------------------------------------------------
# Dataclass de resultado por fuente
# ---------------------------------------------------------------------------
@dataclass
class FuenteDatos:
    nombre: str
    tipo: str           # "dustmonitor" | "estacion_csv"
    archivo: str
    pm25: list[float] = field(default_factory=list)
    pm10: list[float] = field(default_factory=list)
    pm4:  list[float] = field(default_factory=list)
    pm1:  list[float] = field(default_factory=list)
    temp: list[float] = field(default_factory=list)
    hum:  list[float] = field(default_factory=list)
    pres: list[float] = field(default_factory=list)
    viento_vel: list[float] = field(default_factory=list)
    viento_dir: list[float] = field(default_factory=list)
    timestamps: list[str] = field(default_factory=list)
    n_registros: int = 0

    def valido(self) -> bool:
        return bool(self.pm25 or self.temp)


# ---------------------------------------------------------------------------
# PARSER 1 — CSV de estación (perfil horario / por hora)
# ---------------------------------------------------------------------------
def _limpiar_col(c: str) -> str:
    """Quita BOM, comillas, unidades entre paréntesis y espacios."""
    c = c.strip().lstrip("\ufeff").replace('"', '')
    c = re.sub(r'\s*\([^)]*\)', '', c)
    return c.strip()


def _buscar_col(cols_map: dict[str, str], patrones: list[str]) -> Optional[str]:
    """Búsqueda case-insensitive con prioridad de lista de patrones."""
    for pat in patrones:
        for k, v in cols_map.items():
            if pat in k:
                return v
    return None


def leer_csv_estacion(ruta: str) -> Optional[FuenteDatos]:
    """
    Lee CSVs de estaciones SPC/OMA.
    Línea 1 → metadatos  (nombre estación ; tipo reporte)
    Línea 2 → encabezados con separador ';'
    Línea 3+ → datos numéricos
    Decimal: punto  |  Separador de miles: ninguno
    """
    try:
        with open(ruta, encoding="utf-8-sig") as f:
            lineas = f.readlines()

        if len(lineas) < 3:
            log.warning("CSV demasiado corto: %s", ruta)
            return None

        # — Metadatos (línea 1) —
        meta = [x.strip().replace('"', '') for x in lineas[0].strip().split(';')]
        nombre   = meta[0] if meta else os.path.basename(ruta)
        tipo_rep = meta[1] if len(meta) > 1 else "desconocido"

        # — Encabezados (línea 2) —
        headers = [_limpiar_col(h) for h in lineas[1].strip().split(';')]

        # — Datos (línea 3+) —
        filas = []
        for ln in lineas[2:]:
            ln = ln.strip()
            if not ln:
                continue
            partes = [p.strip().replace('"', '') for p in ln.split(';')]
            # Rellenar si faltan columnas
            while len(partes) < len(headers):
                partes.append('')
            filas.append(partes[:len(headers)])

        if not filas:
            log.warning("CSV sin filas de datos: %s", ruta)
            return None

        df = pd.DataFrame(filas, columns=headers)

        # Convertir numéricas (la columna Hora/Fecha queda como str/int según caso)
        for col in df.columns:
            if col.lower() not in ('hora', 'fecha'):
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # Filtrar flags de sensor desconectado (valores < -9000)
        num_cols = df.select_dtypes(include=[np.number]).columns
        df[num_cols] = df[num_cols].where(df[num_cols] > -9000, other=np.nan)

        cols_map = {c.lower(): c for c in df.columns}

        def _ext(pats: list[str]) -> list[float]:
            col = _buscar_col(cols_map, pats)
            if col is None:
                return []
            serie = df[col].dropna()
            serie = serie[serie >= 0]   # descartar negativos físicamente imposibles
            return serie.tolist()

        # Timestamps (Hora o Fecha)
        col_ts = cols_map.get('hora') or cols_map.get('fecha')
        ts = df[col_ts].astype(str).tolist() if col_ts else []

        fuente = FuenteDatos(
            nombre=nombre,
            tipo="estacion_csv",
            archivo=os.path.basename(ruta),
            pm25=_ext(['pm2.5', 'pm2,5', 'pm25']),
            pm10=_ext(['pm10']),
            pm4 =_ext(['pm4']),
            pm1 =_ext(['pm1']),
            temp=_ext(['temp int', 'temp', 'temperatura']),
            hum =_ext(['humedad int', 'humedad', 'hum']),
            timestamps=ts,
        )
        fuente.n_registros = max(len(fuente.pm25), len(fuente.temp))

        log.info("CSV estacion '%s' -> %d registros PM2.5, %d temp",
                 nombre, len(fuente.pm25), len(fuente.temp))
        return fuente if fuente.valido() else None

    except Exception:
        log.exception("Error leyendo CSV estación '%s'", ruta)
        return None


# ---------------------------------------------------------------------------
# PARSER 2 — DUSTMONITOR TXT (TAB-separated, ~12 000 filas/mes)
# ---------------------------------------------------------------------------
def leer_dustmonitor(ruta: str) -> Optional[FuenteDatos]:
    """
    Lee archivos DUSTMONITOR_<serial>_<fecha>.txt con separador TAB.
    Columnas clave: PM1, PM2.5, PM4, PM10, T, rH, p, date, time
    También extrae velocidad/dirección de viento si están presentes.
    """
    try:
        log.info("Leyendo DUSTMONITOR: %s", os.path.basename(ruta))
        df = pd.read_csv(
            ruta,
            sep="\t",
            encoding="latin-1",
            on_bad_lines='skip',
            low_memory=False,
        )
        df.columns = [str(c).strip() for c in df.columns]

        # Serial del equipo desde el nombre del archivo
        m = re.search(r'DUSTMONITOR_(\d+)', os.path.basename(ruta), re.IGNORECASE)
        serial = m.group(1) if m else "?"
        nombre = f"DUSTMONITOR-{serial}"

        # Mapa case-insensitive exacto para evitar colisiones (T vs Time, p vs prec)
        cols_exact = {c.strip().lower(): c for c in df.columns}

        def _col_exacta(nombre_lower: str) -> Optional[str]:
            return cols_exact.get(nombre_lower)

        def _col_prefijo(prefijos: list[str]) -> Optional[str]:
            for p in prefijos:
                for k, v in cols_exact.items():
                    if k == p or k.startswith(p + ' ') or k.startswith(p + '.'):
                        return v
            return None

        c_pm1  = _col_exacta('pm1')  # exacto para no confundir con PM10 o alt. PM#1
        c_pm25 = _col_prefijo(['pm2.5', 'pm2,5'])
        c_pm4  = _col_exacta('pm4')
        c_pm10 = _col_exacta('pm10')
        c_temp = _col_exacta('t')
        c_hum  = _col_exacta('rh')
        c_pres = _col_exacta('p')
        # NOTA: en algunos DUSTMONITOR el campo 'wind speed' contiene valores
        # de 0–360 (azimut) en lugar de m/s — se verifica que los valores sean
        # plausibles (< 50 m/s); de lo contrario se descarta.
        _c_wvel_raw = _col_prefijo(['wind speed'])
        _wvel_sample = pd.to_numeric(df[_c_wvel_raw], errors='coerce').dropna() if _c_wvel_raw else pd.Series(dtype=float)
        c_wvel = _c_wvel_raw if (len(_wvel_sample) > 0 and _wvel_sample.median() < 50) else None
        c_wdir = _col_prefijo(['wind direction'])

        log.info("  Cols -> PM1:%s PM2.5:%s PM10:%s T:%s rH:%s",
                 c_pm1, c_pm25, c_pm10, c_temp, c_hum)

        def _ext_dm(col: Optional[str]) -> list[float]:
            if col is None:
                return []
            s = pd.to_numeric(df[col], errors='coerce')
            # Excluir ceros exactos (lecturas de inicio/calibración) y negativos
            s = s[(s > 0) & (s < 1e6)]
            return s.dropna().tolist()

        # Timestamps combinando date + time
        ts: list[str] = []
        if 'date' in cols_exact and 'time' in cols_exact:
            ts = (df[cols_exact['date']].astype(str) + ' ' +
                  df[cols_exact['time']].astype(str)).tolist()

        fuente = FuenteDatos(
            nombre=nombre,
            tipo="dustmonitor",
            archivo=os.path.basename(ruta),
            pm1 =_ext_dm(c_pm1),
            pm25=_ext_dm(c_pm25),
            pm4 =_ext_dm(c_pm4),
            pm10=_ext_dm(c_pm10),
            temp=_ext_dm(c_temp),
            hum =_ext_dm(c_hum),
            pres=_ext_dm(c_pres),
            viento_vel=_ext_dm(c_wvel),
            viento_dir=_ext_dm(c_wdir),
            timestamps=ts,
        )
        fuente.n_registros = max(len(fuente.pm25), len(fuente.temp))

        log.info("  -> %d PM2.5, %d temp, %d pres, %d viento",
                 len(fuente.pm25), len(fuente.temp),
                 len(fuente.pres), len(fuente.viento_vel))
        return fuente if fuente.valido() else None

    except Exception:
        log.exception("Error leyendo DUSTMONITOR '%s'", ruta)
        return None


# ---------------------------------------------------------------------------
# Detector de tipo de archivo
# ---------------------------------------------------------------------------
def detectar_y_leer(ruta: str) -> list[FuenteDatos]:
    nombre = os.path.basename(ruta).lower()
    if nombre.endswith('.txt') and 'dustmonitor' in nombre:
        r = leer_dustmonitor(ruta)
        return [r] if r else []
    elif nombre.endswith('.csv'):
        r = leer_csv_estacion(ruta)
        return [r] if r else []
    log.warning("Tipo no reconocido: %s", nombre)
    return []


# ---------------------------------------------------------------------------
# Búsqueda automática de archivos
# ---------------------------------------------------------------------------
def buscar_archivos(base: Optional[str] = None) -> list[str]:
    """
    Busca archivos CSV y DUSTMONITOR TXT.
    Prioriza subdirectorios con fecha más reciente en datos/.
    """
    raiz = base or BASE_DIR
    datos_dir = os.path.join(raiz, "datos")
    archivos: list[str] = []

    # Lotes con fecha (nombre de carpeta con dígitos)
    if os.path.isdir(datos_dir):
        lotes = sorted(
            [d for d in glob.glob(os.path.join(datos_dir, "*")) if os.path.isdir(d)],
            reverse=True,
        )
        for lote in lotes:
            encontrados = (
                glob.glob(os.path.join(lote, "*.csv")) +
                glob.glob(os.path.join(lote, "DUSTMONITOR_*.txt"))
            )
            if encontrados:
                log.info("Lote: %s (%d archivos)", os.path.basename(lote), len(encontrados))
                archivos = encontrados
                break

        # Raíz de datos/
        if not archivos:
            archivos = (
                glob.glob(os.path.join(datos_dir, "*.csv")) +
                glob.glob(os.path.join(datos_dir, "DUSTMONITOR_*.txt"))
            )

    # Raíz del proyecto
    if not archivos:
        archivos = (
            glob.glob(os.path.join(raiz, "*.csv")) +
            glob.glob(os.path.join(raiz, "DUSTMONITOR_*.txt"))
        )

    return archivos


# ---------------------------------------------------------------------------
# Estadísticas robustas (descarta outliers con IQR)
# ---------------------------------------------------------------------------
def _stats_robustas(valores: list[float]) -> dict:
    """Percentiles, media recortada al 5 %, IQR, sin outliers extremos."""
    if not valores:
        return {"mean": 0.0, "median": 0.0, "max": 0.0, "p95": 0.0, "n": 0}
    arr = np.array(valores, dtype=float)
    q1, q3 = np.percentile(arr, [25, 75])
    iqr = q3 - q1
    # Filtro IQR conservador (factor 3 para no perder picos reales de polución)
    mask = (arr >= q1 - 3 * iqr) & (arr <= q3 + 3 * iqr)
    arr_limpio = arr[mask]
    if len(arr_limpio) == 0:
        arr_limpio = arr
    return {
        "mean":   float(np.mean(arr_limpio)),
        "median": float(np.median(arr_limpio)),
        "max":    float(np.max(arr)),       # máximo absoluto (sin filtro)
        "p95":    float(np.percentile(arr_limpio, 95)),
        "std":    float(np.std(arr_limpio)),
        "n":      int(len(arr_limpio)),
        "n_total": int(len(arr)),
    }


# ---------------------------------------------------------------------------
# Serie temporal para predicción
# ---------------------------------------------------------------------------
def _serie_prediccion(valores: list[float], n_pred: int = 6) -> list[float]:
    """
    Genera una proyección robusta de n_pred pasos para PM2.5 (µg/m³).

    Estrategia:
      1. Ancla (anchor): mediana del período completo — evita que el final del
         archivo (que puede estar en un valle nocturno) distorsione la base.
      2. Tendencia reciente: pendiente lineal sobre las últimas 2 h (120 min)
         para capturar el comportamiento actual sin sobreajustar.
      3. Mean-reversion: la pendiente se amortigua exponencialmente hacia cero
         conforme se aleja en el tiempo (los modelos de aire tienen reversión
         a la media en pocas horas).
      4. Floor físico: nunca por debajo de 0.5 µg/m³ (límite detección sensor).

    Para archivos con datos minuto a minuto (DUSTMONITOR ~12 000 filas),
    el anchor es la mediana global; para perfiles horarios (24 filas), es la
    mediana de las últimas 6 horas disponibles.
    """
    if len(valores) < 3:
        base = valores[-1] if valores else 10.0
        return [round(base, 2)] * n_pred

    arr = np.array(valores, dtype=float)

    # 1. Anchor: mediana global (robusta a outliers y sesgos de hora del día)
    anchor = float(np.median(arr))

    # 2. Ventana reciente adaptativa
    #    - Series largas (minuto a minuto): 120 puntos ≈ 2 h
    #    - Series cortas (horaria): últimos 6 puntos ≈ 6 h
    n_ventana = min(120, max(6, len(arr) // 10))
    ventana = arr[-n_ventana:]

    # 3. EMA sobre la ventana reciente (alpha bajo = más suavizado)
    alpha = 0.2
    ema = float(ventana[0])
    for v in ventana:
        ema = alpha * float(v) + (1 - alpha) * ema

    # 4. Tendencia lineal sobre los últimos min(12, n_ventana) puntos
    ult = ventana[-min(12, len(ventana)):]
    x = np.arange(len(ult), dtype=float)
    try:
        slope, _ = np.polyfit(x, ult, 1)
    except Exception:
        slope = 0.0

    # 5. Clamping de pendiente proporcional al nivel actual
    #    (pico: ±20 % del anchor por hora, mínimo ±0.5)
    max_slope = max(0.5, anchor * 0.20)
    slope = float(np.clip(slope, -max_slope, max_slope))

    # 6. Proyección con mean-reversion: pendiente se amortigua un 30 % por paso
    decay = 0.70
    predicciones = []
    nivel = ema
    s = slope
    for i in range(n_pred):
        nivel = nivel + s
        nivel = max(0.5, nivel)           # floor físico
        # Atracción suave hacia el anchor (5 % por paso)
        nivel = nivel + 0.05 * (anchor - nivel)
        s = s * decay                     # amortiguación de tendencia
        predicciones.append(round(nivel, 2))

    return predicciones


# ---------------------------------------------------------------------------
# Recomendaciones
# ---------------------------------------------------------------------------
def generar_recomendaciones(
    pm25: float,
    pm10: float,
    temp: float,
    hum: float,
    pm25_p95: float = 0.0,
    viento_vel: float = 0.0,
) -> list[dict]:
    recs: list[dict] = []

    # — PM2.5 —
    label, tipo, icon = clasificar_pm25(pm25)
    if pm25 > 55:
        recs.append({
            "type": "danger", "icon": "fa-skull-crossbones",
            "title": f"Calidad del aire: {label}",
            "text": (f"PM2.5 promedio {pm25:.1f} µg/m³ (pico P95 {pm25_p95:.1f}). "
                     "NIVEL PELIGROSO. Evite toda actividad exterior. Use mascarilla N95/FFP2."),
        })
    elif pm25 > 37.5:
        recs.append({
            "type": "warning", "icon": "fa-mask",
            "title": f"Calidad del aire: {label}",
            "text": (f"PM2.5 {pm25:.1f} µg/m³. Grupos sensibles (niños, adultos mayores, "
                     "enfermedades respiratorias) deben evitar exposición prolongada."),
        })
    elif pm25 > 12:
        recs.append({
            "type": "info", "icon": "fa-check-circle",
            "title": f"Calidad del aire: {label}",
            "text": (f"PM2.5 {pm25:.1f} µg/m³. Aceptable, aunque puede haber leve "
                     "preocupación para grupos muy sensibles."),
        })
    else:
        recs.append({
            "type": "success", "icon": "fa-leaf",
            "title": "Aire limpio",
            "text": f"PM2.5 {pm25:.1f} µg/m³. Calidad excelente según ICA Colombia.",
        })

    # — PM10 —
    if pm10 > 0:
        if pm10 > 150:
            recs.append({
                "type": "danger", "icon": "fa-wind",
                "title": "PM10 crítico",
                "text": f"PM10 {pm10:.1f} µg/m³. Partículas gruesas en nivel peligroso.",
            })
        elif pm10 > 54:
            recs.append({
                "type": "warning", "icon": "fa-wind",
                "title": "PM10 elevado",
                "text": f"PM10 {pm10:.1f} µg/m³. Nivel moderado-alto de polvo grueso.",
            })

    # — Temperatura —
    if temp > 35:
        recs.append({
            "type": "danger", "icon": "fa-thermometer-full",
            "title": "Estrés térmico",
            "text": f"Temperatura {temp:.1f} °C. Riesgo de golpe de calor. Hidratación obligatoria.",
        })
    elif temp > 30:
        recs.append({
            "type": "warning", "icon": "fa-thermometer-half",
            "title": "Calor elevado",
            "text": f"Temperatura {temp:.1f} °C. Limite actividad física intensa al aire libre.",
        })

    # — Humedad —
    if hum > 85:
        recs.append({
            "type": "info", "icon": "fa-tint",
            "title": "Alta humedad",
            "text": f"Humedad {hum:.1f} %. Condiciones propicias para contaminantes biológicos.",
        })
    elif hum < 30:
        recs.append({
            "type": "info", "icon": "fa-tint-slash",
            "title": "Baja humedad",
            "text": f"Humedad {hum:.1f} %. Ambiente seco; riesgo de irritación respiratoria.",
        })

    # — Viento —
    if viento_vel > 0:
        if viento_vel > 10:
            recs.append({
                "type": "info", "icon": "fa-wind",
                "title": "Viento fuerte",
                "text": f"Velocidad de viento {viento_vel:.1f} m/s. Puede resuspender partículas del suelo.",
            })
        elif viento_vel < 1.0:
            recs.append({
                "type": "warning", "icon": "fa-smog",
                "title": "Ventilación escasa",
                "text": f"Viento {viento_vel:.1f} m/s. Sin dispersión; contaminantes pueden acumularse.",
            })

    # — Combinación crítica —
    if pm25 > 25 and temp > 32:
        recs.append({
            "type": "danger", "icon": "fa-radiation",
            "title": "Condición combinada crítica",
            "text": ("Calor intenso + partículas elevadas. "
                     "Especialmente peligroso para asma, enfermedades cardiovasculares y embarazadas."),
        })

    return recs


# ---------------------------------------------------------------------------
# FUNCIÓN PRINCIPAL: analizar_archivo
# ---------------------------------------------------------------------------
def analizar_archivo(ruta_archivo: str) -> dict:
    """
    Punto de entrada principal.

    Acepta:
      - Ruta a CSV de estación (perfil horario / por hora)
      - Ruta a DUSTMONITOR TXT
      - Cadena vacía "" → búsqueda automática en el directorio de trabajo

    Retorna un dict con:
      success, labels, data, mainRisk, futureTrend, analysis_note,
      recommendations, stats
    """
    fuentes: list[FuenteDatos] = []

    # 1 — Archivo explícito
    if ruta_archivo and os.path.exists(ruta_archivo):
        fuentes.extend(detectar_y_leer(ruta_archivo))

        # Intentar leer otros archivos del mismo directorio (mismo lote)
        dir_lote = os.path.dirname(os.path.abspath(ruta_archivo))
        for f in (
            glob.glob(os.path.join(dir_lote, "*.csv")) +
            glob.glob(os.path.join(dir_lote, "DUSTMONITOR_*.txt"))
        ):
            if os.path.abspath(f) != os.path.abspath(ruta_archivo):
                fuentes.extend(detectar_y_leer(f))

    # 2 — Búsqueda automática
    if not fuentes:
        log.info("Búsqueda automática de archivos...")
        for f in buscar_archivos():
            fuentes.extend(detectar_y_leer(f))

    if not fuentes:
        return {
            "success": False,
            "error": "No se encontraron archivos de datos válidos (CSV de estación o DUSTMONITOR TXT).",
        }

    # 3 — Consolidar
    all_pm25, all_pm10, all_pm4, all_pm1 = [], [], [], []
    all_temp, all_hum, all_pres = [], [], []
    all_wvel: list[float] = []
    nombres: list[str] = []

    for fd in fuentes:
        if not fd:
            continue
        all_pm25.extend(fd.pm25)
        all_pm10.extend(fd.pm10)
        all_pm4.extend(fd.pm4)
        all_pm1.extend(fd.pm1)
        all_temp.extend(fd.temp)
        all_hum.extend(fd.hum)
        all_pres.extend(fd.pres)
        all_wvel.extend(fd.viento_vel)
        nombres.append(fd.nombre)

    nombres = list(dict.fromkeys(nombres))   # deduplicar manteniendo orden

    if not all_pm25 and not all_temp:
        return {
            "success": False,
            "error": (
                f"{len(fuentes)} archivo(s) encontrado(s) pero sin columnas "
                "PM2.5/Temperatura reconocibles. Revise el formato."
            ),
        }

    # 4 — Estadísticas robustas
    st_pm25 = _stats_robustas(all_pm25)
    st_pm10 = _stats_robustas(all_pm10)
    st_pm4  = _stats_robustas(all_pm4)
    st_pm1  = _stats_robustas(all_pm1)
    st_temp = _stats_robustas(all_temp)
    st_hum  = _stats_robustas(all_hum)
    st_pres = _stats_robustas(all_pres)
    st_wvel = _stats_robustas(all_wvel)

    avg_pm25 = st_pm25["mean"]
    avg_pm10 = st_pm10["mean"]
    avg_temp = st_temp["mean"] if all_temp else 25.0
    avg_hum  = st_hum["mean"]  if all_hum  else 60.0
    avg_wvel = st_wvel["mean"] if all_wvel else 0.0

    # 5 — Serie para predicción (PM2.5 preferido; fallback: temp)
    serie_base = all_pm25 if len(all_pm25) >= 6 else all_temp
    predicciones = _serie_prediccion(serie_base, n_pred=6)

    # 6 — Nivel de riesgo
    p95_pm25 = st_pm25.get("p95", avg_pm25)
    if avg_pm25 > 55 or st_temp.get("max", 0) > 40:
        riesgo = "MUY ALTO"
    elif avg_pm25 > 37.5 or st_temp.get("max", 0) > 35:
        riesgo = "ALTO"
    elif avg_pm25 > 12 or avg_temp > 30:
        riesgo = "MODERADO"
    else:
        riesgo = "BAJO"

    # 7 — Recomendaciones
    recs = generar_recomendaciones(
        pm25=avg_pm25,
        pm10=avg_pm10,
        temp=avg_temp,
        hum=avg_hum,
        pm25_p95=p95_pm25,
        viento_vel=avg_wvel,
    )

    # 8 — Nota de análisis
    fuentes_str = ", ".join(nombres[:3])
    nota = (
        f"{len(fuentes)} fuente(s): {fuentes_str} | "
        f"PM2.5: {avg_pm25:.1f} µg/m³ (P95={p95_pm25:.1f}, máx={st_pm25['max']:.1f}) | "
        f"PM10: {avg_pm10:.1f} | "
        f"Temp: {avg_temp:.1f} °C | "
        f"Hum: {avg_hum:.1f} % | "
        f"Registros PM2.5: {st_pm25['n']}"
    )

    usar_pm25 = len(all_pm25) >= 6
    serie_base2 = all_pm25 if usar_pm25 else all_temp
    anchor_val = round(float(np.median(np.array(serie_base2, dtype=float))), 1)
    n_ventana_used = min(120, max(6, len(serie_base2) // 10))
    n_base = st_pm25["n"] if usar_pm25 else st_temp["n"]

    return {
        "success":       True,
        "labels":        ["Ahora", "+1h", "+2h", "+3h", "+4h", "+5h"],
        "data":          predicciones,
        "data_unit":     "µg/m³",
        "data_label":    "PM2.5 µg/m³",
        "valor_actual":  predicciones[0] if predicciones else round(avg_pm25, 2),
        "mainRisk":      riesgo,
        "futureTrend":   (
            f"Proyección anclada en mediana {anchor_val} µg/m³ con tendencia "
            f"de las últimas {n_ventana_used} muestras recientes. "
            f"Basada en {n_base} registros de PM2.5."
        ),
        "analysis_note": nota,
        "recommendations": recs,
        "stats": {
            "pm25":      round(avg_pm25, 2),
            "pm25_max":  round(st_pm25["max"], 2),
            "pm25_p95":  round(p95_pm25, 2),
            "pm25_std":  round(st_pm25.get("std", 0), 2),
            "pm10":      round(avg_pm10, 2),
            "pm4":       round(st_pm4["mean"], 2),
            "pm1":       round(st_pm1["mean"], 2),
            "temp":      round(avg_temp, 2),
            "temp_max":  round(st_temp.get("max", avg_temp), 2),
            "hum":       round(avg_hum, 2),
            "pres":      round(st_pres["mean"], 2) if all_pres else None,
            "viento_vel": round(avg_wvel, 2) if all_wvel else None,
            "n_registros": st_pm25["n"],
            "n_total":     st_pm25["n_total"],
            "n_fuentes":   len(fuentes),
            "estaciones":  nombres,
        },
    }


# ---------------------------------------------------------------------------
# obtener_prediccion_actual  (llamada rápida desde dashboard)
# ---------------------------------------------------------------------------
def obtener_prediccion_actual() -> list[float]:
    """Devuelve la proyección de PM2.5 más reciente para el gráfico principal."""
    for f in buscar_archivos():
        for fuente in detectar_y_leer(f):
            if fuente and fuente.pm25:
                return _serie_prediccion(fuente.pm25, n_pred=6)
    return [10.0, 10.5, 11.0, 10.8, 10.2, 9.9]


# ---------------------------------------------------------------------------
# CLI / prueba rápida
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    print("=" * 70)
    print("TEST DIRECTO — modelo.py v2.0")
    print("=" * 70)

    archivos = buscar_archivos()
    print(f"Archivos encontrados: {len(archivos)}")
    for a in archivos:
        print(f"  → {os.path.basename(a)}")

    print("\n--- analizar_archivo('') ---")
    res = analizar_archivo("")
    if res["success"]:
        print(f"✅ Riesgo:  {res['mainRisk']}")
        print(f"   Nota:    {res['analysis_note']}")
        print(f"   Stats:   {json.dumps(res['stats'], indent=4, ensure_ascii=False)}")
        print(f"   Recs:    {len(res['recommendations'])} recomendaciones")
        print(f"   Pred:    {res['data']}")
    else:
        print(f"❌ {res['error']}")