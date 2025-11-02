<?php
// Copy this file to smtp_config.php and fill your Private Email SMTP credentials
return [
  // Namecheap Private Email SMTP
  'host' => 'mail.privateemail.com',
  // 465 with SSL is recommended; use 'ssl' here. For 587, set 'port' => 587 and 'secure' => 'tls'.
  'port' => 465,
  'secure' => 'ssl', // 'ssl' or 'tls'
  'username' => 'no-reply@dreamexdatalab.com', // your mailbox
  'password' => 'REPLACE_WITH_STRONG_PASSWORD', // your mailbox password or app password
  'from' => 'no-reply@dreamexdatalab.com',
  'from_name' => 'Dreamex Website',
  'to' => 'info@dreamexdatalab.com'
];
