<?php
// Team preview login for maintenance mode. One shared password (set with `npm run preview-password`).
// preview-config.php is added to the upload zips by pack.mjs and never committed: it holds the password hash and the
// preview token. A correct password sets the token as a cookie, and .htaccess lets requests with that cookie through.
// Changing the password makes a new token, so every earlier pass stops working.
declare(strict_types=1);

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function back(string $to): void {
    header('Location: ' . $to, true, 303);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') back('/');
$config = is_file(__DIR__ . '/preview-config.php') ? require __DIR__ . '/preview-config.php' : null;
if (!is_array($config) || empty($config['hash']) || empty($config['token'])) back('/maintenance.html#team-preview-off');

// Only accept logins posted from this site.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originPort = parse_url($origin, PHP_URL_PORT);
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) . ($originPort ? ':' . $originPort : '') !== ($_SERVER['HTTP_HOST'] ?? '')) back('/maintenance.html');

// At most 5 wrong passwords per address every 15 minutes. Never trust forwarded IP headers.
$rateDirectory = sys_get_temp_dir() . '/digital-mom-preview-rates';
if (!is_dir($rateDirectory) && !@mkdir($rateDirectory, 0700, true) && !is_dir($rateDirectory)) back('/maintenance.html#team-preview-off');
$handle = @fopen($rateDirectory . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown')) . '.json', 'c+');
if (!$handle || !flock($handle, LOCK_EX)) back('/maintenance.html#team-preview-off');
$fails = json_decode(stream_get_contents($handle), true);
$fails = is_array($fails) ? array_values(array_filter($fails, function ($stamp) { return is_int($stamp) && $stamp > time() - 900; })) : [];
if (count($fails) >= 5) {
    flock($handle, LOCK_UN);
    fclose($handle);
    back('/maintenance.html#team-preview-wait');
}

$password = $_POST['password'] ?? '';
if (is_string($password) && strlen($password) <= 200 && password_verify($password, $config['hash'])) {
    flock($handle, LOCK_UN);
    fclose($handle);
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    header('Set-Cookie: dm_preview=' . $config['token'] . '; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax' . ($secure ? '; Secure' : ''));
    back('/');
}

$fails[] = time();
rewind($handle);
ftruncate($handle, 0);
fwrite($handle, json_encode($fails));
flock($handle, LOCK_UN);
fclose($handle);
sleep(1);
back('/maintenance.html#team-preview-wrong');
