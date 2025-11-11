<?php // File: api/inventory_list.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$pdo = get_pdo();

$stmt = $pdo->prepare(
    'SELECT inv.id, inv.template_id, inv.qty, inv.upgrade_level, inv.is_favorite,
            it.code, it.name, it.kind, it.rarity, it.min_level
     FROM inventory inv
     INNER JOIN item_templates it ON it.id = inv.template_id
     WHERE inv.user_id = :user_id
     ORDER BY inv.created_at DESC, inv.id DESC'
);
$stmt->execute(['user_id' => $auth['user_id']]);
$items = [];
foreach ($stmt->fetchAll() as $row) {
    $items[] = [
        'id' => (int)$row['id'],
        'template_id' => (int)$row['template_id'],
        'code' => $row['code'],
        'name' => $row['name'],
        'kind' => $row['kind'],
        'rarity' => $row['rarity'],
        'min_level' => $row['min_level'] !== null ? (int)$row['min_level'] : null,
        'qty' => (int)$row['qty'],
        'upgrade_level' => (int)$row['upgrade_level'],
        'is_favorite' => (bool)$row['is_favorite'],
    ];
}

$equippedStmt = $pdo->prepare('SELECT slot, inventory_id FROM equipped_items WHERE user_id = :user_id');
$equippedStmt->execute(['user_id' => $auth['user_id']]);
$equipped = [];
foreach ($equippedStmt->fetchAll() as $row) {
    $equipped[$row['slot']] = (int)$row['inventory_id'];
}

json_response([
    'items' => $items,
    'equipped' => $equipped,
]);

?>
