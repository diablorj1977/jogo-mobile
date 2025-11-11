<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/../init_config.php';

function get_auth_header_token(): ?string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $header = $headers['Authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    if (!$header) {
        return null;
    }
    if (stripos($header, 'Bearer ') === 0) {
        return trim(substr($header, 7));
    }
    return null;
}

function require_auth(): array
{
    $token = get_auth_header_token();
    if (!$token) {
        error_response('Missing bearer token', 401);
    }

    $pdo = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT at.user_id, at.expires_at, u.email, u.level, u.xp, u.nickname,
                prefs.mission_radius_km
         FROM auth_tokens at
         INNER JOIN users u ON u.id = at.user_id
         LEFT JOIN user_prefs prefs ON prefs.user_id = u.id
         WHERE at.token = :token
         LIMIT 1'
    );
    $stmt->execute(['token' => $token]);
    $auth = $stmt->fetch();
    if (!$auth) {
        error_response('Invalid token', 401);
    }

    if (!empty($auth['expires_at']) && strtotime($auth['expires_at']) <= time()) {
        error_response('Token expired', 401);
    }

    $auth['user_id'] = (int)$auth['user_id'];
    $auth['level'] = isset($auth['level']) ? (int)$auth['level'] : 1;
    $auth['xp'] = isset($auth['xp']) ? (int)$auth['xp'] : 0;
    $auth['mission_radius_km'] = isset($auth['mission_radius_km'])
        ? (int)$auth['mission_radius_km']
        : APP_DEFAULT_GEOFENCE_KM;

    return $auth;
}

?>
