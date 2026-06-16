<?php
/**
 * api.php — Puente PHP para Laragon/Apache
 * Redirige las peticiones al bridge de Python (api_bridge.py)
 * Esto evita problemas de CORS y permite que todo funcione bajo el mismo puerto (80).
 * 
 * Las rutas manual_data, pm25_history y manual_weather se manejan directamente
 * en PHP para no depender del motor Python.
 */

// Evitar caché
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$route = $_GET['route'] ?? '';

// ── Rutas manejadas directamente por PHP (sin depender de Python) ──────────

$ADMIN_DIR = __DIR__ . '/admin';

// --- manual_data ---
if ($route === 'manual_data') {
    $file = $ADMIN_DIR . '/manual_data.json';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        file_put_contents($file, $json);
        echo json_encode(["success" => true, "message" => "Datos manuales guardados"]);
    } else {
        if (file_exists($file)) {
            echo file_get_contents($file);
        } else {
            echo '{}';
        }
    }
    exit;
}

// --- pm25_history ---
if ($route === 'pm25_history') {
    $file = $ADMIN_DIR . '/pm25_history.json';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Leer historial existente
        $history = [];
        if (file_exists($file)) {
            $content = file_get_contents($file);
            $history = json_decode($content, true);
            if (!is_array($history)) $history = [];
        }

        // Leer nuevo registro
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input && isset($input['value'])) {
            // Limitar a los últimos 200 registros
            if (count($history) > 200) {
                $history = array_slice($history, -200);
            }

            $history[] = [
                "timestamp" => $input['timestamp'] ?? date('H:i'),
                "value" => round(floatval($input['value']), 2),
                "station" => $input['station'] ?? 'General'
            ];

            file_put_contents($file, json_encode($history, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(["success" => true, "message" => "Registro PM2.5 guardado", "total" => count($history)]);
        } else {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Se requiere 'value' en el body"]);
        }
    } else {
        if (file_exists($file)) {
            echo file_get_contents($file);
        } else {
            echo '[]';
        }
    }
    exit;
}

// --- manual_weather ---
if ($route === 'manual_weather') {
    $file = $ADMIN_DIR . '/manual_weather.json';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        file_put_contents($file, $json);
        echo json_encode(["success" => true, "message" => "Datos ambientales guardados"]);
    } else {
        if (file_exists($file)) {
            echo file_get_contents($file);
        } else {
            echo 'null';
        }
    }
    exit;
}

// --- credentials ---
if ($route === 'credentials') {
    $file = $ADMIN_DIR . '/credentials.json';
    if (file_exists($file)) {
        echo file_get_contents($file);
    } else {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Archivo no encontrado"]);
    }
    exit;
}

// ── Rutas que requieren el bridge de Python ────────────────────────────────

$python_api_base = "http://localhost:8000";

$endpoints = [
    'health'  => '/health',
    'predict' => '/api/predict',
    'upload'  => '/api/predict/upload',
];

if (!isset($endpoints[$route])) {
    http_response_code(404);
    echo json_encode(["success" => false, "error" => "Ruta no encontrada: $route"]);
    exit;
}

$target_url = $python_api_base . $endpoints[$route];

// Configurar cURL para reenviar la petición
$ch = curl_init($target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    
    // Si es una subida de archivo (multipart)
    if (!empty($_FILES)) {
        $file = $_FILES['file'];
        $cfile = new CURLFile($file['tmp_name'], $file['type'], $file['name']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
    } else {
        // Si es JSON
        $json_data = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json_data);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(503);
    echo json_encode([
        "success" => false, 
        "error" => "El motor de IA (api_bridge.py) no está activo en el puerto 8000.",
        "details" => curl_error($ch)
    ]);
} else {
    http_response_code($http_code);
    echo $response;
}

curl_close($ch);

