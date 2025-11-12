<?php // File: api/mission_finish.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/geo.php';
require_once __DIR__ . '/core/rules.php';
require_once __DIR__ . '/init_config.php';

function ecobots_calculate_equipped_module_bonuses(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT inv.id AS inventory_id, it.name, it.rarity, it.module_kind, it.module_value'
        . ' FROM equipped_items ei'
        . ' INNER JOIN inventory inv ON inv.id = ei.inventory_id'
        . ' INNER JOIN item_templates it ON it.id = inv.template_id'
        . ' WHERE ei.user_id = :user_id AND ei.slot LIKE "mod%"'
    );
    $stmt->execute(['user_id' => $userId]);

    $bonuses = [
        'xp_percent' => 0.0,
        'drop_percent' => 0.0,
        'breakdown' => [],
    ];

    foreach ($stmt->fetchAll() as $row) {
        $kindKey = strtoupper($row['module_kind'] ?? '');
        if ($kindKey === '' || !isset(APP_MODULE_BONUS_DEFINITIONS[$kindKey])) {
            continue;
        }
        $definition = APP_MODULE_BONUS_DEFINITIONS[$kindKey];
        $rawValue = isset($row['module_value']) ? (int)$row['module_value'] : 0;
        if ($rawValue <= 0) {
            continue;
        }
        $rarity = $row['rarity'] ?? 'C';
        $rarityMultiplier = APP_RARITY_SCALING[$rarity] ?? 1.0;
        $effectivePercent = $rawValue * $rarityMultiplier;
        if ($definition['type'] === 'xp') {
            $bonuses['xp_percent'] += $effectivePercent;
        } elseif ($definition['type'] === 'drop') {
            $bonuses['drop_percent'] += $effectivePercent;
        }
        $bonuses['breakdown'][] = [
            'inventory_id' => (int)$row['inventory_id'],
            'name' => $row['name'],
            'type' => $definition['type'],
            'raw_percent' => $rawValue,
            'effective_percent' => $effectivePercent,
        ];
    }

    return $bonuses;
}

function ecobots_try_generate_drop(PDO $pdo, int $userId, float $dropChance, int $playerLevel): ?array
{
    $dropChance = max(0.0, min(1.0, $dropChance));
    if ($dropChance <= 0) {
        return null;
    }

    $roll = mt_rand() / mt_getrandmax();
    if ($roll > $dropChance) {
        return null;
    }

    $levelRange = max(0, (int)APP_ENEMY_LEVEL_RANGE);
    $minLevel = max(1, $playerLevel - $levelRange);
    $maxLevel = max($minLevel, $playerLevel + $levelRange);

    $candidateStmt = $pdo->prepare(
        'SELECT id, kind, code, name, rarity, min_level, stackable, image_path, active'
        . ' FROM item_templates'
        . ' WHERE active = 1 AND (min_level IS NULL OR (min_level BETWEEN :min_level AND :max_level))'
    );
    $candidateStmt->execute([
        'min_level' => $minLevel,
        'max_level' => $maxLevel,
    ]);
    $candidates = $candidateStmt->fetchAll();

    if (!$candidates) {
        $fallbackStmt = $pdo->query('SELECT id, kind, code, name, rarity, min_level, stackable, image_path FROM item_templates WHERE active = 1');
        $candidates = $fallbackStmt->fetchAll();
        if (!$candidates) {
            return null;
        }
    }

    $weighted = [];
    $totalWeight = 0;
    foreach ($candidates as $row) {
        $rarity = $row['rarity'] ?? 'C';
        $weight = APP_DROP_RARITY_WEIGHTS[$rarity] ?? 1;
        if ($weight <= 0) {
            $weight = 1;
        }
        $totalWeight += $weight;
        $weighted[] = [$row, $weight];
    }

    if ($totalWeight <= 0) {
        return null;
    }

    $threshold = mt_rand(1, $totalWeight);
    $chosen = null;
    foreach ($weighted as [$row, $weight]) {
        $threshold -= $weight;
        if ($threshold <= 0) {
            $chosen = $row;
            break;
        }
    }
    if (!$chosen) {
        $chosen = $weighted[count($weighted) - 1][0];
    }

    $templateId = (int)$chosen['id'];
    $stackable = !empty($chosen['stackable']);
    $inventoryId = null;
    $quantity = 1;

    if ($stackable) {
        $existingStmt = $pdo->prepare('SELECT id, qty FROM inventory WHERE user_id = :user_id AND template_id = :template_id LIMIT 1');
        $existingStmt->execute([
            'user_id' => $userId,
            'template_id' => $templateId,
        ]);
        if ($existing = $existingStmt->fetch()) {
            $inventoryId = (int)$existing['id'];
            $quantity = (int)$existing['qty'] + 1;
            $pdo->prepare('UPDATE inventory SET qty = qty + 1 WHERE id = :id')->execute(['id' => $inventoryId]);
        }
    }

    if ($inventoryId === null) {
        $insertStmt = $pdo->prepare('INSERT INTO inventory (user_id, template_id, qty) VALUES (:user_id, :template_id, 1)');
        $insertStmt->execute([
            'user_id' => $userId,
            'template_id' => $templateId,
        ]);
        $inventoryId = (int)$pdo->lastInsertId();
    }

    return [
        'inventory_id' => $inventoryId,
        'template_id' => $templateId,
        'name' => $chosen['name'],
        'kind' => $chosen['kind'],
        'rarity' => $chosen['rarity'],
        'quantity' => $quantity,
        'image_url' => ecobots_resolve_item_icon($chosen['code'] ?? null, $chosen['kind'] ?? null, $chosen['image_path'] ?? null),
    ];
}

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

$moduleBonuses = ecobots_calculate_equipped_module_bonuses($pdo, $auth['user_id']);
$xpMultiplier = 1 + ($moduleBonuses['xp_percent'] / 100);
$finalRewardXp = (int)round((int)$run['reward_xp'] * max(1.0, $xpMultiplier));
$dropChance = APP_BASE_DROP_CHANCE + ($moduleBonuses['drop_percent'] / 100);

$updates[] = 'status = "FINISHED"';
$updates[] = 'finished_at = NOW()';
$updates[] = 'reward_xp = :reward_xp';
$params['reward_xp'] = $finalRewardXp;

$sql = 'UPDATE mission_runs SET ' . implode(', ', $updates) . ' WHERE id = :run_id';
$pdo->prepare($sql)->execute($params);

$reward = $finalRewardXp;
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

$dropReward = ecobots_try_generate_drop($pdo, $auth['user_id'], $dropChance, (int)$auth['level']);

json_response([
    'run_id' => $runId,
    'mission_id' => $missionId,
    'status' => 'FINISHED',
    'reward_xp' => $reward,
    'xp_bonus_percent' => $moduleBonuses['xp_percent'],
    'drop_chance_applied' => $dropChance,
    'drop_reward' => [
        'awarded' => $dropReward !== null,
        'item' => $dropReward,
    ],
    'module_bonus_breakdown' => $moduleBonuses['breakdown'],
]);

?>
