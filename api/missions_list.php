<?php // File: api/missions_list.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/geo.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/rules.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$lat = $_GET['lat'] ?? null;
$lng = $_GET['lng'] ?? null;
$km = (int)($_GET['km'] ?? $auth['mission_radius_km']);
$allowed = [3, 10, 50];
if (!in_array($km, $allowed, true)) {
    $km = $auth['mission_radius_km'];
    if (!in_array($km, $allowed, true)) {
        $km = APP_DEFAULT_GEOFENCE_KM;
    }
}

if (!validate_coordinates($lat, $lng)) {
    error_response('Coordenadas inválidas');
}

$pdo = get_pdo();
$missionStmt = $pdo->prepare(
    'SELECT m.id, m.code, m.tipo, m.modo, m.name, m.description, m.lat, m.lng, m.raio_m,
            m.reward_xp, m.nivel_min, m.janela_start, m.janela_end, m.req_carcacas,
            m.recovery_min,
            (6371000 * acos(cos(radians(:lat)) * cos(radians(m.lat)) * cos(radians(m.lng) - radians(:lng))
             + sin(radians(:lat)) * sin(radians(m.lat)))) AS distance_m
     FROM missions m
     WHERE m.active = 1 AND m.status = "PUBLISHED"'
);
$missionStmt->execute([
    'lat' => (float)$lat,
    'lng' => (float)$lng,
]);
$missions = $missionStmt->fetchAll();

$carcassStmt = $pdo->prepare(
    'SELECT it.code
     FROM equipped_items ei
     INNER JOIN inventory inv ON inv.id = ei.inventory_id AND inv.user_id = :user_id
     INNER JOIN item_templates it ON it.id = inv.template_id
     WHERE ei.user_id = :user_id AND ei.slot = "carcass"
     LIMIT 1'
);
$carcassStmt->execute(['user_id' => $auth['user_id']]);
$carcassRow = $carcassStmt->fetch();
$equippedCarcass = $carcassRow['code'] ?? null;

$result = [];
foreach ($missions as $mission) {
    if ($mission['distance_m'] === null) {
        continue;
    }
    if ((float)$mission['distance_m'] > $km * 1000) {
        continue;
    }
    if (!empty($mission['nivel_min']) && (int)$mission['nivel_min'] > (int)$auth['level']) {
        continue;
    }
    if (!mission_within_window($mission)) {
        continue;
    }
    if (!mission_requires_carcass($mission, $equippedCarcass)) {
        continue;
    }

    $result[] = [
        'id' => (int)$mission['id'],
        'code' => $mission['code'],
        'tipo' => $mission['tipo'],
        'modo' => $mission['modo'],
        'name' => $mission['name'],
        'description' => $mission['description'],
        'lat' => (float)$mission['lat'],
        'lng' => (float)$mission['lng'],
        'raio_m' => (int)$mission['raio_m'],
        'reward_xp' => (int)$mission['reward_xp'],
        'nivel_min' => $mission['nivel_min'] !== null ? (int)$mission['nivel_min'] : null,
        'distance_m' => (float)$mission['distance_m'],
        'recovery_min' => (int)$mission['recovery_min'],
        'janela_start' => $mission['janela_start'],
        'janela_end' => $mission['janela_end'],
    ];
}

usort($result, static function ($a, $b) {
    return $a['distance_m'] <=> $b['distance_m'];
});

json_response(['missions' => $result]);

?>
