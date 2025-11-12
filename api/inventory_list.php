<?php // File: api/inventory_list.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$pdo = get_pdo();

$stmt = $pdo->prepare(
    'SELECT inv.id, inv.template_id, inv.qty, inv.upgrade_level, inv.is_favorite,
            it.code, it.name, it.kind, it.rarity, it.min_level, it.description, it.image_path,
            it.base_hp, it.base_atk, it.base_def, it.base_speed, it.base_focus, it.energy_max AS template_energy_max,
            it.res_kinetic, it.res_thermal, it.res_electric, it.res_chemical, it.res_emp,
            it.dmg_min, it.dmg_max, it.dmg_type, it.energy_cost, it.accuracy, it.crit_bonus,
            it.status_code, it.status_chance, it.module_kind, it.module_value, it.module_duration, it.module_cooldown,
            it.weapon_slots, it.module_slots
     FROM inventory inv
     INNER JOIN item_templates it ON it.id = inv.template_id
     WHERE inv.user_id = :user_id
     ORDER BY inv.created_at DESC, inv.id DESC'
);
$stmt->execute(['user_id' => $auth['user_id']]);
$items = [];
$itemsById = [];
foreach ($stmt->fetchAll() as $row) {
    $statValues = [
        'hp' => (int)$row['base_hp'],
        'atk' => (int)$row['base_atk'],
        'def' => (int)$row['base_def'],
        'speed' => (int)$row['base_speed'],
        'focus' => (int)$row['base_focus'],
        'energy' => (int)$row['template_energy_max'],
    ];
    $resistances = [
        'kinetic' => $row['res_kinetic'] !== null ? (float)$row['res_kinetic'] : null,
        'thermal' => $row['res_thermal'] !== null ? (float)$row['res_thermal'] : null,
        'electric' => $row['res_electric'] !== null ? (float)$row['res_electric'] : null,
        'chemical' => $row['res_chemical'] !== null ? (float)$row['res_chemical'] : null,
        'emp' => $row['res_emp'] !== null ? (float)$row['res_emp'] : null,
    ];
    $weaponStats = [
        'dmg_min' => $row['dmg_min'] !== null ? (int)$row['dmg_min'] : null,
        'dmg_max' => $row['dmg_max'] !== null ? (int)$row['dmg_max'] : null,
        'dmg_type' => $row['dmg_type'] ?: null,
        'energy_cost' => $row['energy_cost'] !== null ? (int)$row['energy_cost'] : null,
        'accuracy' => $row['accuracy'] !== null ? (int)$row['accuracy'] : null,
        'crit_bonus' => $row['crit_bonus'] !== null ? (int)$row['crit_bonus'] : null,
        'status_code' => $row['status_code'] ?: null,
        'status_chance' => $row['status_chance'] !== null ? (int)$row['status_chance'] : null,
    ];
    $moduleStats = [
        'module_kind' => $row['module_kind'] ?: null,
        'module_value' => $row['module_value'] !== null ? (int)$row['module_value'] : null,
        'module_duration' => $row['module_duration'] !== null ? (int)$row['module_duration'] : null,
        'module_cooldown' => $row['module_cooldown'] !== null ? (int)$row['module_cooldown'] : null,
        'module_energy_cost' => null,
        'effects' => [],
    ];

    if ($moduleStats['module_kind']) {
        $kindKey = strtoupper($moduleStats['module_kind']);
        $moduleStats['module_energy_cost'] = APP_BATTLE_MODULE_ENERGY_COSTS[$kindKey] ?? 0;
        if (isset(APP_MODULE_BONUS_DEFINITIONS[$kindKey])) {
            $definition = APP_MODULE_BONUS_DEFINITIONS[$kindKey];
            $rawValue = $moduleStats['module_value'] ?? 0;
            $rarityMultiplier = APP_RARITY_SCALING[$row['rarity']] ?? 1.0;
            $moduleStats['effects'][] = [
                'type' => $definition['type'],
                'unit' => $definition['unit'],
                'label' => $definition['label'],
                'value_percent' => (float)$rawValue,
                'effective_percent' => (float)$rawValue * $rarityMultiplier,
                'rarity_multiplier' => $rarityMultiplier,
            ];
        }
    }

    $item = [
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
        'description' => $row['description'],
        'image_path' => $row['image_path'],
        'image_url' => ecobots_resolve_item_icon($row['code'], $row['kind'], $row['image_path']),
        'stats' => $statValues,
        'resistances' => $resistances,
        'weapon' => $weaponStats,
        'module' => $moduleStats,
        'weapon_slots' => $row['weapon_slots'] !== null ? (int)$row['weapon_slots'] : 0,
        'module_slots' => $row['module_slots'] !== null ? (int)$row['module_slots'] : 0,
    ];

    $items[] = $item;
    $itemsById[$item['id']] = $item;
}

$equippedStmt = $pdo->prepare('SELECT slot, inventory_id FROM equipped_items WHERE user_id = :user_id');
$equippedStmt->execute(['user_id' => $auth['user_id']]);
$equipped = [];
foreach ($equippedStmt->fetchAll() as $row) {
    $equipped[$row['slot']] = (int)$row['inventory_id'];
}

$ecobotStmt = $pdo->prepare('SELECT nickname, base_atk, base_def, base_speed, base_focus, energy_max, hp_current, equipped_carcass_inv_id FROM ecobots WHERE user_id = :user_id LIMIT 1');
$ecobotStmt->execute(['user_id' => $auth['user_id']]);
$ecobotRow = $ecobotStmt->fetch();

$baselineStats = APP_ECOBOT_BASELINE_STATS;
$baseStats = [
    'hp' => ($baselineStats['hp'] ?? 0) + ($ecobotRow ? (int)$ecobotRow['hp_current'] : 0),
    'atk' => ($baselineStats['atk'] ?? 0) + ($ecobotRow ? (int)$ecobotRow['base_atk'] : 0),
    'def' => ($baselineStats['def'] ?? 0) + ($ecobotRow ? (int)$ecobotRow['base_def'] : 0),
    'speed' => ($baselineStats['speed'] ?? 0) + ($ecobotRow ? (int)$ecobotRow['base_speed'] : 0),
    'focus' => ($baselineStats['focus'] ?? 0) + ($ecobotRow ? (int)$ecobotRow['base_focus'] : 0),
    'energy' => ($baselineStats['energy'] ?? 0) + ($ecobotRow ? (int)$ecobotRow['energy_max'] : 0),
];

$equipmentBonus = ['hp' => 0, 'atk' => 0, 'def' => 0, 'speed' => 0, 'focus' => 0, 'energy' => 0];
$totalResistances = ['kinetic' => 1.0, 'thermal' => 1.0, 'electric' => 1.0, 'chemical' => 1.0, 'emp' => 1.0];
$moduleBonuses = [
    'drop' => 0.0,
    'xp' => 0.0,
    'breakdown' => [],
];

foreach ($equipped as $inventoryId) {
    if ($inventoryId <= 0 || !isset($itemsById[$inventoryId])) {
        continue;
    }
    $item = $itemsById[$inventoryId];
    foreach ($item['stats'] as $statKey => $value) {
        if (!isset($equipmentBonus[$statKey]) || $value === null) {
            continue;
        }
        $equipmentBonus[$statKey] += (int)$value;
    }
    foreach ($item['resistances'] as $resKey => $resValue) {
        if ($resValue === null) {
            continue;
        }
        $totalResistances[$resKey] *= (float)$resValue;
    }
    if (strtoupper($item['kind']) === 'MODULE' && !empty($item['module']['effects'])) {
        foreach ($item['module']['effects'] as $effect) {
            $effective = (float)($effect['effective_percent'] ?? 0.0);
            if ($effective <= 0) {
                continue;
            }
            if ($effect['type'] === 'drop') {
                $moduleBonuses['drop'] += $effective;
            } elseif ($effect['type'] === 'xp') {
                $moduleBonuses['xp'] += $effective;
            }
            $moduleBonuses['breakdown'][] = [
                'item_id' => $item['id'],
                'name' => $item['name'],
                'type' => $effect['type'],
                'value_percent' => $effective,
            ];
        }
    }
}

$totalStats = [];
foreach ($baseStats as $key => $value) {
    $totalStats[$key] = $value + ($equipmentBonus[$key] ?? 0);
}

$equippedCarcassId = $equipped['carcass'] ?? ($ecobotRow['equipped_carcass_inv_id'] ?? null);
$weaponSlots = 0;
$moduleSlots = 0;
if ($equippedCarcassId && isset($itemsById[$equippedCarcassId])) {
    $carcassItem = $itemsById[$equippedCarcassId];
    $weaponSlots = max(0, (int)$carcassItem['weapon_slots']);
    $moduleSlots = max(0, (int)$carcassItem['module_slots']);
} else {
    $weaponSlots = 2;
    $moduleSlots = 2;
}

$availableSlots = ['carcass'];
for ($i = 1; $i <= $weaponSlots; $i++) {
    $availableSlots[] = 'wpn' . $i;
}
for ($i = 1; $i <= $moduleSlots; $i++) {
    $availableSlots[] = 'mod' . $i;
}
foreach (array_keys($equipped) as $slotKey) {
    if (!in_array($slotKey, $availableSlots, true)) {
        $availableSlots[] = $slotKey;
    }
}

json_response([
    'items' => $items,
    'equipped' => $equipped,
    'ecobot' => [
        'nickname' => $ecobotRow['nickname'] ?? null,
        'baseline_stats' => APP_ECOBOT_BASELINE_STATS,
        'basic_attack' => APP_ECOBOT_BASIC_ATTACK,
        'base_stats' => $baseStats,
        'equipment_bonus' => $equipmentBonus,
        'total_stats' => $totalStats,
        'resistances' => $totalResistances,
        'equipped_carcass_inv_id' => $equippedCarcassId ? (int)$equippedCarcassId : null,
        'bonuses' => [
            'drop_chance_base' => APP_BASE_DROP_CHANCE,
            'drop_chance_bonus' => $moduleBonuses['drop'] / 100,
            'drop_chance_bonus_percent' => $moduleBonuses['drop'],
            'xp_bonus_percent' => $moduleBonuses['xp'],
            'module_breakdown' => $moduleBonuses['breakdown'],
        ],
    ],
    'slot_config' => [
        'weapon_slots' => $weaponSlots,
        'module_slots' => $moduleSlots,
        'available_slots' => $availableSlots,
    ],
]);

?>
