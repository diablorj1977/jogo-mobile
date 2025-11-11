<?php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$pdo = get_pdo();

$stmt = $pdo->prepare('SELECT level, xp, nickname FROM users WHERE id = :id LIMIT 1');
$stmt->execute(['id' => $auth['user_id']]);
$userRow = $stmt->fetch();

$prefStmt = $pdo->prepare('SELECT mission_radius_km FROM user_prefs WHERE user_id = :id LIMIT 1');
$prefStmt->execute(['id' => $auth['user_id']]);
$pref = $prefStmt->fetch();
$geofence = $pref ? (int)$pref['mission_radius_km'] : APP_DEFAULT_GEOFENCE_KM;

$ecobotStmt = $pdo->prepare('SELECT nickname, down_until FROM ecobots WHERE user_id = :id LIMIT 1');
$ecobotStmt->execute(['id' => $auth['user_id']]);
$ecobot = $ecobotStmt->fetch();

$status = 'ACTIVE';
$downUntil = $ecobot['down_until'] ?? null;
if (!empty($downUntil) && strtotime($downUntil) > time()) {
    $status = 'DOWN';
}

json_response([
    'email' => $auth['email'],
    'nickname' => $userRow['nickname'] ?? null,
    'level' => isset($userRow['level']) ? (int)$userRow['level'] : (int)($auth['level'] ?? 1),
    'xp' => isset($userRow['xp']) ? (int)$userRow['xp'] : (int)($auth['xp'] ?? 0),
    'geofence_km' => $geofence,
    'ecobot' => [
        'nickname' => $ecobot['nickname'] ?? null,
        'status' => $status,
        'down_until' => $downUntil,
    ],
]);

?>
