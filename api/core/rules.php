<?php
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/geo.php';
require_once __DIR__ . '/../init_config.php';

function ensure_ecobot_active(?array $ecobotRow): void
{
    if (!$ecobotRow) {
        return;
    }
    if (!empty($ecobotRow['down_until']) && strtotime($ecobotRow['down_until']) > time()) {
        error_response('Ecobot em manutenção até ' . $ecobotRow['down_until'], 409);
    }
}

function mission_within_window(array $mission): bool
{
    if (empty($mission['janela_start']) || empty($mission['janela_end'])) {
        return true;
    }
    $now = new DateTimeImmutable('now', new DateTimeZone(APP_TIMEZONE));
    $start = new DateTimeImmutable($mission['janela_start']);
    $end = new DateTimeImmutable($mission['janela_end']);
    return $now >= $start && $now <= $end;
}

function mission_requires_carcass(array $mission, ?string $equippedCarcassCode): bool
{
    if (empty($mission['req_carcacas'])) {
        return true;
    }
    $required = array_filter(array_map('trim', explode(',', $mission['req_carcacas'])));
    if (!$required) {
        return true;
    }
    if (!$equippedCarcassCode) {
        return false;
    }
    return in_array($equippedCarcassCode, $required, true);
}

function apply_recovery_minutes(?string $downUntil, int $recoveryMinutes): ?string
{
    if (empty($downUntil) || $recoveryMinutes <= 0) {
        return $downUntil;
    }
    $current = new DateTimeImmutable($downUntil);
    $newTime = $current->sub(new DateInterval('PT' . $recoveryMinutes . 'M'));
    if ($newTime <= new DateTimeImmutable('now')) {
        return null;
    }
    return $newTime->format('Y-m-d H:i:s');
}

?>
