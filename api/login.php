<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$data = require_post_json();
$email = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    error_response('E-mail inválido');
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id, pass_hash, status FROM users WHERE email = :email LIMIT 1');
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || $user['status'] !== 'ACTIVE' || !password_verify($password, $user['pass_hash'])) {
    error_response('Credenciais inválidas', 401);
}

$token = bin2hex(random_bytes(32));
$expires = (new DateTimeImmutable('+7 days'))->format('Y-m-d H:i:s');
$pdo->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (:user_id, :token, :expires_at)')
    ->execute([
        'user_id' => (int)$user['id'],
        'token' => $token,
        'expires_at' => $expires,
    ]);

json_response([
    'token' => $token,
    'user_id' => (int)$user['id'],
    'expires_at' => $expires,
]);

?>
