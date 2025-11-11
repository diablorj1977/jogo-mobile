<?php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$encounterId = (int)($data['encounter_id'] ?? 0);
$result = strtoupper($data['result'] ?? '');

if ($encounterId <= 0 || !in_array($result, ['WIN', 'LOSE', 'ESCAPE'], true)) {
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
if (!in_array($encounter['status'], ['SPAWNED', 'STARTED'], true)) {
    error_response('Encontro já resolvido', 409);
}

$pdo->prepare('UPDATE encounters SET status = "FINISHED", finished_at = NOW() WHERE id = :id')
    ->execute(['id' => $encounterId]);

$pdo->prepare(
    'UPDATE battles SET status = :status, updated_at = NOW(), finished_at = NOW()
     WHERE user_id = :user_id AND source = "ENCOUNTER" AND source_id = :encounter_id
     ORDER BY id DESC LIMIT 1'
)->execute([
    'status' => $result,
    'user_id' => $auth['user_id'],
    'encounter_id' => $encounterId,
]);

if ($result === 'LOSE') {
    $downUntil = (new DateTimeImmutable('+' . APP_ECOBOT_DOWN_HOURS . ' hours'))->format('Y-m-d H:i:s');
    $pdo->prepare('UPDATE ecobots SET down_until = :down_until WHERE user_id = :user_id')
        ->execute([
            'down_until' => $downUntil,
            'user_id' => $auth['user_id'],
        ]);
} elseif ($result === 'WIN') {
    $reward = (int)$encounter['reward_xp'];
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
}

json_response([
    'encounter_id' => $encounterId,
    'result' => $result,
]);

?>
