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
foreach (['business' => 150, 'link' => 300, 'phone' => 30] as $key => $max) {
    $value = isset($_POST[$key]) && is_string($_POST[$key]) ? trim($_POST[$key]) : '';
    if (strlen($value) > $max || preg_match('/[\x00-\x1F\x7F]/', $value) || ($value !== '' && !preg_match('//u', $value))) reply(422, 'Please check the optional fields.');
    $optional[$key] = $value;
}
if ($optional['link'] !== '' && (!filter_var($optional['link'], FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $optional['link']))) reply(422, 'Please enter a full website or social link starting with https://, or leave it empty.');
if ($optional['phone'] !== '' && !preg_match('/^\+?[0-9 ()-]{7,30}$/', $optional['phone'])) reply(422, 'Please enter a WhatsApp number using digits only, or leave it empty.');

// Service questions (built from src/enquiry.json). The form can send several services (topic[]). Only the ticked
// services' answers count, and only listed options. "Not sure yet" (unsure) cannot be combined with a service.
$sets = is_file(__DIR__ . '/enquiry-fields.php') ? require __DIR__ . '/enquiry-fields.php' : [];
$topics = isset($_POST['topic']) ? $_POST['topic'] : [];
if (is_string($topics)) $topics = $topics === '' ? [] : [$topics];
if (!is_array($topics) || count($topics) > 10) reply(422, 'Please choose what we can help with.');
foreach ($topics as $topic) if (!is_string($topic)) reply(422, 'Please choose what we can help with.');
$topics = array_values(array_unique($topics));
$unsure = in_array('unsure', $topics, true);
$chosen = [];
foreach (is_array($sets) ? $sets : [] as $candidate) if (in_array($candidate['key'], $topics, true)) $chosen[] = $candidate;
if (count($chosen) + ($unsure ? 1 : 0) !== count($topics) || ($unsure && count($chosen) > 0)) reply(422, 'Please choose what we can help with.');
$answers = '';
$answerList = [];
foreach ($chosen as $set) {
    $given = isset($_POST['q'][$set['key']]) && is_array($_POST['q'][$set['key']]) ? $_POST['q'][$set['key']] : [];
    $section = '';
    foreach ($set['fields'] as $field) {
        $value = isset($given[$field['name']]) ? $given[$field['name']] : null;
        if ($value === null || $value === '' || $value === []) continue;
        if ($field['type'] === 'checkbox') {
            if (!is_array($value) || count($value) > count($field['options'])) reply(422, 'Please check your answers.');
            foreach ($value as $item) if (!is_string($item) || !in_array($item, $field['options'], true)) reply(422, 'Please check your answers.');
            $value = implode(', ', array_unique($value));
        } elseif ($field['type'] === 'radio') {
            if (!is_string($value) || !in_array($value, $field['options'], true)) reply(422, 'Please check your answers.');
        } else {
            if (!is_string($value) || strlen(trim($value)) > 200 || preg_match('/[\x00-\x1F\x7F]/', $value) || !preg_match('//u', $value)) reply(422, 'Please keep short answers under 200 characters.');
            $value = trim($value);
        }
        $section .= "- {$field['label']}: {$value}\n";
        // With several services the Sheet and brief Doc need to know which service an answer belongs to.
        $answerList[] = ['label' => count($chosen) > 1 ? "{$set['label']}: {$field['label']}" : $field['label'], 'value' => $value];
    }
    if ($section !== '') $answers .= ($answers !== '' ? "\n" : '') . "{$set['label']} answers\n{$section}";
}
$topicLabel = $unsure ? 'Not sure yet' : implode(', ', array_map(function ($set) { return $set['label']; }, $chosen));
$picked = count($chosen) > 0;

$name = trim($_POST['name']);
$email = trim($_POST['email']);
$message = trim($_POST['message']);
$minimum = $picked ? 0 : 10; // with a service picked, the questions carry the brief and the message is optional
if (strlen($name) < 2 || strlen($name) > 100 || preg_match('/[\x00-\x1F\x7F]/', $name) || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email) || strlen($message) < $minimum || strlen($message) > 12000 || strpos($message, "\0") !== false) {
    reply(422, $minimum ? 'Please enter a valid name, email and a message of 10–3,000 characters.' : 'Please enter a valid name and email.');
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
$recipient = 'info@digital-mom.co.za';
$headers = ['From' => 'Digital Mom Website <website@digital-mom.co.za>', 'Reply-To' => $email, 'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8'];
$details = "Name: {$name}\nEmail: {$email}\n";
foreach (['business' => 'Business', 'phone' => 'WhatsApp', 'link' => 'Website or social link'] as $key => $label) {
    if ($optional[$key] !== '') $details .= "{$label}: {$optional[$key]}\n";
}
if ($topicLabel !== '') $details .= "Needs help with: {$topicLabel}\n";
if ($answers !== '') $details .= "
{$answers}";
// Google Sheet (digitalmomseo account, see google/enquiries.gs): the enquiry becomes a row and a brief Doc. The script
// can only add, never read, so a compromised server cannot reach the sheet. sheet-config.php is added to the upload zip
// by pack.mjs and never committed. If Google is slow or down, the email below still goes out without the link.
$brief = '';
$sheet = is_file(__DIR__ . '/sheet-config.php') ? require __DIR__ . '/sheet-config.php' : null;
if (is_array($sheet) && !empty($sheet['url']) && !empty($sheet['key']) && function_exists('curl_init')) {
    $curl = curl_init($sheet['url']);
    curl_setopt_array($curl, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 10, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['key' => $sheet['key'], 'name' => $name, 'business' => $optional['business'], 'email' => $email,
            'phone' => $optional['phone'], 'link' => $optional['link'], 'service' => $topicLabel, 'answers' => $answerList, 'message' => $message]),
    ]);
    $result = json_decode((string)curl_exec($curl), true);
    curl_close($curl);
    if (is_array($result) && !empty($result['ok']) && is_string($result['brief'] ?? null) && preg_match('#^https://docs\.google\.com/\S+$#', $result['brief'])) $brief = $result['brief'];
}

$body = "Website enquiry\n\n{$details}\n" . ($message !== '' ? "Message:\n{$message}\n" : "(No extra message.)\n")
    . ($brief !== '' ? "\nClient brief: {$brief}\n" : '');
$headerLines = '';
foreach ($headers as $header => $value) $headerLines .= "{$header}: {$value}\r\n";
$sent = @mail($recipient, 'Digital Mom website enquiry' . ($topicLabel !== '' ? ": {$topicLabel}" : ''), $body, rtrim($headerLines));
if (!$sent && $brief === '') reply(503, 'Your message could not be sent. Please WhatsApp us instead.');
unset($_SESSION['token'], $_SESSION['issued']);
reply(200, 'Your enquiry has been submitted.');
