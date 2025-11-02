<?php
// JSON API to send contact emails via Private Email (Namecheap) SMTP
// Hardened to always emit JSON and capture PHP warnings/fatal errors
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// Ensure no stray output corrupts JSON
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', '0');

$fatalJsonResponder = function($status, $message){
  // Clear any buffered output and return JSON error
  while (ob_get_level() > 0) { ob_end_clean(); }
  http_response_code($status);
  echo json_encode(['success' => false, 'error' => $message]);
  exit;
};

set_exception_handler(function($e) use ($fatalJsonResponder) {
  $fatalJsonResponder(500, 'Unexpected error: ' . $e->getMessage());
});

set_error_handler(function($severity, $message, $file, $line) use ($fatalJsonResponder) {
  // Convert all PHP errors to JSON responses
  $fatalJsonResponder(500, "PHP error ($severity) at $file:$line — $message");
});

register_shutdown_function(function() use ($fatalJsonResponder) {
  $err = error_get_last();
  if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
    $fatalJsonResponder(500, 'Fatal error: ' . $err['message']);
  }
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Lightweight health check (GET)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo json_encode(['success' => true, 'message' => 'send-contact.php is reachable']);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit;
}

$raw = file_get_contents('php://input');
$ct = isset($_SERVER['CONTENT_TYPE']) ? strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'])[0])) : '';
$data = null;
if ($ct === 'application/json') {
  $data = json_decode($raw, true);
} else if (!empty($_POST)) {
  // Support application/x-www-form-urlencoded or multipart/form-data
  $data = [
    'name' => $_POST['name'] ?? '',
    'email' => $_POST['email'] ?? '',
    'company' => $_POST['company'] ?? '',
    'message' => $_POST['message'] ?? '',
  ];
}
if (!$data || !is_array($data)) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Invalid payload']);
  exit;
}

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$company = trim($data['company'] ?? '');
$message = trim($data['message'] ?? '');

if ($name === '' || $email === '' || $message === '') {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Please include your name, email, and message.']);
  exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Invalid email address']);
  exit;
}

// Load SMTP config (not committed); fall back to environment variables
$config = [
  'host' => getenv('SMTP_HOST') ?: 'mail.privateemail.com',
  'port' => intval(getenv('SMTP_PORT') ?: '465'),
  'secure' => getenv('SMTP_SECURE') ?: 'ssl', // ssl (465) or tls (587)
  'username' => getenv('SMTP_USERNAME') ?: '',
  'password' => getenv('SMTP_PASSWORD') ?: '',
  'from' => getenv('SMTP_FROM') ?: 'info@dreamexdatalab.com',
  'from_name' => getenv('SMTP_FROM_NAME') ?: 'Dreamex Website',
  'to' => 'info@dreamexdatalab.com'
];
if (file_exists(__DIR__ . '/smtp_config.php')) {
  $fileCfg = include __DIR__ . '/smtp_config.php';
  if (is_array($fileCfg)) {
    $config = array_merge($config, $fileCfg);
  }
}

if (!$config['username'] || !$config['password']) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'SMTP credentials not configured. Create smtp_config.php from smtp_config.sample.php and fill username/password.']);
  exit;
}

$subject = 'New Demo Request from Dreamex Website';
$body = "You have received a new request from the website.\r\n\r\n" .
        "Name: {$name}\r\n" .
        "Email: {$email}\r\n" .
        "Company: {$company}\r\n\r\n" .
        "Message:\r\n{$message}\r\n";

try {
  $result = smtp_send(
    $config['host'],
    $config['port'],
    $config['secure'],
    $config['username'],
    $config['password'],
    $config['from'],
    $config['from_name'],
    $config['to'],
    $subject,
    $body,
    $email // reply-to
  );

  // Flush any prior buffered output before final JSON
  while (ob_get_level() > 0) { ob_end_clean(); }

  if ($result === true) {
    echo json_encode(['success' => true]);
  } else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'SMTP send failed: ' . $result]);
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Unexpected error: ' . $e->getMessage()]);
}

// Minimal SMTP client (implicit SSL on 465 or STARTTLS on 587 when secure=tls)
function smtp_send($host, $port, $secure, $username, $password, $from, $fromName, $to, $subject, $body, $replyTo = '') {
  if (!$host || !$username || !$password) {
    return 'SMTP credentials not configured';
  }

  $remote = ($secure === 'ssl') ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
  $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
  if (!$fp) return "Connection failed: $errstr ($errno)";
  stream_set_timeout($fp, 15);

  $read = fn() => fgets($fp, 515);
  $send = function($cmd) use ($fp) { fwrite($fp, $cmd . "\r\n"); };
  $expect = function($code) use (&$read) {
    $line = '';
    do {
      $line = $read();
      if ($line === false) return [false, 'Read failed'];
      $cont = isset($line[3]) && $line[3] === '-';
    } while ($cont);
    return [substr($line,0,3) == (string)$code, trim($line)];
  };

  // Greet
  [$ok, $resp] = $expect(220); if(!$ok) return 'Greeting: ' . $resp;
  $send('EHLO dreamexdatalab.com');
  [$ok, $resp] = $expect(250); if(!$ok) return 'EHLO: ' . $resp;

  if ($secure === 'tls') {
    $send('STARTTLS');
    [$ok, $resp] = $expect(220); if(!$ok) return 'STARTTLS: ' . $resp;
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      return 'TLS handshake failed';
    }
    // Re-issue EHLO after STARTTLS
    $send('EHLO dreamexdatalab.com');
    [$ok, $resp] = $expect(250); if(!$ok) return 'EHLO (after TLS): ' . $resp;
  }

  // AUTH LOGIN
  $send('AUTH LOGIN');
  [$ok, $resp] = $expect(334); if(!$ok) return 'AUTH LOGIN: ' . $resp;
  $send(base64_encode($username));
  [$ok, $resp] = $expect(334); if(!$ok) return 'Username rejected: ' . $resp;
  $send(base64_encode($password));
  [$ok, $resp] = $expect(235); if(!$ok) return 'Password rejected: ' . $resp;

  // MAIL FROM / RCPT TO
  $send('MAIL FROM: <' . $from . '>');
  [$ok, $resp] = $expect(250); if(!$ok) return 'MAIL FROM: ' . $resp;
  $send('RCPT TO: <' . $to . '>');
  [$ok, $resp] = $expect(250); if(!$ok) return 'RCPT TO: ' . $resp;

  // DATA
  $send('DATA');
  [$ok, $resp] = $expect(354); if(!$ok) return 'DATA: ' . $resp;

  $headers = [];
  $headers[] = 'From: ' . encode_header($fromName) . ' <' . $from . '>';
  $headers[] = 'To: <' . $to . '>';
  $headers[] = 'Subject: ' . encode_header($subject);
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-Type: text/plain; charset=UTF-8';
  if ($replyTo) $headers[] = 'Reply-To: ' . $replyTo;

  $data = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.";
  $send($data);
  [$ok, $resp] = $expect(250); if(!$ok) return 'Message body: ' . $resp;

  $send('QUIT');
  fclose($fp);
  return true;
}

function encode_header($str) {
  // Encode UTF-8 headers per RFC 2047
  if (preg_match('/[\x80-\xFF]/', $str)) {
    return '=?UTF-8?B?' . base64_encode($str) . '?=';
  }
  return $str;
}
?>
