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

if (!defined('APP_OSRM_BASE_URL')) {
    $osrmEnv = getenv('ECOBOTS_OSRM_URL');
    $osrmValue = $osrmEnv !== false ? trim($osrmEnv) : '';
    if ($osrmValue === '') {
        $osrmValue = 'https://router.project-osrm.org';
    }
    define('APP_OSRM_BASE_URL', rtrim($osrmValue, '/'));
}

if (!defined('APP_OSRM_PROFILE')) {
    $profileEnv = getenv('ECOBOTS_OSRM_PROFILE');
    $profile = $profileEnv !== false ? trim($profileEnv) : '';
    if ($profile === '') {
        $profile = 'foot';
    }
    define('APP_OSRM_PROFILE', $profile);
}

if (!function_exists('ecobots_build_asset_url')) {
    function ecobots_build_asset_url($base, $path, $fallback)
    {
        if (empty($path)) {
            return $fallback;
        }
        if (preg_match('/^https?:\/\//i', $path)) {
            return $path;
        }
        $cleanBase = rtrim($base ?? '', '/');
        $cleanPath = ltrim($path, '/');
        if ($cleanBase !== '') {
            return $cleanBase . '/' . $cleanPath;
        }
        if (strpos($cleanPath, '/') === 0) {
            return $cleanPath;
        }
        return '/' . $cleanPath;
    }
}

if (!defined('APP_MISSION_ICON_BASE')) {
    define('APP_MISSION_ICON_BASE', getenv('ECOBOTS_MISSION_ICON_BASE') ?: null);
}

if (!defined('APP_MISSION_IMAGE_BASE')) {
    define('APP_MISSION_IMAGE_BASE', getenv('ECOBOTS_MISSION_IMAGE_BASE') ?: null);
}

if (!function_exists('ecobots_svg_to_data_uri')) {
    function ecobots_svg_to_data_uri($svg)
    {
        return 'data:image/svg+xml;utf8,' . rawurlencode($svg);
    }
}

if (!function_exists('ecobots_svg_badge')) {
    function ecobots_svg_badge($label, $background, $foreground)
    {
        $safeLabel = htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeBackground = htmlspecialchars($background, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeForeground = htmlspecialchars($foreground, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            . '<rect x="0" y="0" width="64" height="64" rx="8" ry="8" fill="' . $safeBackground . '"/>'
            . '<text x="32" y="38" font-family="Arial,Helvetica,sans-serif" font-size="28" fill="' . $safeForeground . '"'
            . ' text-anchor="middle" font-weight="bold">' . $safeLabel . '</text>'
            . '</svg>';
    }
}

if (!defined('APP_MISSION_ICON_SVGS')) {
    define('APP_MISSION_ICON_SVGS', [
        'DEFAULT' => ecobots_svg_badge('M', '#0a9396', '#ffffff'),
        'BATALHA' => ecobots_svg_badge('B', '#9b2226', '#ffffff'),
        'BATALHA_GRUPO' => ecobots_svg_badge('BG', '#bb3e03', '#ffffff'),
        'FOTO' => ecobots_svg_badge('F', '#005f73', '#ffffff'),
        'SCAN' => ecobots_svg_badge('QR', '#5a189a', '#ffffff'),
        'CORRIDA' => ecobots_svg_badge('C', '#ca6702', '#ffffff'),
        'P2P' => ecobots_svg_badge('P', '#0b7285', '#ffffff'),
        'P2P_GRUPO' => ecobots_svg_badge('PG', '#1d3557', '#ffffff'),
    ]);
}

if (!defined('APP_MISSION_TYPE_ICONS')) {
    $iconMap = [];
    foreach (APP_MISSION_ICON_SVGS as $type => $svg) {
        $iconMap[strtoupper($type)] = ecobots_svg_to_data_uri($svg);
    }
    define('APP_MISSION_TYPE_ICONS', $iconMap);
}

if (!defined('APP_DEFAULT_MISSION_ICON')) {
    define('APP_DEFAULT_MISSION_ICON', APP_MISSION_TYPE_ICONS['DEFAULT']);
}

if (!function_exists('ecobots_resolve_mission_icon')) {
    function ecobots_resolve_mission_icon($type, $relativePath = null)
    {
        $typeKey = strtoupper($type ?? '');
        if (!empty($relativePath)) {
            if (preg_match('/^https?:\/\//i', $relativePath) || str_starts_with($relativePath, 'data:')) {
                return $relativePath;
            }
            if (APP_MISSION_ICON_BASE) {
                return rtrim(APP_MISSION_ICON_BASE, '/') . '/' . ltrim($relativePath, '/');
            }
        }

        return APP_MISSION_TYPE_ICONS[$typeKey] ?? APP_DEFAULT_MISSION_ICON;
    }
}

if (!function_exists('ecobots_resolve_mission_image')) {
    function ecobots_resolve_mission_image(?string $relativePath)
    {
        if (empty($relativePath)) {
            return null;
        }
        if (preg_match('/^https?:\/\//i', $relativePath) || str_starts_with($relativePath, 'data:')) {
            return $relativePath;
        }
        if (APP_MISSION_IMAGE_BASE) {
            return rtrim(APP_MISSION_IMAGE_BASE, '/') . '/' . ltrim($relativePath, '/');
        }
        return APP_BASE_HTML . '/' . ltrim($relativePath, '/');
    }
}

if (!defined('APP_ITEM_IMAGE_BASE')) {
    define('APP_ITEM_IMAGE_BASE', getenv('ECOBOTS_ITEM_IMAGE_BASE') ?: null);
}

if (!defined('APP_ITEM_ICON_SVGS')) {
    define('APP_ITEM_ICON_SVGS', [
        'DEFAULT' => ecobots_svg_badge('IT', '#2b9348', '#ffffff'),
        'CRC_ONCA' => ecobots_svg_badge('CR', '#386641', '#ffffff'),
        'WPN_GARRA' => ecobots_svg_badge('WG', '#bb9457', '#ffffff'),
        'WPN_LASER' => ecobots_svg_badge('WL', '#ee9b00', '#000000'),
        'MOD_REPAIR' => ecobots_svg_badge('MR', '#0a9396', '#ffffff'),
        'MOD_NANO' => ecobots_svg_badge('MN', '#577590', '#ffffff'),
    ]);
}

if (!defined('APP_ITEM_KIND_ICON_SVGS')) {
    define('APP_ITEM_KIND_ICON_SVGS', [
        'CARCASS' => ecobots_svg_badge('CA', '#6a994e', '#ffffff'),
        'WEAPON' => ecobots_svg_badge('WP', '#e36414', '#ffffff'),
        'MODULE' => ecobots_svg_badge('MO', '#3a0ca3', '#ffffff'),
    ]);
}

if (!defined('APP_ITEM_ICON_DATA')) {
    $codeIcons = [];
    foreach (APP_ITEM_ICON_SVGS as $code => $svg) {
        $codeIcons[strtoupper($code)] = ecobots_svg_to_data_uri($svg);
    }
    define('APP_ITEM_ICON_DATA', $codeIcons);
}

if (!defined('APP_ITEM_KIND_ICON_DATA')) {
    $kindIcons = [];
    foreach (APP_ITEM_KIND_ICON_SVGS as $kind => $svg) {
        $kindIcons[strtoupper($kind)] = ecobots_svg_to_data_uri($svg);
    }
    define('APP_ITEM_KIND_ICON_DATA', $kindIcons);
}

if (!defined('APP_DEFAULT_ITEM_IMAGE')) {
    define('APP_DEFAULT_ITEM_IMAGE', APP_ITEM_ICON_DATA['DEFAULT']);
}

if (!function_exists('ecobots_resolve_item_icon')) {
    function ecobots_resolve_item_icon($code, $kind, $relativePath = null)
    {
        $codeKey = strtoupper($code ?? '');
        if ($codeKey !== '' && isset(APP_ITEM_ICON_DATA[$codeKey])) {
            return APP_ITEM_ICON_DATA[$codeKey];
        }

        $kindKey = strtoupper($kind ?? '');
        if ($kindKey !== '' && isset(APP_ITEM_KIND_ICON_DATA[$kindKey])) {
            return APP_ITEM_KIND_ICON_DATA[$kindKey];
        }

        if (!empty($relativePath)) {
            if (preg_match('/^https?:\/\//i', $relativePath) || str_starts_with($relativePath, 'data:')) {
                return $relativePath;
            }
            if (APP_ITEM_IMAGE_BASE) {
                return rtrim(APP_ITEM_IMAGE_BASE, '/') . '/' . ltrim($relativePath, '/');
            }
        }

        return APP_DEFAULT_ITEM_IMAGE;
    }
}

if (!defined('APP_ECOBOT_BASELINE_STATS')) {
    define('APP_ECOBOT_BASELINE_STATS', [
        'hp' => 100,
        'atk' => 10,
        'def' => 10,
        'speed' => 10,
        'focus' => 10,
        'energy' => 10,
    ]);
}

if (!defined('APP_ECOBOT_BASIC_ATTACK')) {
    define('APP_ECOBOT_BASIC_ATTACK', [
        'name' => 'Ataque básico',
        'description' => 'Golpe padrão do Ecobot sem armas equipadas.',
        'dmg_min' => 6,
        'dmg_max' => 10,
        'dmg_type' => 'KINETIC',
        'energy_cost' => 0,
        'accuracy' => 90,
        'crit_bonus' => 0,
        'status_code' => null,
        'status_chance' => 0,
    ]);
}

if (!defined('APP_BASE_DROP_CHANCE')) {
    define('APP_BASE_DROP_CHANCE', 0.2);
}

if (!defined('APP_DROP_RARITY_WEIGHTS')) {
    define('APP_DROP_RARITY_WEIGHTS', [
        'C' => 60,
        'B' => 30,
        'A' => 8,
        'S' => 2,
    ]);
}

if (!defined('APP_RARITY_SCALING')) {
    define('APP_RARITY_SCALING', [
        'C' => 1.0,
        'B' => 1.15,
        'A' => 1.35,
        'S' => 1.6,
    ]);
}

if (!defined('APP_MODULE_BONUS_DEFINITIONS')) {
    define('APP_MODULE_BONUS_DEFINITIONS', [
        'DROP_CHANCE' => [
            'type' => 'drop',
            'unit' => 'percent',
            'label' => 'Bônus de drop',
        ],
        'XP_BONUS' => [
            'type' => 'xp',
            'unit' => 'percent',
            'label' => 'Bônus de XP',
        ],
    ]);
}

if (!defined('APP_BATTLE_MODULE_ENERGY_COSTS')) {
    define('APP_BATTLE_MODULE_ENERGY_COSTS', [
        'HEAL' => 6,
        'SHIELD' => 5,
        'BUFF_ATK' => 5,
        'BUFF_DEF' => 5,
        'ENERGIZE' => 4,
        'CLEANSE' => 3,
        'DROP_CHANCE' => 4,
        'XP_BONUS' => 4,
    ]);
}

if (!defined('APP_ENEMY_LEVEL_RANGE')) {
    define('APP_ENEMY_LEVEL_RANGE', 1);
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
        'mission_type_icons' => APP_MISSION_TYPE_ICONS,
        'default_mission_icon' => APP_DEFAULT_MISSION_ICON,
        'mission_icon_svgs' => APP_MISSION_ICON_SVGS,
        'item_image_base' => APP_ITEM_IMAGE_BASE,
        'default_item_image' => APP_DEFAULT_ITEM_IMAGE,
        'item_icon_map' => APP_ITEM_ICON_DATA,
        'item_kind_icon_map' => APP_ITEM_KIND_ICON_DATA,
        'ecobot_baseline_stats' => APP_ECOBOT_BASELINE_STATS,
        'ecobot_basic_attack' => APP_ECOBOT_BASIC_ATTACK,
        'osrm_url' => APP_OSRM_BASE_URL,
        'osrm_profile' => APP_OSRM_PROFILE,
        'base_drop_chance' => APP_BASE_DROP_CHANCE,
        'drop_rarity_weights' => APP_DROP_RARITY_WEIGHTS,
        'module_bonus_definitions' => APP_MODULE_BONUS_DEFINITIONS,
        'enemy_level_range' => APP_ENEMY_LEVEL_RANGE,
        'rarity_scaling' => APP_RARITY_SCALING,
        'module_energy_costs' => APP_BATTLE_MODULE_ENERGY_COSTS,
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
