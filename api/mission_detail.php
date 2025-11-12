<?php // File: api/mission_detail.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/geo.php';
require_once __DIR__ . '/core/rules.php';
require_once __DIR__ . '/init_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$missionId = (int)($_GET['mission_id'] ?? 0);
if ($missionId <= 0) {
    error_response('Missão inválida');
}

$lat = $_GET['lat'] ?? null;
$lng = $_GET['lng'] ?? null;
$runId = isset($_GET['run_id']) ? (int)$_GET['run_id'] : null;

$pdo = get_pdo();

$missionStmt = $pdo->prepare(
    'SELECT id, code, tipo, modo, name, description, image_path, lat, lng, dest_lat, dest_lng, dest_raio_m,
            time_limit_s, raio_m, nivel_min, janela_start, janela_end, req_carcacas, reward_xp, recovery_min,
            qr_hint
     FROM missions
     WHERE id = :id AND active = 1 AND status = "PUBLISHED"'
);
$missionStmt->execute(['id' => $missionId]);
$mission = $missionStmt->fetch();
if (!$mission) {
    error_response('Missão não encontrada', 404);
}

$carcassStmt = $pdo->prepare(
    'SELECT it.code
     FROM equipped_items ei
     INNER JOIN inventory inv ON inv.id = ei.inventory_id AND inv.user_id = :user_id
     INNER JOIN item_templates it ON it.id = inv.template_id
     WHERE ei.user_id = :user_id AND ei.slot = "carcass"
     LIMIT 1'
);
$carcassStmt->execute(['user_id' => $auth['user_id']]);
$carcassRow = $carcassStmt->fetch();
$equippedCarcass = $carcassRow['code'] ?? null;

$ecobotStmt = $pdo->prepare('SELECT down_until FROM ecobots WHERE user_id = :user_id LIMIT 1');
$ecobotStmt->execute(['user_id' => $auth['user_id']]);
$ecobot = $ecobotStmt->fetch();

$requiredCarcasses = array_values(array_filter(array_map('trim', explode(',', $mission['req_carcacas'] ?? ''))));
$withinWindow = mission_within_window($mission);
$levelOk = empty($mission['nivel_min']) || (int)$mission['nivel_min'] <= (int)$auth['level'];
$carcassOk = mission_requires_carcass($mission, $equippedCarcass);
$ecobotOk = true;
if ($ecobot && !empty($ecobot['down_until'])) {
    $ecobotOk = strtotime($ecobot['down_until']) <= time();
}

$distance = null;
$withinStartRadius = null;
if (validate_coordinates($lat, $lng)) {
    $distance = haversine_distance((float)$lat, (float)$lng, (float)$mission['lat'], (float)$mission['lng']);
    $withinStartRadius = $distance <= APP_MISSION_START_RADIUS_M;
}

$canStart = ($withinWindow && $levelOk && $carcassOk && $ecobotOk);
if ($withinStartRadius !== null) {
    $canStart = $canStart && $withinStartRadius;
} else {
    $canStart = false;
}

$missionData = [
    'id' => (int)$mission['id'],
    'code' => $mission['code'],
    'tipo' => $mission['tipo'],
    'modo' => $mission['modo'],
    'name' => $mission['name'],
    'description' => $mission['description'],
    'lat' => (float)$mission['lat'],
    'lng' => (float)$mission['lng'],
    'dest_lat' => $mission['dest_lat'] !== null ? (float)$mission['dest_lat'] : null,
    'dest_lng' => $mission['dest_lng'] !== null ? (float)$mission['dest_lng'] : null,
    'dest_raio_m' => $mission['dest_raio_m'] !== null ? (int)$mission['dest_raio_m'] : null,
    'time_limit_s' => $mission['time_limit_s'] !== null ? (int)$mission['time_limit_s'] : null,
    'raio_m' => (int)$mission['raio_m'],
    'nivel_min' => $mission['nivel_min'] !== null ? (int)$mission['nivel_min'] : null,
    'reward_xp' => (int)$mission['reward_xp'],
    'recovery_min' => (int)$mission['recovery_min'],
    'image_url' => ecobots_resolve_mission_image($mission['image_path']),
    'icon_url' => ecobots_resolve_mission_icon($mission['tipo'], $mission['image_path'] ?? null),
    'qr_hint' => $mission['qr_hint'],
];

$typeData = [];
$pointsStmt = $pdo->prepare('SELECT seq, lat, lng, raio_m FROM mission_points WHERE mission_id = :mission_id ORDER BY seq');
$pointsStmt->execute(['mission_id' => $missionId]);
$points = [];
foreach ($pointsStmt->fetchAll() as $pointRow) {
    $points[] = [
        'seq' => (int)$pointRow['seq'],
        'lat' => (float)$pointRow['lat'],
        'lng' => (float)$pointRow['lng'],
        'raio_m' => (int)$pointRow['raio_m'],
    ];
}
if ($points) {
    $typeData['points'] = $points;
}

if (strtoupper($mission['tipo']) === 'FOTO') {
    $photoStmt = $pdo->prepare(
        'SELECT proof_photo, finished_at
         FROM mission_runs
         WHERE mission_id = :mission_id AND proof_photo IS NOT NULL AND photo_hidden = 0
         ORDER BY finished_at DESC
         LIMIT 20'
    );
    $photoStmt->execute(['mission_id' => $missionId]);
    $mural = [];
    foreach ($photoStmt->fetchAll() as $photoRow) {
        $url = $photoRow['proof_photo'];
        if ($url && !preg_match('/^(https?:)?\/\//i', $url) && !str_starts_with($url, 'data:')) {
            $url = rtrim(APP_UPLOAD_URL, '/') . '/' . ltrim($url, '/');
        }
        $mural[] = [
            'url' => $url,
            'finished_at' => $photoRow['finished_at'],
        ];
    }
    $typeData['photo_mural'] = $mural;
}

if (in_array(strtoupper($mission['tipo']), ['CORRIDA', 'P2P', 'P2P_GRUPO'], true)) {
    $typeData['points'] = $typeData['points'] ?? $points;
}

if (strtoupper($mission['tipo']) === 'SCAN') {
    $typeData['qr_hint'] = $mission['qr_hint'];
}

if (strtoupper($mission['tipo']) === 'BATALHA') {
    $battleStateJson = null;
    if ($runId) {
        $battleStmt = $pdo->prepare('SELECT state_json FROM battles WHERE mission_run_id = :run_id ORDER BY id DESC LIMIT 1');
        $battleStmt->execute(['run_id' => $runId]);
        $battleRow = $battleStmt->fetch();
        if ($battleRow && !empty($battleRow['state_json'])) {
            $battleStateJson = $battleRow['state_json'];
        }
    }
    if ($battleStateJson === null) {
        $fallbackStmt = $pdo->prepare('SELECT state_json FROM battles WHERE user_id = :user_id AND source = "MISSION" AND source_id = :mission_id ORDER BY id DESC LIMIT 1');
        $fallbackStmt->execute([
            'user_id' => $auth['user_id'],
            'mission_id' => $missionId,
        ]);
        $fallbackRow = $fallbackStmt->fetch();
        if ($fallbackRow && !empty($fallbackRow['state_json'])) {
            $battleStateJson = $fallbackRow['state_json'];
        }
    }

    if ($battleStateJson !== null) {
        $state = json_decode($battleStateJson, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($state)) {
            $enemy = $state['enemy'] ?? [];
            $enemyMoves = [];
            if (!empty($enemy['moves']) && is_array($enemy['moves'])) {
                foreach ($enemy['moves'] as $move) {
                    if (!is_array($move)) {
                        continue;
                    }
                    $enemyMoves[] = [
                        'name' => $move['name'] ?? 'Ataque',
                        'dmg_min' => isset($move['min']) ? (int)$move['min'] : (isset($move['dmg_min']) ? (int)$move['dmg_min'] : 0),
                        'dmg_max' => isset($move['max']) ? (int)$move['max'] : (isset($move['dmg_max']) ? (int)$move['dmg_max'] : 0),
                        'dmg_type' => $move['type'] ?? ($move['dmg_type'] ?? null),
                        'accuracy' => isset($move['acc']) ? (int)$move['acc'] : (isset($move['accuracy']) ? (int)$move['accuracy'] : 85),
                        'weight' => isset($move['w']) ? (int)$move['w'] : (isset($move['weight']) ? (int)$move['weight'] : 1),
                    ];
                }
            }

            $playerState = $state['player'] ?? [];

            $typeData['battle'] = [
                'enemy' => [
                    'name' => $enemy['name'] ?? null,
                    'level' => isset($enemy['level']) ? (int)$enemy['level'] : null,
                    'hp_max' => isset($enemy['hp_max']) ? (int)$enemy['hp_max'] : (isset($enemy['hp']) ? (int)$enemy['hp'] : 0),
                    'hp_current' => isset($enemy['hp']) ? (int)$enemy['hp'] : (isset($enemy['hp_max']) ? (int)$enemy['hp_max'] : 0),
                    'moves' => $enemyMoves,
                    'reward_xp' => isset($enemy['reward_xp']) ? (int)$enemy['reward_xp'] : null,
                ],
                'player' => [
                    'name' => $playerState['name'] ?? null,
                    'level' => isset($playerState['level']) ? (int)$playerState['level'] : null,
                    'hp_max' => isset($playerState['hp_max']) ? (int)$playerState['hp_max'] : null,
                    'hp_current' => isset($playerState['hp']) ? (int)$playerState['hp'] : null,
                ],
            ];
        }
    }
}

$runData = null;
$reachedPoints = [];
if ($runId) {
    $runStmt = $pdo->prepare(
        'SELECT id, mission_id, status, started_at, start_lat, start_lng, reward_xp, proof_photo, proof_code
         FROM mission_runs
         WHERE id = :run_id AND user_id = :user_id'
    );
    $runStmt->execute([
        'run_id' => $runId,
        'user_id' => $auth['user_id'],
    ]);
    $run = $runStmt->fetch();
    if (!$run || (int)$run['mission_id'] !== $missionId) {
        error_response('Execução não encontrada', 404);
    }
    $runData = [
        'id' => (int)$run['id'],
        'status' => $run['status'],
        'started_at' => $run['started_at'],
        'start_lat' => $run['start_lat'] !== null ? (float)$run['start_lat'] : null,
        'start_lng' => $run['start_lng'] !== null ? (float)$run['start_lng'] : null,
        'reward_xp' => (int)$run['reward_xp'],
        'proof_photo' => $run['proof_photo'] ?? null,
        'proof_code' => $run['proof_code'] ?? null,
    ];

    if (!empty($typeData['points'])) {
        $touchStmt = $pdo->prepare('SELECT point_seq, reached_at FROM mission_run_points WHERE run_id = :run_id ORDER BY point_seq');
        $touchStmt->execute(['run_id' => $runId]);
        foreach ($touchStmt->fetchAll() as $touch) {
            $reachedPoints[] = [
                'seq' => (int)$touch['point_seq'],
                'reached_at' => $touch['reached_at'],
            ];
        }
    }
}

$checks = [
    'level' => [
        'required' => $missionData['nivel_min'],
        'met' => $levelOk,
    ],
    'carcass' => [
        'required_codes' => $requiredCarcasses,
        'equipped' => $equippedCarcass,
        'met' => $carcassOk,
    ],
    'window' => [
        'active' => $withinWindow,
        'start' => $mission['janela_start'],
        'end' => $mission['janela_end'],
    ],
    'distance' => [
        'value_m' => $distance,
        'limit_m' => APP_MISSION_START_RADIUS_M,
        'met' => $withinStartRadius === null ? false : $withinStartRadius,
    ],
    'ecobot' => [
        'down_until' => $ecobot['down_until'] ?? null,
        'met' => $ecobotOk,
    ],
];

$response = [
    'mission' => $missionData,
    'player' => [
        'level' => (int)$auth['level'],
        'xp' => (int)$auth['xp'],
        'equipped_carcass' => $equippedCarcass,
    ],
    'requirements' => $checks,
    'required_carcasses' => $requiredCarcasses,
    'distance_m' => $distance,
    'within_start_radius' => $withinStartRadius,
    'can_start' => $canStart,
    'type_data' => $typeData,
    'run' => $runData,
    'reached_points' => $reachedPoints,
    'start_radius_m' => APP_MISSION_START_RADIUS_M,
];

json_response($response);

?>
