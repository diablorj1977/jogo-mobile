<?php // File: api/mission_abort.php
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

$missionId = (int)($data['mission_id'] ?? 0);
$runId = (int)($data['run_id'] ?? 0);

if ($missionId <= 0 || $runId <= 0) {
    error_response('Dados da missão ausentes');
}

$pdo = get_pdo();
$stmt = $pdo->prepare(
    'SELECT mission_id, status FROM mission_runs WHERE id = :run_id AND user_id = :user_id LIMIT 1'
);
$stmt->execute([
    'run_id' => $runId,
    'user_id' => $auth['user_id'],
]);
$run = $stmt->fetch();

if (!$run || (int)$run['mission_id'] !== $missionId) {
    error_response('Execução não encontrada', 404);
}

if ($run['status'] !== 'STARTED') {
    error_response('Não é possível abortar uma missão finalizada');
}

$updates = [];
$params = [
    'run_id' => $runId,
];

if (isset($data['end_lat'], $data['end_lng']) && validate_coordinates($data['end_lat'], $data['end_lng'])) {
    $updates[] = 'end_lat = :end_lat';
    $updates[] = 'end_lng = :end_lng';
    $params['end_lat'] = $data['end_lat'];
    $params['end_lng'] = $data['end_lng'];
}

if (isset($data['duration_s'])) {
    $updates[] = 'duration_s = :duration_s';
    $params['duration_s'] = max(0, (int)$data['duration_s']);
}

if (isset($data['dist_m'])) {
    $updates[] = 'dist_m = :dist_m';
    $params['dist_m'] = max(0, (float)$data['dist_m']);
}

$updates[] = 'status = "CANCELLED"';
$updates[] = 'finished_at = NOW()';
$updates[] = 'reward_xp = 0';

$sql = 'UPDATE mission_runs SET ' . implode(', ', $updates) . ' WHERE id = :run_id';
$pdo->prepare($sql)->execute($params);

json_response([
    'mission_id' => $missionId,
    'run_id' => $runId,
    'status' => 'CANCELLED',
]);

?>
