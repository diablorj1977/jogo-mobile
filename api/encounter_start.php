<?php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/geo.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$encounterId = (int)($data['encounter_id'] ?? 0);
$lat = $data['lat'] ?? null;
$lng = $data['lng'] ?? null;

if ($encounterId <= 0 || !validate_coordinates($lat, $lng)) {
    error_response('Dados inválidos');
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT * FROM encounters WHERE id = :id AND user_id = :user_id');
$stmt->execute([
    'id' => $encounterId,
    'user_id' => $auth['user_id'],
]);
$encounter = $stmt->fetch();
if (!$encounter) {
    error_response('Encontro não encontrado', 404);
}
if ($encounter['status'] !== 'SPAWNED') {
    error_response('Encontro já iniciado', 409);
}
if (!empty($encounter['expires_at']) && strtotime($encounter['expires_at']) < time()) {
    $pdo->prepare('UPDATE encounters SET status = "EXPIRED" WHERE id = :id')->execute(['id' => $encounterId]);
    error_response('Encontro expirado', 410);
}

$distance = haversine_distance((float)$lat, (float)$lng, (float)$encounter['lat'], (float)$encounter['lng']);
if ($distance > APP_ENCOUNTER_RADIUS_M) {
    error_response('Fora do raio do encontro');
}

$pdo->prepare('UPDATE encounters SET status = "STARTED", started_at = NOW() WHERE id = :id')
    ->execute(['id' => $encounterId]);

$enemyStmt = $pdo->prepare('SELECT id, name, level, reward_xp FROM enemy_templates WHERE id = :id');
$enemyStmt->execute(['id' => $encounter['enemy_id']]);
$enemy = $enemyStmt->fetch();

$state = [
    'enemy_id' => (int)$encounter['enemy_id'],
    'seed' => (int)$encounter['seed'],
    'reward_xp' => (int)$encounter['reward_xp'],
];
$pdo->prepare(
    'INSERT INTO battles (user_id, source, source_id, mission_run_id, who, turn, status, state_json, created_at)
     VALUES (:user_id, "ENCOUNTER", :source_id, NULL, "PLAYER", 1, "ACTIVE", :state, NOW())'
)->execute([
    'user_id' => $auth['user_id'],
    'source_id' => $encounterId,
    'state' => json_encode($state, JSON_UNESCAPED_UNICODE),
]);

$pdo->prepare(
    'UPDATE ecobots SET last_lat = :lat, last_lng = :lng WHERE user_id = :user_id'
)->execute([
    'lat' => $lat,
    'lng' => $lng,
    'user_id' => $auth['user_id'],
]);

json_response([
    'encounter_id' => $encounterId,
    'status' => 'STARTED',
    'enemy' => $enemy ?: ['id' => (int)$encounter['enemy_id']],
]);

?>
