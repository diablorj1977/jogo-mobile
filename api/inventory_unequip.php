<?php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$slot = $data['slot'] ?? '';
$allowedSlots = ['carcass', 'wpn1', 'wpn2', 'mod1', 'mod2'];

if (!in_array($slot, $allowedSlots, true)) {
    error_response('Slot inválido');
}

$pdo = get_pdo();
$pdo->prepare('DELETE FROM equipped_items WHERE user_id = :user_id AND slot = :slot')
    ->execute([
        'user_id' => $auth['user_id'],
        'slot' => $slot,
    ]);

if ($slot === 'carcass') {
    $pdo->prepare('UPDATE ecobots SET equipped_carcass_inv_id = NULL WHERE user_id = :user_id')
        ->execute(['user_id' => $auth['user_id']]);
}

json_response([
    'slot' => $slot,
    'inventory_id' => null,
]);

?>
