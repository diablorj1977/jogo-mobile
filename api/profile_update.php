<?php // File: api/profile_update.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();

$geofence = isset($data['geofence_km']) ? (int)$data['geofence_km'] : null;
$nickname = isset($data['nickname']) ? trim($data['nickname']) : null;

$allowedGeofence = [3, 10, 50];
if ($geofence !== null && !in_array($geofence, $allowedGeofence, true)) {
    error_response('Geofence inválido');
}

$pdo = get_pdo();
$updates = 0;

if ($geofence !== null) {
    $pdo->prepare(
        'INSERT INTO user_prefs (user_id, mission_radius_km)
         VALUES (:user_id, :radius)
         ON DUPLICATE KEY UPDATE mission_radius_km = VALUES(mission_radius_km)'
    )->execute([
        'user_id' => $auth['user_id'],
        'radius' => $geofence,
    ]);
    $updates++;
}

if ($nickname !== null && $nickname !== '') {
    $pdo->prepare('UPDATE users SET nickname = :nickname WHERE id = :user_id')
        ->execute([
            'nickname' => $nickname,
            'user_id' => $auth['user_id'],
        ]);
    $updates++;
}

if ($updates === 0) {
    error_response('Nenhuma alteração informada');
}

json_response(['updated' => true]);

?>
