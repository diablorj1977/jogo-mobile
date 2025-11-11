<?php // File: api/core/geo.php
require_once __DIR__ . '/../init_config.php';

function haversine_distance(float $latFrom, float $lonFrom, float $latTo, float $lonTo): float
{
    $earthRadius = 6371000; // meters
    $latFrom = deg2rad($latFrom);
    $lonFrom = deg2rad($lonFrom);
    $latTo = deg2rad($latTo);
    $lonTo = deg2rad($lonTo);

    $latDelta = $latTo - $latFrom;
    $lonDelta = $lonTo - $lonFrom;

    $a = sin($latDelta / 2) ** 2 + cos($latFrom) * cos($latTo) * sin($lonDelta / 2) ** 2;
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

    return $earthRadius * $c;
}

function validate_coordinates($lat, $lng): bool
{
    if (!is_numeric($lat) || !is_numeric($lng)) {
        return false;
    }
    $lat = (float)$lat;
    $lng = (float)$lng;
    return $lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180;
}

?>
