<?php // File: api/init_config.php
// Core configuration for Ecobots MVP
// These values are intended to be customised per deployment.

if (!defined('DB_HOST')) {
    define('DB_HOST', getenv('ECOBOTS_DB_HOST') ?: 'localhost');
}
if (!defined('DB_NAME')) {
    define('DB_NAME', getenv('ECOBOTS_DB_NAME') ?: 'ecobots');
}
if (!defined('DB_USER')) {
    define('DB_USER', getenv('ECOBOTS_DB_USER') ?: 'ecobots');
}
if (!defined('DB_PASS')) {
    define('DB_PASS', getenv('ECOBOTS_DB_PASS') ?: 'secret');
}

if (!defined('APP_TIMEZONE')) {
    define('APP_TIMEZONE', 'America/Sao_Paulo');
}

date_default_timezone_set(APP_TIMEZONE);

if (!defined('APP_ALLOWED_ORIGIN')) {
    define('APP_ALLOWED_ORIGIN', 'https://negocio.tec.br');
}

if (!defined('APP_BASE_HTML')) {
    $defaultHtml = getenv('ECOBOTS_BASE_HTML') ?: (isset($_SERVER['HTTP_HOST'])
        ? (($_SERVER['REQUEST_SCHEME'] ?? 'https') . '://' . $_SERVER['HTTP_HOST'] . '/public')
        : '/public');
    define('APP_BASE_HTML', rtrim($defaultHtml, '/'));
}

if (!defined('APP_BASE_API')) {
    $defaultApi = getenv('ECOBOTS_BASE_API') ?: (isset($_SERVER['HTTP_HOST'])
        ? (($_SERVER['REQUEST_SCHEME'] ?? 'https') . '://' . $_SERVER['HTTP_HOST'] . '/api')
        : '/api');
    define('APP_BASE_API', rtrim($defaultApi, '/'));
}

if (!defined('APP_DEFAULT_GEOFENCE_KM')) {
    define('APP_DEFAULT_GEOFENCE_KM', 3);
}

if (!defined('APP_MISSION_START_RADIUS_M')) {
    define('APP_MISSION_START_RADIUS_M', 60);
}

if (!defined('APP_UPLOAD_PATH')) {
    define('APP_UPLOAD_PATH', __DIR__ . '/uploads');
}

if (!defined('APP_UPLOAD_URL')) {
    define('APP_UPLOAD_URL', APP_BASE_API . '/uploads');
}

if (!defined('APP_HEADQUARTERS_URL')) {
    define('APP_HEADQUARTERS_URL', 'https://negocio.tec.br/eco/hq');
}

if (!defined('APP_PITY_THRESHOLD')) {
    define('APP_PITY_THRESHOLD', 10);
}

if (!defined('APP_PITY_INCREMENT')) {
    define('APP_PITY_INCREMENT', 0.1);
}

if (!defined('APP_ENCOUNTER_BASE_CHANCE')) {
    define('APP_ENCOUNTER_BASE_CHANCE', 0.08);
}

if (!defined('APP_ENCOUNTER_COOLDOWN_SECONDS')) {
    define('APP_ENCOUNTER_COOLDOWN_SECONDS', 120);
}

if (!defined('APP_ENCOUNTER_RADIUS_M')) {
    define('APP_ENCOUNTER_RADIUS_M', 60);
}

if (!defined('APP_RECOVERY_MAP')) {
    define('APP_RECOVERY_MAP', [
        'BATALHA' => 0,
        'BATTLE' => 0,
        'FOTO' => 10,
        'PHOTO' => 10,
        'SCAN' => 5,
        'CORRIDA' => 30,
        'P2P' => 20,
    ]);
}

if (!defined('APP_ECOBOT_DOWN_HOURS')) {
    define('APP_ECOBOT_DOWN_HOURS', 24);
}

if (php_sapi_name() !== 'cli' && basename($_SERVER['SCRIPT_NAME']) === 'init_config.php') {
    $configPayload = [
        'hq_url' => APP_HEADQUARTERS_URL,
        'default_geofence_km' => APP_DEFAULT_GEOFENCE_KM,
        'mission_start_radius_m' => APP_MISSION_START_RADIUS_M,
        'base_api' => APP_BASE_API,
        'base_html' => APP_BASE_HTML,
        'upload_url' => APP_UPLOAD_URL,
    ];

    $format = isset($_GET['format']) ? strtolower($_GET['format']) : 'json';

    if ($format === 'js') {
        header('Content-Type: application/javascript');
        header('Access-Control-Allow-Origin: ' . APP_ALLOWED_ORIGIN);
        echo 'window.APP_BASE_API = ' . json_encode($configPayload['base_api']) . "\n";
        echo 'window.APP_BASE_HTML = ' . json_encode($configPayload['base_html']) . "\n";
        echo 'window.APP_UPLOAD_URL = ' . json_encode($configPayload['upload_url']) . "\n";
        echo 'window.APP_CONFIG = ' . json_encode($configPayload) . ';';
        exit;
    }

    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: ' . APP_ALLOWED_ORIGIN);
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        exit;
    }
    echo json_encode($configPayload);
    exit;
}

?>
