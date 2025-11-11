<?php // File: api/inventory_equip.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$data = require_post_json();
$slot = $data['slot'] ?? '';
$inventoryId = (int)($data['inventory_id'] ?? 0);

$allowedSlots = ['carcass', 'wpn1', 'wpn2', 'mod1', 'mod2'];
if ($slot === '' || $inventoryId <= 0 || !in_array($slot, $allowedSlots, true)) {
    error_response('Dados inválidos');
}

$pdo = get_pdo();
$itemStmt = $pdo->prepare(
    'SELECT inv.id, it.kind
     FROM inventory inv
     INNER JOIN item_templates it ON it.id = inv.template_id
     WHERE inv.id = :id AND inv.user_id = :user_id'
);
$itemStmt->execute([
    'id' => $inventoryId,
    'user_id' => $auth['user_id'],
]);
$item = $itemStmt->fetch();
if (!$item) {
    error_response('Item não encontrado', 404);
}

$kind = $item['kind'];
if ($slot === 'carcass' && $kind !== 'CARCASS') {
    error_response('Apenas carcaças podem ocupar este slot');
}
if (strpos($slot, 'wpn') === 0 && $kind !== 'WEAPON') {
    error_response('Slot de arma incompatível');
}
if (strpos($slot, 'mod') === 0 && $kind !== 'MODULE') {
    error_response('Slot de módulo incompatível');
}

$configStmt = $pdo->prepare(
    'SELECT e.equipped_carcass_inv_id, it.weapon_slots, it.module_slots
     FROM ecobots e
     LEFT JOIN inventory inv ON inv.id = e.equipped_carcass_inv_id
     LEFT JOIN item_templates it ON it.id = inv.template_id
     WHERE e.user_id = :user_id
     LIMIT 1'
);
$configStmt->execute(['user_id' => $auth['user_id']]);
$config = $configStmt->fetch() ?: [];
$weaponSlots = isset($config['weapon_slots']) ? (int)$config['weapon_slots'] : 0;
$moduleSlots = isset($config['module_slots']) ? (int)$config['module_slots'] : 0;

if ($slot !== 'carcass') {
    if (strpos($slot, 'wpn') === 0) {
        $index = (int)substr($slot, 3);
        $allowedWeapons = $weaponSlots > 0 ? $weaponSlots : 2;
        if ($index < 1 || $index > $allowedWeapons) {
            error_response('Slot de arma indisponível');
        }
    }
    if (strpos($slot, 'mod') === 0) {
        $index = (int)substr($slot, 3);
        $allowedModules = $moduleSlots > 0 ? $moduleSlots : 2;
        if ($index < 1 || $index > $allowedModules) {
            error_response('Slot de módulo indisponível');
        }
    }
}

$pdo->prepare('DELETE FROM equipped_items WHERE user_id = :user_id AND inventory_id = :inventory_id')
    ->execute([
        'user_id' => $auth['user_id'],
        'inventory_id' => $inventoryId,
    ]);

$pdo->prepare(
    'INSERT INTO equipped_items (user_id, slot, inventory_id)
     VALUES (:user_id, :slot, :inventory_id)
     ON DUPLICATE KEY UPDATE inventory_id = VALUES(inventory_id)'
)->execute([
    'user_id' => $auth['user_id'],
    'slot' => $slot,
    'inventory_id' => $inventoryId,
]);

if ($slot === 'carcass') {
    $pdo->prepare('UPDATE ecobots SET equipped_carcass_inv_id = :inv_id WHERE user_id = :user_id')
        ->execute([
            'inv_id' => $inventoryId,
            'user_id' => $auth['user_id'],
        ]);
    // Ao trocar de carcaça, limpa armas/módulos equipados
    $pdo->prepare('DELETE FROM equipped_items WHERE user_id = :user_id AND slot IN ("wpn1","wpn2","mod1","mod2")')
        ->execute(['user_id' => $auth['user_id']]);
}

json_response([
    'slot' => $slot,
    'inventory_id' => $inventoryId,
]);

?>
