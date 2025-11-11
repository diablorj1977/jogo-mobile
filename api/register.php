<?php // File: api/register.php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$data = require_post_json();
$email = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');
$nickname = trim($data['nickname'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    error_response('E-mail inválido');
}
if (strlen($password) < 6) {
    error_response('Senha deve possuir pelo menos 6 caracteres');
}

if ($nickname === '') {
    $nickname = substr($email, 0, strpos($email, '@')) ?: 'Eco';
}

$pdo = get_pdo();
$pdo->beginTransaction();

try {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    if ($stmt->fetch()) {
        throw new RuntimeException('E-mail já cadastrado');
    }

    $passHash = password_hash($password, PASSWORD_DEFAULT);
    $insertUser = $pdo->prepare(
        'INSERT INTO users (email, pass_hash, nickname, level, xp, status, created_at)
         VALUES (:email, :pass_hash, :nickname, 1, 0, "ACTIVE", NOW())'
    );
    $insertUser->execute([
        'email' => $email,
        'pass_hash' => $passHash,
        'nickname' => $nickname,
    ]);
    $userId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        'INSERT INTO user_prefs (user_id, mission_radius_km)
         VALUES (:user_id, :radius)
         ON DUPLICATE KEY UPDATE mission_radius_km = VALUES(mission_radius_km)'
    )->execute([
        'user_id' => $userId,
        'radius' => APP_DEFAULT_GEOFENCE_KM,
    ]);

    $pdo->prepare(
        'INSERT INTO ecobots (user_id, nickname, hp_current, energy_current, pity_counter, created_at)
         VALUES (:user_id, :nickname, 0, 0, 0, NOW())'
    )->execute([
        'user_id' => $userId,
        'nickname' => $nickname,
    ]);

    $starterCodes = [
        'carcass' => 'CRC_ONCA',
        'wpn1' => 'WPN_LASER',
        'wpn2' => 'WPN_GARRA',
        'mod1' => 'MOD_NANO',
        'mod2' => 'MOD_REPAIR',
    ];

    $templateStmt = $pdo->prepare(
        'SELECT id, code FROM item_templates WHERE code IN ("CRC_ONCA","WPN_LASER","WPN_GARRA","MOD_NANO","MOD_REPAIR")'
    );
    $templateStmt->execute();
    $templates = [];
    foreach ($templateStmt->fetchAll() as $row) {
        $templates[$row['code']] = (int)$row['id'];
    }

    $equippedIds = [];
    $inventoryInsert = $pdo->prepare(
        'INSERT INTO inventory (user_id, template_id, qty, upgrade_level, is_favorite, created_at)
         VALUES (:user_id, :template_id, 1, 0, 0, NOW())'
    );
    foreach ($starterCodes as $slot => $code) {
        if (!isset($templates[$code])) {
            throw new RuntimeException('Template inicial ausente: ' . $code);
        }
        $inventoryInsert->execute([
            'user_id' => $userId,
            'template_id' => $templates[$code],
        ]);
        $invId = (int)$pdo->lastInsertId();
        $equippedIds[$slot] = $invId;

        $pdo->prepare(
            'INSERT INTO equipped_items (user_id, slot, inventory_id)
             VALUES (:user_id, :slot, :inventory_id)
             ON DUPLICATE KEY UPDATE inventory_id = VALUES(inventory_id)'
        )->execute([
            'user_id' => $userId,
            'slot' => $slot,
            'inventory_id' => $invId,
        ]);
    }

    if (isset($equippedIds['carcass'])) {
        $pdo->prepare('UPDATE ecobots SET equipped_carcass_inv_id = :inv_id WHERE user_id = :user_id')
            ->execute([
                'inv_id' => $equippedIds['carcass'],
                'user_id' => $userId,
            ]);
    }

    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('+7 days'))->format('Y-m-d H:i:s');
    $pdo->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (:user_id, :token, :expires_at)')
        ->execute([
            'user_id' => $userId,
            'token' => $token,
            'expires_at' => $expires,
        ]);

    $pdo->commit();

    json_response([
        'token' => $token,
        'user_id' => $userId,
    ], 201);
} catch (Throwable $e) {
    $pdo->rollBack();
    error_response($e->getMessage(), 400);
}

?>
