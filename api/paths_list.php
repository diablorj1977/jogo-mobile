<?php // File: api/paths_list.php
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/core/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

require_auth();
$pdo = get_pdo();

$missions = $pdo->query('SELECT code, name FROM missions WHERE active = 1 AND status = "PUBLISHED"')->fetchAll();

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

$paths = [];
foreach ($missions as $mission) {
    $code = path_code_from_mission($mission['code']);
    if (!isset($paths[$code])) {
        $paths[$code] = [
            'code' => $code,
            'name' => path_name_from_code($code),
        ];
    }
}

$paths = array_values($paths);
usort($paths, static fn($a, $b) => strcmp($a['code'], $b['code']));

json_response(['paths' => $paths]);

?>
