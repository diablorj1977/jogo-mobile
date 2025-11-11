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
$lat = $data['lat'] ?? null;
$lng = $data['lng'] ?? null;

if (!validate_coordinates($lat, $lng)) {
    error_response('Coordenadas inválidas');
}

$pdo = get_pdo();
$ecobotStmt = $pdo->prepare('SELECT pity_counter, next_random_ok_at FROM ecobots WHERE user_id = :user_id LIMIT 1');
$ecobotStmt->execute(['user_id' => $auth['user_id']]);
$ecobot = $ecobotStmt->fetch();
if (!$ecobot) {
    error_response('Ecobot não encontrado', 404);
}

if (!empty($ecobot['next_random_ok_at']) && strtotime($ecobot['next_random_ok_at']) > time()) {
    $seconds = strtotime($ecobot['next_random_ok_at']) - time();
    json_response([
        'spawned' => false,
        'cooldown' => $seconds,
        'encounter' => null,
    ]);
}

$pity = (int)$ecobot['pity_counter'];
$chance = APP_ENCOUNTER_BASE_CHANCE + ($pity * APP_PITY_INCREMENT);
if ($chance > 1) {
    $chance = 1;
}
$spawned = false;
if ($pity >= APP_PITY_THRESHOLD) {
    $spawned = true;
} else {
    $roll = mt_rand() / mt_getrandmax();
    $spawned = $roll <= $chance;
}

$encounterData = null;

if ($spawned) {
    $enemyRow = $pdo->query('SELECT id, reward_xp FROM enemy_templates WHERE active = 1 ORDER BY RAND() LIMIT 1')->fetch();
    if (!$enemyRow) {
        error_response('Nenhum inimigo disponível', 500);
    }
    $expires = (new DateTimeImmutable('+' . APP_ENCOUNTER_COOLDOWN_SECONDS . ' seconds'))->format('Y-m-d H:i:s');
    $seed = random_int(1, 999999);
    $insert = $pdo->prepare(
        'INSERT INTO encounters (user_id, enemy_id, lat, lng, status, created_at, expires_at, seed, reward_xp)
         VALUES (:user_id, :enemy_id, :lat, :lng, "SPAWNED", NOW(), :expires_at, :seed, :reward)'
    );
    $insert->execute([
        'user_id' => $auth['user_id'],
        'enemy_id' => $enemyRow['id'],
        'lat' => $lat,
        'lng' => $lng,
        'expires_at' => $expires,
        'seed' => $seed,
        'reward' => (int)$enemyRow['reward_xp'],
    ]);
    $encounterId = (int)$pdo->lastInsertId();
    $encounterData = [
        'encounter_id' => $encounterId,
        'enemy_id' => (int)$enemyRow['id'],
        'expires_at' => $expires,
    ];
    $pity = 0;
} else {
    $pity++;
}

$update = $pdo->prepare(
    'UPDATE ecobots
     SET pity_counter = :pity,
         last_lat = :lat,
         last_lng = :lng,
         last_scan_at = NOW(),
         next_random_ok_at = DATE_ADD(NOW(), INTERVAL :cooldown SECOND)
     WHERE user_id = :user_id'
);
$update->execute([
    'pity' => $pity,
    'lat' => $lat,
    'lng' => $lng,
    'cooldown' => APP_ENCOUNTER_COOLDOWN_SECONDS,
    'user_id' => $auth['user_id'],
]);

json_response([
    'spawned' => $spawned,
    'encounter' => $encounterData,
    'chance' => $chance,
    'pity_counter' => $pity,
]);

?>
