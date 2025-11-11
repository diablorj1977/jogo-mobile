<?php // File: api/paths_progress.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

$auth = require_auth();
$pdo = get_pdo();

$missions = $pdo->query('SELECT id, code FROM missions WHERE active = 1 AND status = "PUBLISHED"')->fetchAll();
$completedStmt = $pdo->prepare('SELECT DISTINCT mission_id FROM mission_runs WHERE user_id = :user_id AND status = "FINISHED"');
$completedStmt->execute(['user_id' => $auth['user_id']]);
$completedIds = array_map('intval', array_column($completedStmt->fetchAll(), 'mission_id'));
$completedSet = array_flip($completedIds);

function path_code_from_mission(string $code): string
{
    $parts = preg_split('/[_-]+/', strtolower($code));
    foreach ($parts as $part) {
        if ($part === '' || $part === 'm') {
            continue;
        }
        return strtoupper($part);
    }
    return strtoupper($code);
}

function path_name_from_code(string $code): string
{
    $lower = strtolower($code);
    return ucwords(str_replace('_', ' ', $lower));
}

$progress = [];
foreach ($missions as $mission) {
    $pathCode = path_code_from_mission($mission['code']);
    if (!isset($progress[$pathCode])) {
        $progress[$pathCode] = [
            'code' => $pathCode,
            'name' => path_name_from_code($pathCode),
            'total' => 0,
            'completed' => 0,
        ];
    }
    $progress[$pathCode]['total']++;
    if (isset($completedSet[$mission['id']])) {
        $progress[$pathCode]['completed']++;
    }
}

$progress = array_values($progress);
usort($progress, static fn($a, $b) => strcmp($a['code'], $b['code']));

json_response(['paths' => $progress]);

?>
