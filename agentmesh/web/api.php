<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dsn = 'pgsql:host=127.0.0.1;port=5433;dbname=agentmesh';
$user = 'agentmesh';
$pass = '79026ae8b867275744bd128b2c5d27c7';

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

$q     = trim($_GET['q']      ?? '');
$agent = trim($_GET['agent']  ?? '');
$limit = min((int)($_GET['limit']  ?? 200), 1000);
$offset = max((int)($_GET['offset'] ?? 0), 0);

$where  = [];
$params = [];

if ($q !== '') {
    $where[]       = "m.content ILIKE :q";
    $params[':q']  = '%' . $q . '%';
}
if ($agent !== '' && $agent !== 'all') {
    $where[]          = "m.agent = :agent";
    $params[':agent'] = $agent;
}

$whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "
    SELECT
        m.id,
        m.created_at,
        m.agent,
        m.role,
        LEFT(m.content, 400) AS content_preview,
        t.title  AS thread_title,
        t.slug   AS thread_slug
    FROM messages m
    LEFT JOIN threads t ON t.id = m.thread_id
    $whereSQL
    ORDER BY m.created_at DESC
    LIMIT :limit OFFSET :offset
";

$countSQL = "SELECT COUNT(*) FROM messages m $whereSQL";

$stmt = $pdo->prepare($countSQL);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->execute();
$total = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare($sql);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$agents = $pdo->query("SELECT name FROM agents ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);

echo json_encode([
    'total'  => $total,
    'offset' => $offset,
    'limit'  => $limit,
    'agents' => $agents,
    'rows'   => $rows,
]);
