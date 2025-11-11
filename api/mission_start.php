<?php // File: api/mission_start.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/geo.php';
require_once __DIR__ . '/core/rules.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$missionId = (int)($data['mission_id'] ?? 0);
$lat = $data['lat'] ?? null;
$lng = $data['lng'] ?? null;

if ($missionId <= 0 || !validate_coordinates($lat, $lng)) {
    error_response('Dados inválidos');
}

$pdo = get_pdo();
$stmt = $pdo->prepare(
    'SELECT id, code, tipo, modo, name, lat, lng, raio_m, reward_xp, nivel_min, janela_start, janela_end, req_carcacas, recovery_min
     FROM missions
     WHERE id = :id AND active = 1 AND status = "PUBLISHED"'
);
$stmt->execute(['id' => $missionId]);
$mission = $stmt->fetch();
if (!$mission) {
    error_response('Missão não encontrada', 404);
}

if (!empty($mission['nivel_min']) && (int)$mission['nivel_min'] > (int)$auth['level']) {
    error_response('Nível insuficiente', 403);
}
if (!mission_within_window($mission)) {
    error_response('Missão indisponível no momento', 403);
}

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
if (!mission_requires_carcass($mission, $carcassRow['code'] ?? null)) {
    error_response('Carcaça requerida não equipada', 403);
}

$ecobotStmt = $pdo->prepare('SELECT down_until FROM ecobots WHERE user_id = :user_id LIMIT 1');
$ecobotStmt->execute(['user_id' => $auth['user_id']]);
$ecobot = $ecobotStmt->fetch();
ensure_ecobot_active($ecobot);

$distance = haversine_distance((float)$lat, (float)$lng, (float)$mission['lat'], (float)$mission['lng']);
if ($distance > APP_MISSION_START_RADIUS_M) {
    error_response('Muito longe do ponto da missão');
}

$insert = $pdo->prepare(
    'INSERT INTO mission_runs (mission_id, user_id, status, started_at, start_lat, start_lng, reward_xp)
     VALUES (:mission_id, :user_id, "STARTED", NOW(), :start_lat, :start_lng, :reward_xp)'
);
$insert->execute([
    'mission_id' => $missionId,
    'user_id' => $auth['user_id'],
    'start_lat' => $lat,
    'start_lng' => $lng,
    'reward_xp' => (int)$mission['reward_xp'],
]);

$runId = (int)$pdo->lastInsertId();

json_response([
    'run_id' => $runId,
    'mission_id' => $missionId,
    'mission' => [
        'tipo' => $mission['tipo'],
        'reward_xp' => (int)$mission['reward_xp'],
        'recovery_min' => (int)$mission['recovery_min'],
    ],
]);

?>
