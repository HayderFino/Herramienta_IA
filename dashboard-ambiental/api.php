<?php
/**
 * api.php — Puente PHP para Laragon/Apache
 * Redirige las peticiones al bridge de Python (api_bridge.py)
 * Esto evita problemas de CORS y permite que todo funcione bajo el mismo puerto (80).
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
$python_api_base = "http://localhost:8000";

// Mapeo de rutas amigables a endpoints de FastAPI
$endpoints = [
    'health'      => '/health',
    'predict'     => '/api/predict',
    'upload'      => '/api/predict/upload',
    'manual_data' => '/api/manual_data',
    'manual_weather' => '/api/manual_weather',
    'pm25_history' => '/api/pm25_history',
    'credentials' => 'admin/credentials.json' // Local file path
];

if (!isset($endpoints[$route])) {
    http_response_code(404);
    echo json_encode(["success" => false, "error" => "Ruta no encontrada: $route"]);
    exit;
}

if ($endpoints[$route][0] !== '/') {
    // Es un archivo local
    $file_path = __DIR__ . '/' . $endpoints[$route];
    if (file_exists($file_path)) {
        echo file_get_contents($file_path);
    } else {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Archivo no encontrado"]);
    }
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
