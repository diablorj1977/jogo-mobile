<?php
require_once __DIR__ . '/../init_config.php';

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: ' . APP_ALLOWED_ORIGIN);
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function error_response(string $message, int $status = 400): void
{
    json_response(['error' => $message], $status);
}

function require_post_json(): array
{
    $payload = file_get_contents('php://input');
    $data = json_decode($payload, true);
    if (!is_array($data)) {
        error_response('Invalid JSON body', 400);
    }
    return $data;
}

?>
