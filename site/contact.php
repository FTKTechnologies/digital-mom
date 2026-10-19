<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Referrer-Policy: no-referrer');

function reply(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['message' => $message]);
    exit;
}

session_name('dm_contact');
// Written for PHP 7.1 and up. Before 7.3 there is no SameSite session option, so it rides on the cookie path.
$sessionOptions = ['cookie_httponly' => true, 'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'use_strict_mode' => true, 'use_only_cookies' => true];
if (PHP_VERSION_ID >= 70300) $sessionOptions['cookie_samesite'] = 'Strict';
else $sessionOptions['cookie_path'] = '/; samesite=Strict';
if (!session_start($sessionOptions)) reply(503, 'The contact form is unavailable right now. Please WhatsApp us instead.');
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    if (empty($_SESSION['token']) || time() - ($_SESSION['issued'] ?? 0) > 1800) {
        $_SESSION['token'] = bin2hex(random_bytes(32));
        $_SESSION['issued'] = time();
    }
    echo json_encode(['token' => $_SESSION['token']]);
    exit;
}
if ($method !== 'POST') {
    header('Allow: GET, POST');
    reply(405, 'This request is not supported.');
}
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) reply(413, 'Your message is too long.');
foreach (['name', 'email', 'message', 'website', 'token'] as $key) {
    if (!isset($_POST[$key]) || !is_string($_POST[$key])) reply(400, 'Please check the form fields.');
}
if (empty($_SESSION['token']) || !hash_equals($_SESSION['token'], $_POST['token']) || time() - ($_SESSION['issued'] ?? 0) > 1800) {
    reply(403, 'Your form session has expired.');
}
if ($_POST['website'] !== '') reply(400, 'Your message could not be accepted. Please use WhatsApp.');
if (time() - $_SESSION['issued'] < 3) reply(429, 'Please wait a few seconds, then send your message.');
// Optional fields from the full enquiry form on /contact/. The contact dialog does not send them.
$optional = [];
foreach (['business' => 150, 'link' => 300, 'topic' => 80] as $key => $max) {
    $value = isset($_POST[$key]) && is_string($_POST[$key]) ? trim($_POST[$key]) : '';
    if (strlen($value) > $max || preg_match('/[\x00-\x1F\x7F]/', $value) || ($value !== '' && !preg_match('//u', $value))) reply(422, 'Please check the optional fields.');
    $optional[$key] = $value;
}
if ($optional['link'] !== '' && (!filter_var($optional['link'], FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $optional['link']))) reply(422, 'Please enter a full website or social link starting with https://, or leave it empty.');
$name = trim($_POST['name']);
$email = trim($_POST['email']);
$message = trim($_POST['message']);
if (strlen($name) < 2 || strlen($name) > 100 || preg_match('/[\x00-\x1F\x7F]/', $name) || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email) || strlen($message) < 10 || strlen($message) > 12000 || strpos($message, "\0") !== false) {
    reply(422, 'Please enter a valid name, email and a message of 10–3,000 characters.');
}
if (preg_match_all('/./us', $message) > 3000 || !preg_match('//u', $message) || !preg_match('//u', $name)) reply(422, 'Please check your message length and text.');

// Rate limit by direct client IP, independently of cookies. Never trust forwarded IP headers.
$rateDirectory = sys_get_temp_dir() . '/digital-mom-contact-rates';
if (!is_dir($rateDirectory) && !@mkdir($rateDirectory, 0700, true) && !is_dir($rateDirectory)) reply(503, 'The contact form is unavailable. Please use WhatsApp.');
$rateFile = $rateDirectory . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown')) . '.json';
$handle = @fopen($rateFile, 'c+');
if (!$handle || !flock($handle, LOCK_EX)) reply(503, 'The contact form is unavailable. Please use WhatsApp.');
$attempts = json_decode(stream_get_contents($handle), true);
$attempts = is_array($attempts) ? array_values(array_filter($attempts, function ($stamp) { return is_int($stamp) && $stamp > time() - 900; })) : [];
if (count($attempts) >= 5) {
    flock($handle, LOCK_UN);
    fclose($handle);
    header('Retry-After: 900');
    reply(429, 'Too many messages. Please try again later or WhatsApp us.');
}
$attempts[] = time();
rewind($handle);
ftruncate($handle, 0);
fwrite($handle, json_encode($attempts));
flock($handle, LOCK_UN);
fclose($handle);

// These addresses stay on the PHP server and are never returned to the browser.
$recipient = 'charlene@digital-mom.co.za';
$headers = ['From' => 'Digital Mom Website <website@digital-mom.co.za>', 'Reply-To' => $email, 'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8'];
$details = "Name: {$name}\nEmail: {$email}\n";
foreach (['business' => 'Business', 'topic' => 'Needs help with', 'link' => 'Website or social link'] as $key => $label) {
    if ($optional[$key] !== '') $details .= "{$label}: {$optional[$key]}\n";
}
$body = "Website enquiry\n\n{$details}\n{$message}\n";
$headerLines = '';
foreach ($headers as $header => $value) $headerLines .= "{$header}: {$value}\r\n";
if (!@mail($recipient, 'Digital Mom website enquiry', $body, rtrim($headerLines))) reply(503, 'Your message could not be sent. Please WhatsApp us instead.');
unset($_SESSION['token'], $_SESSION['issued']);
reply(200, 'Your enquiry has been submitted.');
