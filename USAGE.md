# Интеграция 4SLASeditor в ваш проект

Пошаговая инструкция по подключению редактора к любому веб-проекту.

---

## 1. Подключение файла

Скопируйте `4SLASeditor.js` в ваш проект и подключите на странице:

```html
<script src="путь/к/4SLASeditor.js"></script>
```

Редактор не требует jQuery, Bootstrap или других зависимостей.

---

## 2. HTML-разметка

Создайте два элемента:

- `div[contenteditable]` — видимая область редактирования
- `textarea[hidden]` — скрытое поле для отправки данных на сервер

```html
<div contenteditable="true" id="editor"></div>
<textarea id="content" name="content" hidden></textarea>
```

---

## 3. Инициализация

Вызовите конструктор после готовности DOM:

```html
<script>
  document.addEventListener('DOMContentLoaded', function() {
    new SimpleEditor('editor', 'content');
  });
</script>
```

Первый параметр — id редактируемого div, второй — id скрытого textarea.

---

## 4. Стилизация

Редактор использует CSS-классы с префиксом `editor-*`. Минимальный набор стилей:

```css
.editor-toolbar {
  display: flex; flex-wrap: wrap; gap: 2px; align-items: center;
  padding: 6px 8px; background: #1e2a3e; border-radius: 6px 6px 0 0;
}
.editor-toolbar button {
  background: none; border: none; color: #b9c7e6; cursor: pointer;
  padding: 4px 8px; border-radius: 4px; font-size: 13px; line-height: 1;
}
.editor-toolbar button:hover { background: #2a3650; color: #e2e8f0; }
.editor-toolbar button.active { background: #3a4a6a; color: #fff; }
.editor-tb-sep { width: 1px; height: 20px; background: #2a3650; margin: 0 4px; }
[contenteditable] {
  min-height: 400px; padding: 16px; background: #0f1422; color: #e2e8f0;
  border: 1px solid #2a3650; border-top: none; border-radius: 0 0 6px 6px;
  outline: none; line-height: 1.6;
}
```

Полный набор стилей — в [demo/demo.css](demo/demo.css).

---

## 5. Backend для загрузки изображений и файлов

Редактор отправляет мультимедиа на `POST /api/upload` (по умолчанию).
Требуется реализовать обработчик, который:

1. Принимает multipart/form-data с полем `file`
2. Валидирует тип файла (изображения: JPEG, PNG, GIF, WebP; файлы: PDF, ZIP, DOC)
3. Сохраняет файл в нужную директорию
4. Возвращает JSON с URL загруженного файла

**Успешный ответ:**
```json
{ "url": "/uploads/images/abc123.jpg" }
```

**Ошибка:**
```json
{ "error": "Описание ошибки" }
```

Пример реализации на PHP — в [backend/upload.example.php](backend/upload.example.php).

---

## 6. Клавиатурные сокращения

| Сочетание | Действие |
|---|---|
| Ctrl+B / Cmd+B | Жирный |
| Ctrl+I / Cmd+I | Курсив |
| Ctrl+U / Cmd+U | Подчёркнутый |
| Ctrl+K / Cmd+K | Вставить ссылку |
| Ctrl+Shift+C | Вставить код |
| Ctrl+Z | Отменить |
| Ctrl+Y / Ctrl+Shift+Z | Повторить |
| Tab | Отступ в редакторе кода |

---

## 7. Настройка путей

По умолчанию редактор ищет API для загрузки по пути `/api/upload_image.php`
относительно корня сайта. Чтобы изменить путь, передайте третий параметр:

```javascript
new SimpleEditor('editor', 'content', '/my-custom-upload-endpoint');
```

---

## 8. Совместимость

| Браузер | Версия |
|---|---|
| Chrome | 60+ |
| Firefox | 55+ |
| Safari | 12+ |
| Edge | 80+ |
| Opera | 50+ |
| Mobile Chrome/Safari | Да |
