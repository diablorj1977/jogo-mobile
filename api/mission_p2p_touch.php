<?php // File: api/mission_p2p_touch.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/geo.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$runId = (int)($data['run_id'] ?? 0);
$seq = (int)($data['seq'] ?? 0);
$lat = $data['lat'] ?? null;
$lng = $data['lng'] ?? null;

if ($runId <= 0 || $seq <= 0 || !validate_coordinates($lat, $lng)) {
    error_response('Dados inválidos');
}

$pdo = get_pdo();
$runStmt = $pdo->prepare(
    'SELECT mr.mission_id, mr.status, m.tipo
     FROM mission_runs mr
     INNER JOIN missions m ON m.id = mr.mission_id
     WHERE mr.id = :run_id AND mr.user_id = :user_id'
);
$runStmt->execute([
    'run_id' => $runId,
    'user_id' => $auth['user_id'],
]);
$run = $runStmt->fetch();
if (!$run) {
    error_response('Execução não encontrada', 404);
}
if ($run['status'] !== 'STARTED') {
    error_response('Missão não está em andamento');
}
if (!in_array(strtoupper($run['tipo']), ['P2P', 'P2P_GRUPO', 'CORRIDA'], true)) {
    error_response('Missão não possui checkpoints sequenciais');
}

$pointStmt = $pdo->prepare(
    'SELECT lat, lng, raio_m FROM mission_points WHERE mission_id = :mission_id AND seq = :seq'
);
$pointStmt->execute([
    'mission_id' => $run['mission_id'],
    'seq' => $seq,
]);
$point = $pointStmt->fetch();
if (!$point) {
    error_response('Ponto da missão não encontrado', 404);
}

$existingStmt = $pdo->prepare('SELECT 1 FROM mission_run_points WHERE run_id = :run_id AND point_seq = :seq');
$existingStmt->execute(['run_id' => $runId, 'seq' => $seq]);
if ($existingStmt->fetch()) {
    error_response('Ponto já registrado');
}

$distance = haversine_distance((float)$lat, (float)$lng, (float)$point['lat'], (float)$point['lng']);
if ($distance > (int)$point['raio_m']) {
    error_response('Distante demais do ponto');
}

$insert = $pdo->prepare(
    'INSERT INTO mission_run_points (run_id, point_seq, reached_at, lat, lng)
     VALUES (:run_id, :seq, NOW(), :lat, :lng)'
);
$insert->execute([
    'run_id' => $runId,
    'seq' => $seq,
    'lat' => $lat,
    'lng' => $lng,
]);

json_response([
    'run_id' => $runId,
    'seq' => $seq,
]);

?>
