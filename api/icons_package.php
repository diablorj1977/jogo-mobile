<?php // File: api/icons_package.php
require_once __DIR__ . '/core/response.php';
require_once __DIR__ . '/init_config.php';

if (!function_exists('ecobots_normalise_icon_name')) {
    function ecobots_normalise_icon_name($name)
    {
        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtoupper($name ?? 'icon'));
        $slug = trim($slug, '-');
        return strtolower($slug !== '' ? $slug : 'icon');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . APP_ALLOWED_ORIGIN);
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_response('Method not allowed', 405);
}

if (!class_exists('ZipArchive')) {
    error_response('ZipArchive extension is required to generate the icon bundle', 500);
}
$tempFile = tempnam(sys_get_temp_dir(), 'ecobots_icons_');
$zip = new ZipArchive();

if ($zip->open($tempFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    error_response('Unable to create zip archive', 500);
}

$missionSvgs = APP_MISSION_ICON_SVGS;
foreach ($missionSvgs as $type => $svg) {
    $zip->addFromString('missions/' . ecobots_normalise_icon_name($type) . '.svg', $svg);
}

$itemCodeSvgs = APP_ITEM_ICON_SVGS;
foreach ($itemCodeSvgs as $code => $svg) {
    $zip->addFromString('items/' . ecobots_normalise_icon_name($code) . '.svg', $svg);
}

$itemKindSvgs = APP_ITEM_KIND_ICON_SVGS;
foreach ($itemKindSvgs as $kind => $svg) {
    $zip->addFromString('items/kind-' . ecobots_normalise_icon_name($kind) . '.svg', $svg);
}

$zip->close();

if (!file_exists($tempFile)) {
    error_response('Failed to assemble icon archive', 500);
}

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="mission_item_icons.zip"');
header('Content-Length: ' . filesize($tempFile));
header('Access-Control-Allow-Origin: ' . APP_ALLOWED_ORIGIN);
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');

readfile($tempFile);
@unlink($tempFile);
exit;
