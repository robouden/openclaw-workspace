<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dsn = 'pgsql:host=127.0.0.1;port=5433;dbname=agentmesh';
$user = 'agentmesh';
// Password lives in config.local.php (gitignored, present only on this server), not in this file.
$localConfig = __DIR__ . '/config.local.php';
if (!file_exists($localConfig)) {
    http_response_code(500);
    echo json_encode(['error' => 'config.local.php missing — see infra/people_register/config.local.php.example']);
    exit;
}
require $localConfig;

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$fields = ['sent_date','contact','channel','subject','status','doc_path','note','due_date'];

if ($method === 'GET') {
    $rows = $pdo->query("SELECT * FROM outreach ORDER BY sent_date DESC, id DESC")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['rows' => $rows]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

if ($method === 'POST') {
    $cols = implode(',', $fields);
    $params = array_map(fn($f) => ':' . $f, $fields);
    $sql = "INSERT INTO outreach ($cols) VALUES (" . implode(',', $params) . ") RETURNING id";
    $stmt = $pdo->prepare($sql);
    foreach ($fields as $f) $stmt->bindValue(':' . $f, $input[$f] ?? '');
    $stmt->execute();
    echo json_encode(['id' => $stmt->fetchColumn()]);
    exit;
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'missing id']); exit; }
    $set = implode(',', array_map(fn($f) => "$f = :$f", $fields));
    $sql = "UPDATE outreach SET $set, updated_at = now() WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    foreach ($fields as $f) $stmt->bindValue(':' . $f, $input[$f] ?? '');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode(['ok' => true, 'affected' => $stmt->rowCount()]);
    exit;
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'missing id']); exit; }
    $stmt = $pdo->prepare("DELETE FROM outreach WHERE id = :id");
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode(['ok' => true, 'affected' => $stmt->rowCount()]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
