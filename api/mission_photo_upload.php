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
$runId = (int)($data['run_id'] ?? 0);
$photoBase64 = $data['photo_base64'] ?? '';

if ($runId <= 0 || empty($photoBase64)) {
    error_response('Dados insuficientes');
}

$pdo = get_pdo();
$runStmt = $pdo->prepare(
    'SELECT mr.id, m.tipo FROM mission_runs mr INNER JOIN missions m ON m.id = mr.mission_id
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
if (strtoupper($run['tipo']) !== 'FOTO') {
    error_response('A missão não exige foto', 400);
}

if (!is_dir(APP_UPLOAD_PATH) && !mkdir(APP_UPLOAD_PATH, 0755, true) && !is_dir(APP_UPLOAD_PATH)) {
    error_response('Não foi possível preparar diretório de upload', 500);
}

$photoData = base64_decode($photoBase64, true);
if ($photoData === false) {
    error_response('Imagem inválida');
}

$filename = 'mission_' . $runId . '_' . date('Ymd_His') . '.jpg';
$filePath = APP_UPLOAD_PATH . '/' . $filename;
if (file_put_contents($filePath, $photoData) === false) {
    error_response('Falha ao salvar arquivo', 500);
}
$publicPath = APP_UPLOAD_URL . '/' . $filename;

$pdo->prepare('UPDATE mission_runs SET proof_photo = :photo WHERE id = :run_id AND user_id = :user_id')
    ->execute([
        'photo' => $publicPath,
        'run_id' => $runId,
        'user_id' => $auth['user_id'],
    ]);

json_response([
    'photo_url' => $publicPath,
]);

?>
