<?php
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
$runId = (int)($data['run_id'] ?? 0);

if ($missionId <= 0 || $runId <= 0) {
    error_response('Dados da missão ausentes');
}

$pdo = get_pdo();
$stmt = $pdo->prepare(
    'SELECT mr.*, m.tipo, m.reward_xp, m.recovery_min
     FROM mission_runs mr
     INNER JOIN missions m ON m.id = mr.mission_id
     WHERE mr.id = :run_id AND mr.user_id = :user_id'
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
    error_response('Missão já finalizada');
}

$updates = [];
$params = ['run_id' => $runId];

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
if (!empty($data['photo_path'])) {
    $updates[] = 'proof_photo = :proof_photo';
    $params['proof_photo'] = $data['photo_path'];
}

$tipo = strtoupper($run['tipo']);
switch ($tipo) {
    case 'FOTO':
        if (empty($params['proof_photo']) && empty($run['proof_photo'])) {
            error_response('É necessário enviar a foto antes de finalizar');
        }
        break;
    case 'SCAN':
        $code = trim($data['code'] ?? '');
        if ($code !== '') {
            $hash = hash('sha256', $code);
            $updates[] = 'proof_code = :proof_code';
            $updates[] = 'proof_qr_hash = :proof_qr_hash';
            $params['proof_code'] = $code;
            $params['proof_qr_hash'] = $hash;
        } elseif (empty($run['proof_qr_hash'])) {
            error_response('Código QR não registrado');
        }
        break;
    case 'CORRIDA':
    case 'P2P':
    case 'P2P_GRUPO':
        if (empty($params['duration_s']) || empty($params['dist_m'])) {
            error_response('Dados de corrida incompletos');
        }
        break;
    default:
        break;
}

$updates[] = 'status = "FINISHED"';
$updates[] = 'finished_at = NOW()';
$updates[] = 'reward_xp = :reward_xp';
$params['reward_xp'] = (int)$run['reward_xp'];

$sql = 'UPDATE mission_runs SET ' . implode(', ', $updates) . ' WHERE id = :run_id';
$pdo->prepare($sql)->execute($params);

$reward = (int)$run['reward_xp'];
if ($reward > 0) {
    $pdo->prepare('UPDATE users SET xp = xp + :xp WHERE id = :user_id')
        ->execute([
            'xp' => $reward,
            'user_id' => $auth['user_id'],
        ]);
    $levelStmt = $pdo->prepare('SELECT xp, level FROM users WHERE id = :user_id');
    $levelStmt->execute(['user_id' => $auth['user_id']]);
    if ($userRow = $levelStmt->fetch()) {
        $xp = (int)$userRow['xp'];
        $currentLevel = (int)$userRow['level'];
        $calculated = max(1, (int)floor($xp / 100) + 1);
        if ($calculated > $currentLevel) {
            $pdo->prepare('UPDATE users SET level = :level WHERE id = :user_id')
                ->execute([
                    'level' => $calculated,
                    'user_id' => $auth['user_id'],
                ]);
        }
    }
}

$ecobotStmt = $pdo->prepare('SELECT down_until FROM ecobots WHERE user_id = :user_id LIMIT 1');
$ecobotStmt->execute(['user_id' => $auth['user_id']]);
$ecobot = $ecobotStmt->fetch();
if ($ecobot && !empty($ecobot['down_until'])) {
    $recovery = (int)$run['recovery_min'];
    $newDown = apply_recovery_minutes($ecobot['down_until'], $recovery);
    $pdo->prepare('UPDATE ecobots SET down_until = :down_until WHERE user_id = :user_id')
        ->execute([
            'down_until' => $newDown,
            'user_id' => $auth['user_id'],
        ]);
}

json_response([
    'run_id' => $runId,
    'mission_id' => $missionId,
    'status' => 'FINISHED',
]);

?>
