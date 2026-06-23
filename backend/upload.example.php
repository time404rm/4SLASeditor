<?php
/**
 * Пример обработчика загрузки изображений для 4SLASeditor
 * 
 * Редактор отправляет POST /api/upload_image.php с полем "file"
 * 
 * Ожидаемый ответ:
 *   { "url": "/uploads/images/filename.jpg" } — успех
 *   { "error": "Описание" } — ошибка
 */

header('Content-Type: application/json');

// Директория для сохранения
$uploadDir = __DIR__ . '/uploads/images/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'File upload failed']);
    exit;
}

$file = $_FILES['file'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

if (!in_array($file['type'], $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP']);
    exit;
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid() . '.' . $ext;
$destination = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    echo json_encode(['url' => '/uploads/images/' . $filename]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
}
