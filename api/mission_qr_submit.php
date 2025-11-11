<?php // File: api/mission_qr_submit.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$runId = (int)($data['run_id'] ?? 0);
$code = trim($data['code'] ?? '');

if ($runId <= 0 || $code === '') {
    error_response('Dados inválidos');
}

$pdo = get_pdo();
$stmt = $pdo->prepare(
    'SELECT mr.id, mr.mission_id, m.qr_secret, m.tipo
     FROM mission_runs mr
     INNER JOIN missions m ON m.id = mr.mission_id
     WHERE mr.id = :run_id AND mr.user_id = :user_id'
);
$stmt->execute([
    'run_id' => $runId,
    'user_id' => $auth['user_id'],
]);
$run = $stmt->fetch();
if (!$run) {
    error_response('Execução não encontrada', 404);
}
if (strtoupper($run['tipo']) !== 'SCAN') {
    error_response('Missão não requer QR code', 400);
}

$hash = hash('sha256', $code);
$valid = false;

if (!empty($run['qr_secret'])) {
    $secret = trim($run['qr_secret']);
    if (hash_equals($secret, $code) || hash_equals(hash('sha256', $secret), $hash)) {
        $valid = true;
    }
}

$tokenId = null;
if (!$valid) {
    $tokenStmt = $pdo->prepare('SELECT id, token_hash, used_by FROM qr_tokens WHERE mission_id = :mission_id');
    $tokenStmt->execute(['mission_id' => $run['mission_id']]);
    foreach ($tokenStmt->fetchAll() as $row) {
        $tokenHash = $row['token_hash'];
        if (!$tokenHash) {
            continue;
        }
        if (hash_equals($tokenHash, $hash)) {
            $valid = true;
            $tokenId = (int)$row['id'];
            if (!empty($row['used_by']) && (int)$row['used_by'] !== $auth['user_id']) {
                $valid = false;
            }
            break;
        }
    }
}

if (!$valid) {
    error_response('QR code inválido', 400);
}

$pdo->prepare('UPDATE mission_runs SET proof_code = :code, proof_qr_hash = :hash WHERE id = :run_id')
    ->execute([
        'code' => $code,
        'hash' => $hash,
        'run_id' => $runId,
    ]);

if ($tokenId !== null) {
    $pdo->prepare('UPDATE qr_tokens SET used_by = :user_id, used_at = NOW() WHERE id = :id')
        ->execute([
            'user_id' => $auth['user_id'],
            'id' => $tokenId,
        ]);
}

json_response(['qr_valid' => true]);

?>
