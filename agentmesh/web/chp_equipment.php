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
$fields = ['maker','model','country','jp_distributor','kwe','elec_efficiency','gen_type',
    'fuel_type','moisture_spec','chip_size_spec','japan_installs','contact','website',
    'domestic_maker','source','notes'];

if ($method === 'GET') {
    $rows = $pdo->query("SELECT * FROM chp_equipment ORDER BY domestic_maker DESC, kwe, maker")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['rows' => $rows]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

function bindEquipment($stmt, $fields, $input) {
    foreach ($fields as $f) {
        if ($f === 'domestic_maker') {
            $stmt->bindValue(':' . $f, !empty($input[$f]), PDO::PARAM_BOOL);
        } else {
            $stmt->bindValue(':' . $f, $input[$f] ?? '');
        }
    }
}

if ($method === 'POST') {
    $cols = implode(',', $fields);
    $params = array_map(fn($f) => ':' . $f, $fields);
    $sql = "INSERT INTO chp_equipment ($cols) VALUES (" . implode(',', $params) . ") RETURNING id";
    $stmt = $pdo->prepare($sql);
    bindEquipment($stmt, $fields, $input);
    $stmt->execute();
    echo json_encode(['id' => $stmt->fetchColumn()]);
    exit;
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'missing id']); exit; }
    $set = implode(',', array_map(fn($f) => "$f = :$f", $fields));
    $sql = "UPDATE chp_equipment SET $set, updated_at = now() WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    bindEquipment($stmt, $fields, $input);
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode(['ok' => true, 'affected' => $stmt->rowCount()]);
    exit;
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'missing id']); exit; }
    $stmt = $pdo->prepare("DELETE FROM chp_equipment WHERE id = :id");
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode(['ok' => true, 'affected' => $stmt->rowCount()]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
