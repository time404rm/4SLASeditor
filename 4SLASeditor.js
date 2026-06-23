/**
 * 4Tim-редактор v0.3
 * WYSIWYG-редактор на contenteditable
 * Стили вынесены в admin.css
 * Автор: ruslanabuzyaroff
 * Telegram: https://t.me/time4_04
 * Сайт: time404.ru
 * E-mail: ruslan@time404.ru
 * Лицензия: MIT
 */
class SimpleEditor {
    constructor(editorId, hiddenInputId, options = {}) {
        this.editor = document.getElementById(editorId);
        this.hiddenInput = document.getElementById(hiddenInputId);
        this.options = options;
        this.sourceTextarea = null;
        this.sourceLineNumbers = null;
        this.sourceWrapper = null;
        this.sourceModeActive = false;
        this._modalCounter = 0;
        this._apiBase = options.apiBase || '';
        if (!this.editor || !this.hiddenInput) return;

        this.toolbarBtns = {};
        this.statusBar = null;
        this.wcSpan = null;
        this.fullscreenActive = false;

        this.initToolbar();
        this.initEvents();
        this._createStatusBar();
        this.syncToHidden();

        const form = this.editor.closest('form');
        if (form) {
            form.addEventListener('submit', () => this.syncToHidden());
        }
    }

    _api(path) {
        return this._apiBase + path;
    }

    _nextId(prefix) {
        return prefix + '-' + (++this._modalCounter) + '-' + Date.now();
    }

    escapeHtml(str) {
        return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
    }

    sanitizeHtml(str) {
        const doc = document.createElement('div');
        doc.innerHTML = str;
        doc.querySelectorAll('script, iframe[srcdoc], object, embed').forEach(el => el.remove());
        doc.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(attr => {
                if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return doc.innerHTML;
    }

    _showError(container, message) {
        let el = container.querySelector('.editor-status');
        if (!el) {
            el = document.createElement('div');
            el.className = 'editor-status editor-status--error';
            container.appendChild(el);
        }
        el.textContent = message;
        el.style.display = 'block';
    }

    _setLoading(btn, loading) {
        if (!btn) return;
        btn.disabled = loading;
        btn.classList.toggle('editor-btn--loading', loading);
    }

    // ==================== СТАТУС-БАР ====================
    _createStatusBar() {
        this.statusBar = document.createElement('div');
        this.statusBar.className = 'editor-statusbar';
        this.wcSpan = document.createElement('span');
        this.wcSpan.className = 'editor-statusbar__wc';
        this.statusBar.appendChild(this.wcSpan);
        const modeSpan = document.createElement('span');
        modeSpan.className = 'editor-statusbar__mode';
        modeSpan.textContent = 'WYSIWYG';
        this.statusBar.appendChild(modeSpan);
        this.editor.parentNode.appendChild(this.statusBar);
    }

    _updateWordCount() {
        if (!this.wcSpan) return;
        const text = this.sourceModeActive && this.sourceTextarea
            ? this.sourceTextarea.value
            : this.editor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        this.wcSpan.textContent = `${words} слов · ${chars} символов`;
    }

    _updateModeIndicator() {
        if (!this.statusBar) return;
        const modeSpan = this.statusBar.querySelector('.editor-statusbar__mode');
        if (modeSpan) modeSpan.textContent = this.sourceModeActive ? 'HTML' : 'WYSIWYG';
    }

    // ==================== ТУЛБАР ====================
    initToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'editor-toolbar';
        const icon = (path) => `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;display:inline-block">${path}</svg>`;
        
        toolbar.innerHTML = `
            <button type="button" data-cmd="bold" title="Жирный (Ctrl+B)"><b>B</b></button>
            <button type="button" data-cmd="italic" title="Курсив (Ctrl+I)"><i>I</i></button>
            <button type="button" data-cmd="underline" title="Подчёркнутый (Ctrl+U)"><u>U</u></button>
            <button type="button" data-cmd="strikeThrough" title="Зачёркнутый"><s>S</s></button>
            <span class="editor-tb-sep"></span>
            <button type="button" data-cmd="insertUnorderedList" title="Маркированный список">• list</button>
            <button type="button" data-cmd="insertOrderedList" title="Нумерованный список">1. list</button>
            <span class="editor-tb-sep"></span>
            <button type="button" data-cmd="justifyLeft" title="Выровнять влево">${icon('<line x1="2" y1="4" x2="18" y2="4"/><line x1="2" y1="10" x2="12" y2="10"/><line x1="2" y1="16" x2="18" y2="16"/>')}</button>
            <button type="button" data-cmd="justifyCenter" title="Выровнять по центру">${icon('<line x1="2" y1="4" x2="18" y2="4"/><line x1="5" y1="10" x2="15" y2="10"/><line x1="2" y1="16" x2="18" y2="16"/>')}</button>
            <button type="button" data-cmd="justifyRight" title="Выровнять вправо">${icon('<line x1="2" y1="4" x2="18" y2="4"/><line x1="8" y1="10" x2="18" y2="10"/><line x1="2" y1="16" x2="18" y2="16"/>')}</button>
            <button type="button" data-cmd="justifyFull" title="Выровнять по ширине">${icon('<line x1="2" y1="4" x2="18" y2="4"/><line x1="2" y1="10" x2="18" y2="10"/><line x1="2" y1="16" x2="18" y2="16"/>')}</button>
            <span class="editor-tb-sep"></span>
            <button type="button" data-cmd="foreColor" title="Цвет текста">${icon('<path d="M10 3L6 14h2l1-3h2l1 3h2L10 3z"/><circle cx="10" cy="17" r="2" fill="currentColor"/>')}</button>
            <button type="button" data-cmd="backColor" title="Цвет фона">${icon('<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 7l6 6M13 7l-6 6" stroke-width="1"/>')}</button>
            <button type="button" data-cmd="formatBlock" data-val="h2" title="Заголовок 2">H2</button>
            <button type="button" data-cmd="formatBlock" data-val="h3" title="Заголовок 3">H3</button>
            <button type="button" data-cmd="formatBlock" data-val="blockquote" title="Цитата">${icon('<path d="M6 6h2v4H6zm4 0h2v4h-2z"/><path d="M4 12h12v2H4z" opacity=".5"/>')}</button>
            <button type="button" data-cmd="formatBlock" data-val="pre" title="Форматированный текст">${icon('<rect x="3" y="3" width="14" height="14" rx="1"/><line x1="6" y1="7" x2="14" y2="7"/><line x1="6" y1="10" x2="12" y2="10"/><line x1="6" y1="13" x2="14" y2="13"/>')}</button>
            <button type="button" data-cmd="horizontalRule" title="Горизонтальная линия">—</button>
            <span class="editor-tb-sep"></span>
            <button type="button" data-cmd="createLink" title="Ссылка (Ctrl+K)">${icon('<path d="M8 12l4-4"/><path d="M9 6a4 4 0 015.7 0 4 4 0 010 5.7L12 14"/><path d="M11 14a4 4 0 01-5.7 0 4 4 0 010-5.7L8 6"/>')}</button>
            <button type="button" data-cmd="insertAnchor" title="Якорь">${icon('<circle cx="10" cy="6" r="3"/><line x1="10" y1="9" x2="10" y2="17"/><path d="M5 16c0-3 2.2-5 5-5s5 2 5 5"/><line x1="7" y1="16" x2="13" y2="16"/>')}</button>
            <button type="button" data-cmd="uploadImage" title="Загрузить изображение">${icon('<path d="M10 14V4"/><path d="M6 8l4-4 4 4"/><path d="M4 14v2h12v-2"/>')}</button>
            <button type="button" data-cmd="insertImage" title="Вставить URL изображения">${icon('<rect x="3" y="3" width="14" height="14" rx="2"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/><path d="M3 14l4-4 3 3 2-2 5 5"/>')}</button>
            <button type="button" data-cmd="uploadFile" title="Загрузить файл">${icon('<path d="M14 14V6l-4-4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-4"/><path d="M10 10v6M7 13l3 3 3-3"/>')}</button>
            <button type="button" data-cmd="insertVideo" title="Вставить видео">${icon('<rect x="2" y="4" width="16" height="12" rx="2"/><polygon points="8,7 14,10 8,13" fill="currentColor"/>')}</button>
            <button type="button" data-cmd="insertTable" title="Таблица">${icon('<rect x="3" y="3" width="14" height="14" rx="1"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="3" y1="13" x2="17" y2="13"/><line x1="8" y1="3" x2="8" y2="17"/><line x1="13" y1="3" x2="13" y2="17"/>')}</button>
            <button type="button" data-cmd="insertEmoji" title="Смайлы">${icon('<circle cx="10" cy="10" r="7"/><circle cx="7" cy="8" r="1" fill="currentColor"/><circle cx="13" cy="8" r="1" fill="currentColor"/><path d="M7 12c1 1.5 5 1.5 6 0"/>')}</button>
            <button type="button" data-cmd="insertCode" title="Вставить код (Ctrl+⇧+C)">&lt;/&gt;</button>
            <span class="editor-tb-sep"></span>
            <button type="button" data-cmd="toggleSource" title="Режим HTML">${icon('<path d="M6 6L2 10l4 4"/><path d="M14 6l4 4-4 4"/><line x1="11" y1="4" x2="9" y2="16"/>')} HTML</button>
            <button type="button" data-cmd="undo" title="Отменить (Ctrl+Z)">${icon('<path d="M4 8h8a4 4 0 010 8H8"/><path d="M7 5L4 8l3 3"/>')}</button>
            <button type="button" data-cmd="redo" title="Повторить (Ctrl+Y)">${icon('<path d="M16 8H8a4 4 0 000 8h4"/><path d="M13 5l3 3-3 3"/>')}</button>
            <button type="button" data-cmd="fullscreen" title="На весь экран">${icon('<path d="M3 7V3h4"/><path d="M17 7V3h-4"/><path d="M3 13v4h4"/><path d="M17 13v4h-4"/>')}</button>
            <span style="margin-left:auto;font-size:.8rem;color:#b9c7e6;align-self:center;">4tim редактор v0.3</span>
        `;
        this.editor.parentNode.insertBefore(toolbar, this.editor);
        this.toggleBtn = toolbar.querySelector('[data-cmd="toggleSource"]');

        toolbar.querySelectorAll('button').forEach(btn => {
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val;
            this.toolbarBtns[cmd] = btn;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.execCommand(cmd, val);
                this.editor.focus();
            });
        });
    }

    _updateActiveButtons() {
        if (!this.editor || this.sourceModeActive) return;
        const map = {
            bold: 'bold', italic: 'italic', underline: 'underline', strikeThrough: 'strikeThrough',
            insertUnorderedList: 'insertUnorderedList', insertOrderedList: 'insertOrderedList',
            justifyLeft: 'justifyLeft', justifyCenter: 'justifyCenter',
            justifyRight: 'justifyRight', justifyFull: 'justifyFull'
        };
        for (const [cmd, docCmd] of Object.entries(map)) {
            const btn = this.toolbarBtns[cmd];
            if (btn) btn.classList.toggle('active', document.queryCommandState(docCmd));
        }
        // Формат для H2/H3/blockquote/pre
        const fmtBtn = { h2: 'formatBlock', h3: 'formatBlock', blockquote: 'formatBlock', pre: 'formatBlock' };
        for (const [val, cmd] of Object.entries(fmtBtn)) {
            const btn = this.toolbarBtns[cmd + '_' + val];
            if (btn) btn.classList.toggle('active', document.queryCommandValue(cmd) === val);
        }
    }

    // ==================== КОМАНДЫ ====================
    execCommand(command, value = null) {
        switch (command) {
            case 'createLink': this.insertLink(); break;
            case 'insertAnchor': this.insertAnchor(); break;
            case 'uploadImage': this.uploadImage(); break;
            case 'uploadFile': this.uploadFile(); break;
            case 'insertImage':
                const imgUrl = prompt('Введите URL изображения:', 'https://');
                if (imgUrl) document.execCommand('insertHTML', false, `<img src="${imgUrl}" alt="" style="max-width:100%">`);
                break;
            case 'insertVideo': this.insertVideo(); break;
            case 'insertTable': this.insertTable(); break;
            case 'insertEmoji': this.insertEmoji(); break;
            case 'insertCode': this.insertCodeBlock(); break;
            case 'toggleSource': this.toggleSourceMode(); break;
            case 'undo': document.execCommand('undo', false, null); break;
            case 'redo': document.execCommand('redo', false, null); break;
            case 'fullscreen': this.toggleFullscreen(); break;
            case 'horizontalRule': document.execCommand('insertHorizontalRule', false, null); break;
            case 'foreColor':
            case 'backColor': this._showColorPicker(command); break;
            default:
                if (command === 'formatBlock' && value) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command, false, value);
                }
        }
        this.syncToHidden();
        this._updateWordCount();
    }

    // ==================== ПАЛИТРА ЦВЕТОВ ====================
    _showColorPicker(cmd) {
        const palette = ['#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#efefef','#f3f3f3','#ffffff',
            '#980000','#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff','#ff00ff',
            '#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc',
            '#dd7e6b','#ea9999','#f9cb9c','#ffe599','#b6d7a8','#a2c4c9','#a4c2f4','#9fc5e8','#b4a7d6','#d5a6bd',
            '#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#6fa8dc','#8e7cc3','#c27ba0',
            '#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79',
            '#85200c','#990000','#b45f06','#bf9000','#38761d','#134f5c','#1155cc','#0b5394','#351c75','#741b47',
            '#5b0f00','#660000','#783f04','#7f6000','#274e13','#0c343d','#1c4587','#073763','#20124d','#4c1130'];
        const cmdName = cmd === 'foreColor' ? 'foreColor' : 'hiliteColor';
        const modal = document.createElement('div');
        modal.className = 'editor-modal editor-modal--sm';
        modal.innerHTML = `
            <h3>${cmd === 'foreColor' ? 'Цвет текста' : 'Цвет фона'}</h3>
            <div class="editor-color-grid">${palette.map(c => `<span class="editor-color-swatch" data-color="${c}" style="background:${c};${c==='#ffffff'?'border:1px solid #ccc;':''}"></span>`).join('')}</div>
            <div style="margin-top:10px;"><input type="text" id="color-custom" placeholder="#000000" maxlength="7" style="width:120px;display:inline-block;"><button id="color-custom-btn" style="margin-left:5px;">OK</button></div>
            <div class="button-group"><button id="color-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);
        modal.querySelectorAll('.editor-color-swatch').forEach(el => {
            el.addEventListener('click', () => {
                document.execCommand(cmdName, false, el.dataset.color);
                this.syncToHidden();
                modal.remove();
                this.editor.focus();
            });
        });
        modal.querySelector('#color-custom-btn').addEventListener('click', () => {
            const c = modal.querySelector('#color-custom').value.trim();
            if (c) { document.execCommand(cmdName, false, c); this.syncToHidden(); }
            modal.remove();
            this.editor.focus();
        });
        modal.querySelector('#color-cancel').addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== РЕЖИМ ИСХОДНОГО КОДА ====================
    toggleSourceMode() {
        if (this.sourceModeActive) {
            const code = this.sourceTextarea.value;
            this.editor.innerHTML = this.sanitizeHtml(code);
            if (this.sourceWrapper) this.sourceWrapper.style.display = 'none';
            this.editor.style.display = 'block';
            this.sourceModeActive = false;
            if (this.toggleBtn) this.toggleBtn.classList.remove('active');
        } else {
            if (!this.sourceTextarea) {
                this.sourceWrapper = document.createElement('div');
                this.sourceWrapper.className = 'editor-source-wrap';

                this.sourceLineNumbers = document.createElement('div');
                this.sourceLineNumbers.className = 'editor-source-lines';
                this.sourceLineNumbers.setAttribute('aria-hidden', 'true');

                this.sourceTextarea = document.createElement('textarea');
                this.sourceTextarea.className = 'editor-source';
                this.sourceTextarea.value = this.editor.innerHTML;
                this.sourceTextarea.spellcheck = false;

                // Синхронизация номеров строк
                const syncLines = () => {
                    const lines = this.sourceTextarea.value.split('\n').length;
                    this.sourceLineNumbers.innerHTML = Array.from({length: lines}, (_, i) => `<span>${i + 1}</span>`).join('');
                };
                syncLines();
                this.sourceTextarea.addEventListener('input', () => {
                    this.syncToHidden();
                    syncLines();
                    this._updateWordCount();
                });
                this.sourceTextarea.addEventListener('scroll', () => {
                    this.sourceLineNumbers.scrollTop = this.sourceTextarea.scrollTop;
                });

                // Tab = 4 пробела
                this.sourceTextarea.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = this.sourceTextarea.selectionStart;
                        const end = this.sourceTextarea.selectionEnd;
                        const val = this.sourceTextarea.value;
                        this.sourceTextarea.value = val.slice(0, start) + '    ' + val.slice(end);
                        this.sourceTextarea.selectionStart = this.sourceTextarea.selectionEnd = start + 4;
                        syncLines();
                        this.syncToHidden();
                    }
                });

                this.sourceWrapper.appendChild(this.sourceLineNumbers);
                this.sourceWrapper.appendChild(this.sourceTextarea);
                this.editor.parentNode.insertBefore(this.sourceWrapper, this.editor.nextSibling);
            } else {
                this.sourceTextarea.value = this.editor.innerHTML;
                if (this.sourceWrapper) this.sourceWrapper.style.display = 'flex';
                // Обновить номера
                const lines = this.sourceTextarea.value.split('\n').length;
                if (this.sourceLineNumbers) {
                    this.sourceLineNumbers.innerHTML = Array.from({length: lines}, (_, i) => `<span>${i + 1}</span>`).join('');
                }
            }
            this.editor.style.display = 'none';
            this.sourceModeActive = true;
            if (this.toggleBtn) this.toggleBtn.classList.add('active');
        }
        this.syncToHidden();
        this._updateWordCount();
        this._updateModeIndicator();
    }

    // ==================== ПОЛНЫЙ ЭКРАН ====================
    toggleFullscreen() {
        const wrapper = this.editor.closest('.editor-wrapper') || this.editor.parentNode;
        this.fullscreenActive = !this.fullscreenActive;
        wrapper.classList.toggle('editor-fullscreen', this.fullscreenActive);
        const btn = this.toolbarBtns.fullscreen;
        if (btn) {
            btn.classList.toggle('active', this.fullscreenActive);
            btn.title = this.fullscreenActive ? 'Свернуть' : 'На весь экран';
        }
        if (this.fullscreenActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    // ==================== КЛАВИАТУРА ====================
    _initKeyboard(e) {
        const isCtrl = e.ctrlKey || e.metaKey;
        if (!isCtrl) return;

        switch (e.key.toLowerCase()) {
            case 's':
                e.preventDefault();
                this.syncToHidden();
                break;
            case 'k':
                e.preventDefault();
                this.insertLink();
                break;
            case 'b': case 'i': case 'u':
                // Браузер сам обрабатывает execCommand для bold/italic/underline
                // Просто обновим кнопки после
                setTimeout(() => this._updateActiveButtons(), 0);
                break;
        }
    }

    // ==================== ВСТАВКА ====================
    _sanitizePaste(e) {
        e.preventDefault();
        let html = '';
        let text = '';

        if (e.clipboardData) {
            html = e.clipboardData.getData('text/html') || '';
            text = e.clipboardData.getData('text/plain') || '';
        }

        if (html) {
            const doc = document.createElement('div');
            doc.innerHTML = html;
            // Удалить стили Word/Excel
            doc.querySelectorAll('style, link, meta, title, [class^="Mso"], [class*="Mso"]').forEach(el => el.remove());
            // Чистка inline-стилей, кроме базовых
            doc.querySelectorAll('*').forEach(el => {
                if (el.style) {
                    const keep = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-align'];
                    const s = el.style;
                    [...s].forEach(prop => {
                        if (!keep.includes(prop)) s.removeProperty(prop);
                    });
                }
                if (el.tagName === 'FONT') {
                    const span = document.createElement('span');
                    span.innerHTML = el.innerHTML;
                    if (el.color) span.style.color = el.color;
                    if (el.face) span.style.fontFamily = el.face;
                    if (el.size) span.style.fontSize = el.size + 'px';
                    el.parentNode.replaceChild(span, el);
                }
            });
            // Разрешённые теги
            const allowed = ['p','br','b','strong','i','em','u','s','a','img','ul','ol','li','table','tr','td','th','thead','tbody','tfoot','caption','colgroup','col','span','div','h1','h2','h3','h4','h5','h6','blockquote','pre','code','hr','sub','sup','small','mark','dl','dt','dd','figure','figcaption'];
            doc.querySelectorAll('*').forEach(el => {
                if (!allowed.includes(el.tagName.toLowerCase())) {
                    const span = document.createElement('span');
                    span.innerHTML = el.innerHTML;
                    el.parentNode.replaceChild(span, el);
                }
            });
            html = doc.innerHTML;
            document.execCommand('insertHTML', false, html);
        } else if (text) {
            document.execCommand('insertText', false, text);
        }
        this.syncToHidden();
        this._updateWordCount();
    }

    // ==================== DRAG & DROP ====================
    _initDragDrop() {
        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.editor.classList.add('editor-dragover');
        });
        this.editor.addEventListener('dragleave', () => {
            this.editor.classList.remove('editor-dragover');
        });
        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            this.editor.classList.remove('editor-dragover');
            const files = e.dataTransfer.files;
            if (files.length) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        this._uploadDroppedImage(file);
                    }
                }
            } else {
                // Текст/HTML — вставка
                const html = e.dataTransfer.getData('text/html');
                const text = e.dataTransfer.getData('text/plain');
                if (html) {
                    this._sanitizePaste({ preventDefault: () => {}, clipboardData: { getData: (t) => t === 'text/html' ? html : text } });
                } else if (text) {
                    document.execCommand('insertText', false, text);
                }
            }
            this.syncToHidden();
        });
    }

    _uploadDroppedImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        const postId = window.currentPostId || 0;
        const pageId = window.currentPageId || 0;
        formData.append('post_id', postId);
        formData.append('page_id', pageId);
        fetch(this._api('/api/upload_image.php'), { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    document.execCommand('insertHTML', false, `<img src="${data.url}" alt="" style="max-width:100%">`);
                    this.syncToHidden();
                }
            })
            .catch(() => {});
    }

    // ==================== КЛИК ПО ИЗОБРАЖЕНИЮ ====================
    _initImageClick() {
        this.editor.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            if (img && this.editor.contains(img)) {
                this._selectImage(img);
            }
        });
        this.editor.addEventListener('dblclick', (e) => {
            const img = e.target.closest('img');
            if (img && this.editor.contains(img)) {
                this._editImage(img);
            }
        });
    }

    _selectImage(img) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNode(img);
        sel.addRange(range);
        this.editor.focus();
    }

    _editImage(img) {
        const currentSrc = img.getAttribute('src') || '';
        const currentAlt = img.getAttribute('alt') || '';
        const modalId = this._nextId('img-edit');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.style.minWidth = '400px';
        modal.innerHTML = `
            <h3>Редактировать изображение</h3>
            <label>URL:</label><input type="text" id="${modalId}-src" value="${this.escapeHtml(currentSrc)}">
            <label>Alt-текст:</label><input type="text" id="${modalId}-alt" value="${this.escapeHtml(currentAlt)}">
            <label>Ширина (px):</label><input type="number" id="${modalId}-w" value="${img.width || ''}" step="1">
            <label>Высота (px):</label><input type="number" id="${modalId}-h" value="${img.height || ''}" step="1">
            <div class="button-group">
                <button id="${modalId}-ok">Обновить</button>
                <button id="${modalId}-cancel" class="cancel">Отмена</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector(`#${modalId}-ok`).addEventListener('click', () => {
            img.setAttribute('src', modal.querySelector(`#${modalId}-src`).value);
            img.setAttribute('alt', modal.querySelector(`#${modalId}-alt`).value);
            const w = parseInt(modal.querySelector(`#${modalId}-w`).value);
            const h = parseInt(modal.querySelector(`#${modalId}-h`).value);
            if (w) img.setAttribute('width', w); else img.removeAttribute('width');
            if (h) img.setAttribute('height', h); else img.removeAttribute('height');
            this.syncToHidden();
            modal.remove();
            this.editor.focus();
        });
        modal.querySelector(`#${modalId}-cancel`).addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== ДВОЙНОЙ КЛИК ПО ССЫЛКЕ ====================
    _initLinkDblClick() {
        this.editor.addEventListener('dblclick', (e) => {
            const a = e.target.closest('a');
            if (a && !a.classList.contains('editor-anchor') && this.editor.contains(a)) {
                e.preventDefault();
                this._editExistingLink(a);
            }
        });
    }

    _editExistingLink(a) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(a);
        sel.addRange(range);
        this.insertLink();
    }

    // ==================== ТАБЛИЦЫ ====================
    _initTableToolbar() {
        this.editor.addEventListener('click', (e) => {
            const td = e.target.closest('td, th');
            if (td && this.editor.contains(td)) {
                this._showTableContext(td.closest('table'), td);
            }
        });
    }

    _showTableContext(table, cell) {
        const existing = document.querySelector('.editor-table-tooltip');
        if (existing) existing.remove();

        if (!table || !this.editor.contains(table)) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'editor-table-tooltip';
        tooltip.innerHTML = `
            <button type="button" data-act="addRowAbove">+ строка выше</button>
            <button type="button" data-act="addRowBelow">+ строка ниже</button>
            <button type="button" data-act="addColBefore">+ колонка слева</button>
            <button type="button" data-act="addColAfter">+ колонка справа</button>
            <button type="button" data-act="delRow">− строка</button>
            <button type="button" data-act="delCol">− колонка</button>
            <button type="button" data-act="delTable">− таблица</button>
        `;
        document.body.appendChild(tooltip);

        const pos = cell.getBoundingClientRect();
        tooltip.style.left = Math.min(pos.left, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
        tooltip.style.top = (pos.bottom + 5) + 'px';

        const close = () => tooltip.remove();
        tooltip.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._execTableAction(table, cell, btn.dataset.act);
                close();
                this.editor.focus();
            });
        });
        setTimeout(() => document.addEventListener('click', close, { once: true }), 100);
    }

    _execTableAction(table, cell, action) {
        const row = cell.closest('tr');
        const rowIdx = row ? [...row.parentNode.children].indexOf(row) : -1;
        const colIdx = row ? [...row.children].indexOf(cell) : -1;
        const tbody = table.querySelector('tbody') || table;
        const rows = [...tbody.children].filter(r => r.tagName === 'TR');

        switch (action) {
            case 'addRowAbove':
            case 'addRowBelow': {
                if (rowIdx < 0) return;
                const newRow = document.createElement('tr');
                const cols = rows[rowIdx].children.length;
                for (let i = 0; i < cols; i++) {
                    const td = document.createElement('td');
                    td.innerHTML = '&nbsp;';
                    newRow.appendChild(td);
                }
                tbody.insertBefore(newRow, action === 'addRowAbove' ? rows[rowIdx] : rows[rowIdx].nextSibling);
                break;
            }
            case 'addColBefore':
            case 'addColAfter': {
                if (colIdx < 0) return;
                rows.forEach(r => {
                    const td = document.createElement('td');
                    td.innerHTML = '&nbsp;';
                    const target = r.children[colIdx];
                    r.insertBefore(td, action === 'addColBefore' ? target : target.nextSibling);
                });
                break;
            }
            case 'delRow':
                if (rows.length > 1 && row) row.remove();
                break;
            case 'delCol':
                if (rows[0] && rows[0].children.length > 1) {
                    rows.forEach(r => { if (r.children[colIdx]) r.children[colIdx].remove(); });
                }
                break;
            case 'delTable':
                table.remove();
                break;
        }
        this.syncToHidden();
    }

    // ==================== ССЫЛКИ ====================
    _getSelectedRange() {
        const sel = window.getSelection();
        return sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    }

    _restoreRange(savedRange) {
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        } else {
            this.editor.focus();
        }
    }

    _getAnchors() {
        const anchors = [];
        this.editor.querySelectorAll('[id]').forEach(el => {
            const id = el.getAttribute('id');
            if (id && !anchors.includes(id)) anchors.push(id);
        });
        return anchors;
    }

    _loadInternalLinks(selectEl) {
        fetch(this._api('/api/get_posts_pages.php'))
            .then(res => res.json())
            .then(data => {
                if (data && data.length) {
                    data.forEach(item => {
                        const opt = document.createElement('option');
                        opt.value = item.url;
                        opt.textContent = item.title + ' (' + item.type + ')';
                        selectEl.appendChild(opt);
                    });
                }
            })
            .catch(() => {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '— ошибка загрузки —';
                opt.disabled = true;
                selectEl.appendChild(opt);
            });
    }

    _loadIconLibrary(container) {
        fetch(this._api('/api/upload_icon.php'))
            .then(res => res.json())
            .then(icons => {
                if (!container) return;
                container.innerHTML = '';
                if (!icons || !icons.length) {
                    container.innerHTML = '<p>Нет загруженных иконок</p>';
                    return;
                }
                icons.forEach(icon => {
                    const img = document.createElement('img');
                    img.src = icon.filepath;
                    img.alt = icon.original_name || '';
                    img.className = 'editor-icon-lib-item';
                    img.title = icon.original_name;
                    img.addEventListener('click', () => {
                        container.dispatchEvent(new CustomEvent('iconselect', { detail: { url: icon.filepath } }));
                    });
                    container.appendChild(img);
                });
            })
            .catch(() => { if (container) container.innerHTML = '<p class="editor-status editor-status--error">Ошибка загрузки иконок</p>'; });
    }

    insertLink() {
        const savedRange = this._getSelectedRange();
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        let isEditing = false;
        let selectedLink = null;
        let existingIconUrl = null;
        let existingLinkType = 'text';
        let existingLink = null;

        if (savedRange) {
            let node = savedRange.commonAncestorContainer;
            if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
            selectedLink = node.closest('a');
            if (selectedLink) {
                isEditing = true;
                existingLink = {
                    url: selectedLink.getAttribute('href'),
                    target: selectedLink.getAttribute('target') || '_self',
                    text: selectedLink.innerText
                };
                const iconImg = selectedLink.querySelector('img.link-icon');
                if (iconImg) {
                    existingIconUrl = iconImg.src;
                    existingLinkType = selectedLink.innerText.trim() ? 'both' : 'icon';
                }
            }
        }

        const anchors = this._getAnchors();
        const modalId = this._nextId('link');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.style.minWidth = '650px';
        modal.innerHTML = `
            <h3>${isEditing ? 'Редактировать ссылку' : 'Вставить ссылку'}</h3>
            <label>URL (или #имя_якоря):</label>
            <input type="text" id="${modalId}-url" placeholder="https:// или #myanchor" value="${existingLink ? this.escapeHtml(existingLink.url) : ''}">
            ${anchors.length ? `<label>Или выберите якорь:</label><select id="${modalId}-anchor"><option value="">— выберите —</option>${anchors.map(a => `<option value="#${a}">${a}</option>`).join('')}</select>` : ''}
            <label>Или выберите страницу / пост:</label>
            <select id="${modalId}-internal"><option value="">— выберите —</option></select>
            <label>Открывать в:</label>
            <select id="${modalId}-target">
                <option value="_self" ${existingLink && existingLink.target === '_self' ? 'selected' : ''}>Текущей вкладке</option>
                <option value="_blank" ${existingLink && existingLink.target === '_blank' ? 'selected' : ''}>Новой вкладке</option>
            </select>
            <label>Тип ссылки:</label>
            <select id="${modalId}-linktype">
                <option value="text" ${existingLinkType === 'text' ? 'selected' : ''}>Только текст</option>
                <option value="icon" ${existingLinkType === 'icon' ? 'selected' : ''}>Только иконка</option>
                <option value="both" ${existingLinkType === 'both' ? 'selected' : ''}>Иконка + текст</option>
            </select>
            <div id="${modalId}-textgroup">
                <label>Текст ссылки:</label>
                <input type="text" id="${modalId}-linktext" placeholder="Введите текст" value="${isEditing && existingLink ? this.escapeHtml(existingLink.text) : selectedText}">
            </div>
            <hr>
            <h4>Иконка для ссылки (необязательно)</h4>
            <div class="icon-upload-area">
                <input type="file" id="${modalId}-iconfile" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml">
                <button type="button" id="${modalId}-iconuploadbtn" disabled>Загрузить новую</button>
                <div id="${modalId}-iconpreview" style="margin-top:10px;display:${existingIconUrl ? 'block' : 'none'};">
                    <img src="${existingIconUrl ? this.escapeHtml(existingIconUrl) : ''}" class="editor-icon-preview-img">
                    <button type="button" id="${modalId}-iconremove" style="margin-left:10px;">Удалить иконку</button>
                </div>
            </div>
            <hr>
            <label>Или выберите из библиотеки (нажмите на иконку):</label>
            <div id="${modalId}-library" class="editor-icon-library"></div>
            <button type="button" id="${modalId}-refreshlib">Обновить библиотеку</button>
            <div class="editor-status" style="display:none;"></div>
            <div class="button-group">
                <button id="${modalId}-confirm">${isEditing ? 'Обновить' : 'Вставить'}</button>
                <button id="${modalId}-cancel" class="cancel">Отмена</button>
            </div>
        `;
        document.body.appendChild(modal);

        const urlInput = modal.querySelector(`#${modalId}-url`);
        const targetSelect = modal.querySelector(`#${modalId}-target`);
        const linkTypeSelect = modal.querySelector(`#${modalId}-linktype`);
        const linkTextGroup = modal.querySelector(`#${modalId}-textgroup`);
        const linkTextInput = modal.querySelector(`#${modalId}-linktext`);
        const confirmBtn = modal.querySelector(`#${modalId}-confirm`);
        const cancelBtn = modal.querySelector(`#${modalId}-cancel`);
        const anchorSelect = modal.querySelector(`#${modalId}-anchor`);
        const internalSelect = modal.querySelector(`#${modalId}-internal`);
        const iconFileInput = modal.querySelector(`#${modalId}-iconfile`);
        const uploadIconBtn = modal.querySelector(`#${modalId}-iconuploadbtn`);
        const iconPreviewDiv = modal.querySelector(`#${modalId}-iconpreview`);
        const removeIconBtn = modal.querySelector(`#${modalId}-iconremove`);
        const refreshLibBtn = modal.querySelector(`#${modalId}-refreshlib`);
        const iconLibraryDiv = modal.querySelector(`#${modalId}-library`);
        let uploadedIconUrl = existingIconUrl || '';

        const toggleText = () => linkTextGroup.style.display = (linkTypeSelect.value === 'text' || linkTypeSelect.value === 'both') ? 'block' : 'none';
        toggleText();
        linkTypeSelect.addEventListener('change', toggleText);

        this._loadInternalLinks(internalSelect);
        if (anchorSelect) anchorSelect.addEventListener('change', () => { if (anchorSelect.value) urlInput.value = anchorSelect.value; });
        internalSelect.addEventListener('change', () => { if (internalSelect.value) urlInput.value = internalSelect.value; });

        iconLibraryDiv.addEventListener('iconselect', (e) => {
            uploadedIconUrl = e.detail.url;
            iconPreviewDiv.innerHTML = `<img src="${uploadedIconUrl}" class="editor-icon-preview-img"><button type="button" id="${modalId}-iconremove2" style="margin-left:10px;">Удалить</button>`;
            iconPreviewDiv.style.display = 'block';
            iconPreviewDiv.querySelector(`#${modalId}-iconremove2`)?.addEventListener('click', () => { uploadedIconUrl = ''; iconPreviewDiv.style.display = 'none'; iconPreviewDiv.innerHTML = ''; });
        });
        this._loadIconLibrary(iconLibraryDiv);

        iconFileInput.addEventListener('change', () => { uploadIconBtn.disabled = !iconFileInput.files.length; });
        uploadIconBtn.addEventListener('click', () => {
            const file = iconFileInput.files[0];
            if (!file) return;
            this._setLoading(uploadIconBtn, true);
            const fd = new FormData();
            fd.append('icon', file);
            fetch(this._api('/api/upload_icon.php'), { method: 'POST', body: fd })
                .then(r => r.json())
                .then(d => {
                    if (d.success) {
                        uploadedIconUrl = d.url;
                        iconPreviewDiv.innerHTML = `<img src="${uploadedIconUrl}" class="editor-icon-preview-img"><button type="button" id="${modalId}-iconremove3" style="margin-left:10px;">Удалить</button>`;
                        iconPreviewDiv.style.display = 'block';
                        iconPreviewDiv.querySelector(`#${modalId}-iconremove3`)?.addEventListener('click', () => { uploadedIconUrl = ''; iconPreviewDiv.style.display = 'none'; iconPreviewDiv.innerHTML = ''; });
                        this._loadIconLibrary(iconLibraryDiv);
                    } else {
                        this._showError(modal, d.error || 'Ошибка загрузки');
                    }
                })
                .catch(() => this._showError(modal, 'Ошибка соединения'))
                .finally(() => this._setLoading(uploadIconBtn, false));
        });
        if (removeIconBtn) removeIconBtn.addEventListener('click', () => { uploadedIconUrl = ''; iconPreviewDiv.style.display = 'none'; iconPreviewDiv.innerHTML = ''; });
        if (refreshLibBtn) refreshLibBtn.addEventListener('click', () => this._loadIconLibrary(iconLibraryDiv));

        const removeModal = () => modal.remove();
        confirmBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            const target = targetSelect.value;
            const linkType = linkTypeSelect.value;
            const linkText = linkTextInput.value.trim();
            if (!url) { removeModal(); return; }
            removeModal();
            this._restoreRange(savedRange);
            const iconHtml = uploadedIconUrl ? `<img src="${this.escapeHtml(uploadedIconUrl)}" class="link-icon" alt="">` : '';
            let content = '';
            if (linkType === 'text') content = this.escapeHtml(linkText || url);
            else if (linkType === 'icon') {
                if (!uploadedIconUrl) { alert('Выберите иконку'); return; }
                content = iconHtml;
            } else {
                if (!uploadedIconUrl) { alert('Выберите иконку'); return; }
                content = iconHtml + this.escapeHtml(linkText || url);
            }
            if (isEditing && selectedLink) {
                selectedLink.setAttribute('href', url);
                selectedLink.setAttribute('target', target);
                selectedLink.innerHTML = content;
            } else {
                document.execCommand('insertHTML', false, `<a href="${this.escapeHtml(url)}" target="${this.escapeHtml(target)}">${content}</a>`);
            }
            this.syncToHidden();
            this.editor.focus();
        });
        cancelBtn.addEventListener('click', () => { removeModal(); this.editor.focus(); });
    }

    // ==================== ЯКОРЬ ====================
    insertAnchor() {
        const savedRange = this._getSelectedRange();
        const selText = window.getSelection().toString().trim();
        const name = prompt('Имя якоря (латиница, цифры, дефис, подчёркивание):', selText ? this.slugify(selText) : 'anchor-' + Date.now());
        if (!name) return;
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) { alert('Недопустимые символы'); return; }
        this._restoreRange(savedRange);
        document.execCommand('insertHTML', false, selText
            ? `<a id="${name}" class="editor-anchor">${selText}</a>`
            : `<a id="${name}" class="editor-anchor">\u200B</a>`);
        this.syncToHidden();
    }

    // ==================== ИЗОБРАЖЕНИЕ ====================
    uploadImage() {
        const savedRange = this._getSelectedRange();
        const modalId = this._nextId('img');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.style.minWidth = '450px';
        modal.innerHTML = `
            <h3>Загрузить изображение</h3>
            <label>Выберите файл:</label>
            <input type="file" id="${modalId}-file" accept="image/jpeg,image/png,image/gif,image/webp">
            <div id="${modalId}-preview" style="margin-top:10px;display:none;"><img id="${modalId}-previewimg" style="max-width:100%;max-height:200px;"></div>
            <div style="margin-top:10px;"><label>Alt-текст:</label><input type="text" id="${modalId}-alt"></div>
            <div><label>Title:</label><input type="text" id="${modalId}-title"></div>
            <div style="display:flex;gap:10px;"><div><label>Ширина (px):</label><input type="number" id="${modalId}-w" step="1"></div><div><label>Высота (px):</label><input type="number" id="${modalId}-h" step="1"></div></div>
            <div class="editor-status" style="display:none;"></div>
            <div class="button-group"><button id="${modalId}-ok" disabled>Вставить</button><button id="${modalId}-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);

        const fileInput = modal.querySelector(`#${modalId}-file`);
        const previewBlock = modal.querySelector(`#${modalId}-preview`);
        const previewImg = modal.querySelector(`#${modalId}-previewimg`);
        const altInput = modal.querySelector(`#${modalId}-alt`);
        const titleInput = modal.querySelector(`#${modalId}-title`);
        const wInput = modal.querySelector(`#${modalId}-w`);
        const hInput = modal.querySelector(`#${modalId}-h`);
        const confirmBtn = modal.querySelector(`#${modalId}-ok`);
        const cancelBtn = modal.querySelector(`#${modalId}-cancel`);
        let uploadedUrl = '';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this._setLoading(confirmBtn, true);
            const fd = new FormData();
            fd.append('image', file);
            fd.append('post_id', window.currentPostId || 0);
            fd.append('page_id', window.currentPageId || 0);
            fetch(this._api('/api/upload_image.php'), { method: 'POST', body: fd })
                .then(r => r.json())
                .then(d => {
                    if (d.success) {
                        uploadedUrl = d.url;
                        previewImg.src = uploadedUrl;
                        previewBlock.style.display = 'block';
                        confirmBtn.disabled = false;
                    } else {
                        this._showError(modal, d.error || 'Ошибка загрузки');
                    }
                })
                .catch(() => this._showError(modal, 'Ошибка соединения'))
                .finally(() => this._setLoading(confirmBtn, false));
        });

        const insert = () => {
            if (!uploadedUrl) return;
            let h = `<img src="${uploadedUrl}"`;
            if (altInput.value) h += ` alt="${this.escapeHtml(altInput.value)}"`;
            if (titleInput.value) h += ` title="${this.escapeHtml(titleInput.value)}"`;
            if (wInput.value) h += ` width="${wInput.value}"`;
            if (hInput.value) h += ` height="${hInput.value}"`;
            h += ` style="max-width:100%">`;
            this._restoreRange(savedRange);
            document.execCommand('insertHTML', false, h);
            this.syncToHidden();
            modal.remove();
            this.editor.focus();
        };
        confirmBtn.addEventListener('click', insert);
        cancelBtn.addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== ФАЙЛ ====================
    uploadFile() {
        const savedRange = this._getSelectedRange();
        const modalId = this._nextId('file');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.innerHTML = `
            <h3>Загрузить файл для скачивания</h3>
            <label>Выберите файл:</label>
            <input type="file" id="${modalId}-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.txt,.csv">
            <div class="editor-status" style="margin-top:10px;display:none;"></div>
            <div class="button-group" style="margin-top:20px;"><button id="${modalId}-ok" disabled>Вставить ссылку</button><button id="${modalId}-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);
        const fileInput = modal.querySelector(`#${modalId}-file`);
        const statusDiv = modal.querySelector('.editor-status');
        const confirmBtn = modal.querySelector(`#${modalId}-ok`);
        const cancelBtn = modal.querySelector(`#${modalId}-cancel`);
        let uploadedUrl = '', originalName = '';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this._setLoading(confirmBtn, true);
            const fd = new FormData();
            fd.append('file', file);
            fetch(this._api('/api/upload_file.php'), { method: 'POST', body: fd })
                .then(r => r.json())
                .then(d => {
                    if (d.success) {
                        uploadedUrl = d.url; originalName = d.filename;
                        statusDiv.textContent = 'Файл загружен: ' + originalName;
                        statusDiv.className = 'editor-status'; statusDiv.style.display = 'block';
                        confirmBtn.disabled = false;
                    } else {
                        statusDiv.textContent = d.error;
                        statusDiv.className = 'editor-status editor-status--error'; statusDiv.style.display = 'block';
                    }
                })
                .catch(() => { statusDiv.textContent = 'Ошибка соединения'; statusDiv.className = 'editor-status editor-status--error'; statusDiv.style.display = 'block'; })
                .finally(() => this._setLoading(confirmBtn, false));
        });

        const insert = () => {
            if (!uploadedUrl) return;
            const text = originalName || uploadedUrl.split('/').pop();
            this._restoreRange(savedRange);
            document.execCommand('insertHTML', false, `<a href="${this.escapeHtml(uploadedUrl)}" target="_blank" rel="noopener noreferrer">📎 ${this.escapeHtml(text)}</a>`);
            this.syncToHidden();
            modal.remove();
            this.editor.focus();
        };
        confirmBtn.addEventListener('click', insert);
        cancelBtn.addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== ЭМОДЗИ ====================
    insertEmoji() {
        const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊'];
        const modalId = this._nextId('emoji');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.style.minWidth = '300px';
        modal.innerHTML = `
            <h3>Выберите смайл</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:200px;overflow-y:auto;">${emojis.map(e => `<span style="font-size:1.5rem;cursor:pointer;padding:4px;" data-e="${e}">${e}</span>`).join('')}</div>
            <div class="button-group" style="margin-top:10px;"><button id="${modalId}-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);
        const close = () => { modal.remove(); this.editor.focus(); };
        modal.querySelectorAll('[data-e]').forEach(el => {
            el.addEventListener('click', () => {
                document.execCommand('insertHTML', false, el.dataset.e);
                close();
                this.syncToHidden();
            });
        });
        modal.querySelector(`#${modalId}-cancel`).addEventListener('click', close);
    }

    // ==================== ТАБЛИЦА ====================
    insertTable() {
        const modalId = this._nextId('tbl');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.innerHTML = `
            <h3>Вставить таблицу</h3>
            <label>Строк (1-10):</label><input type="number" id="${modalId}-r" value="3" min="1" max="10" style="margin-bottom:10px;">
            <label>Столбцов (1-10):</label><input type="number" id="${modalId}-c" value="3" min="1" max="10" style="margin-bottom:10px;">
            <div class="button-group"><button id="${modalId}-ok">Вставить</button><button id="${modalId}-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);
        const rI = modal.querySelector(`#${modalId}-r`), cI = modal.querySelector(`#${modalId}-c`);
        modal.querySelector(`#${modalId}-ok`).addEventListener('click', () => {
            let r = Math.min(10, Math.max(1, parseInt(rI.value) || 3));
            let c = Math.min(10, Math.max(1, parseInt(cI.value) || 3));
            let t = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">';
            for (let i = 0; i < r; i++) { t += '<tr>'; for (let j = 0; j < c; j++) t += '<td>&nbsp;<\/td>'; t += '<\/tr>'; }
            t += '<\/table>';
            document.execCommand('insertHTML', false, t);
            modal.remove();
            this.syncToHidden();
            this.editor.focus();
        });
        modal.querySelector(`#${modalId}-cancel`).addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== ВИДЕО ====================
    insertVideo() {
        const savedRange = this._getSelectedRange();
        const modalId = this._nextId('vid');
        const modal = document.createElement('div');
        modal.className = 'editor-modal';
        modal.style.minWidth = '450px';
        modal.innerHTML = `
            <h3>Вставить видео</h3>
            <label>Ссылка (YouTube, VK, Rutube) или iframe-код:</label>
            <textarea id="${modalId}-in" rows="3" placeholder="https://www.youtube.com/watch?v=..."></textarea>
            <div class="button-group"><button id="${modalId}-ok">Вставить</button><button id="${modalId}-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);
        const input = modal.querySelector(`#${modalId}-in`);
        modal.querySelector(`#${modalId}-ok`).addEventListener('click', () => {
            let c = input.value.trim();
            modal.remove();
            if (!c) return;
            this._restoreRange(savedRange);
            if (c.match(/^https?:\/\//)) {
                let e = '';
                const yt = c.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
                if (yt) e = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe>`;
                else {
                    const vk = c.match(/vkvideo\.ru\/video([-_0-9]+)/);
                    if (vk) {
                        const p = vk[1].split('_');
                        e = p.length === 2 ? `<iframe src="https://vkvideo.ru/video_ext.php?oid=${p[0]}&id=${p[1]}" width="560" height="315" frameborder="0" allowfullscreen></iframe>` : `<iframe src="${c}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
                    } else {
                        const rt = c.match(/rutube\.ru\/video\/([a-f0-9]+)/);
                        e = rt ? `<iframe src="https://rutube.ru/play/embed/${rt[1]}" width="560" height="315" frameborder="0" allowfullscreen></iframe>` : `<iframe src="${c}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
                    }
                }
                document.execCommand('insertHTML', false, e);
            } else {
                document.execCommand('insertHTML', false, c);
            }
            this.syncToHidden();
            this.editor.focus();
        });
        modal.querySelector(`#${modalId}-cancel`).addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== ПОДСВЕТКА КОДА ====================

    _getLangConfig(lang) {
        const cf = {
            php: {
                kw: 'abstract and array as break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile eval exit extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match method namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield',
                ext: '\\b(?:true|false|null|self|parent|int|float|bool|string|void|never|mixed|iterable|object|resource|numeric|Enums?)\\b'
            },
            javascript: {
                kw: 'async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield',
                ext: '\\b(?:true|false|null|undefined|NaN|Infinity|arguments|from|of|Symbol|Map|Set|Promise|Proxy|Reflect|BigInt)\\b'
            },
            html: { kw: '', ext: '&\\w+;|&\\#[0-9]+;' },
            css: {
                kw: '\\b@import\\b|\\b@media\\b|\\b@keyframes\\b|\\b@font-face\\b|\\b@supports\\b|!important',
                ext: '\\b(?:from|to|url|rgba?|hsla?|calc|var|min|max|clamp|repeat|fit-content|minmax)\\b'
            },
            sql: {
                kw: 'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER ADD DROP INDEX VIEW TRIGGER JOIN LEFT RIGHT INNER OUTER CROSS ON AND OR NOT IN IS NULL LIKE BETWEEN EXISTS AS DISTINCT ORDER BY GROUP HAVING LIMIT OFFSET UNION ALL PRIMARY KEY FOREIGN REFERENCES CASCADE UNIQUE CHECK DEFAULT CONSTRAINT CASE WHEN THEN ELSE END BEGIN COMMIT ROLLBACK',
                ext: '\\b(?:TRUE|FALSE|NULL|INT|VARCHAR|TEXT|BOOLEAN|DATE|TIMESTAMP|FLOAT|DECIMAL)\\b'
            },
            python: {
                kw: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield',
                ext: '\\b(?:True|False|None|self|cls|__init__|__str__|__repr__|__call__|__getitem__|__setitem__|__enter__|__exit__|__len__|__iter__|__next__|print|len|range|enumerate|zip|map|filter|sorted|reversed|open|int|float|str|bool|list|dict|set|tuple|type|super|property|staticmethod|classmethod|abstractmethod|dataclass)\\b'
            },
            java: {
                kw: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while',
                ext: '\\b(?:true|false|null|String|Integer|Boolean|Object|List|ArrayList|Map|HashMap|Set|HashSet|void|main|var|record|sealed|permits|yield)\\b'
            },
            cpp: {
                kw: 'alignas alignof auto bool break case catch char class concept const constexpr consteval constinit continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator override private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile while',
                ext: '\\b(?:int|float|double|char|bool|void|string|vector|map|set|unordered_map|shared_ptr|unique_ptr|weak_ptr|auto|size_t|cout|cin|endl|std)\\b'
            },
            csharp: {
                kw: 'abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach get global goto if implicit in int interface internal is lock long namespace new null object operator out override params partial private protected public readonly ref return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using value var virtual void volatile when where while yield',
                ext: '\\b(?:int|string|bool|float|double|decimal|var|void|null|object|dynamic|var|nameof|async|await|Task|List|Dictionary|IEnumerable|IQueryable|Action|Func|Tuple)\\b'
            },
            go: {
                kw: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
                ext: '\\b(?:true|false|nil|string|int|float64|bool|byte|rune|error|append|len|cap|make|new|close|delete|panic|recover|print|println)\\b'
            },
            ruby: {
                kw: 'BEGIN END alias and begin break case class def defined? do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield',
                ext: '\\b(?:true|false|nil|puts|require|include|extend|attr_accessor|attr_reader|attr_writer|initialize|new|private|protected|public|raise|catch|throw|lambda|proc|block_given?|respond_to?|send|method_missing)\\b'
            },
            bash: {
                kw: 'if then elif else fi for while do done case esac in function select until break continue return exit declare local readonly unset export eval exec trap type set shift',
                ext: '\\b(?:echo|printf|read|source|\\.\\s|cd|ls|rm|mv|cp|mkdir|chmod|chown|grep|sed|awk|cat|find|sort|uniq|wc|head|tail|tee|xargs|true|false|export|alias|unalias|kill|pkill|ps|top|df|du|mount|umount)\\b'
            },
            json: { kw: '', ext: '' },
            xml: { kw: '', ext: '' },
            markdown: { kw: '', ext: '' }
        };
        return cf[lang] || { kw: '', ext: '' };
    }

    _highlightCode(code, lang) {
        const cfg = this._getLangConfig(lang);
        let result = this.escapeHtml(code);

        if (lang === 'html') {
            result = result
                .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-com">$1</span>')
                .replace(/(&lt;\/?)([\w-]+)/g, (m, br, tag) => br + '<span class="hl-tag">' + tag + '</span>')
                .replace(/(\s)(\w[\w-]*)(=)("(?:[^"]*?)")/g, (m, sp, attr, eq, val) => sp + '<span class="hl-attr">' + attr + '</span>' + eq + '<span class="hl-str">' + val + '</span>')
                .replace(/(&amp;)(\w+;)/g, (m, amp, ent) => amp + '<span class="hl-kw">' + ent + '</span>');
            return result;
        }

        if (lang === 'css') {
            result = result
                .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-com">$1</span>')
                .replace(/(@\w+[\s\S]*?\{)/g, (m) => {
                    const atRule = m.replace(/(@\w+)/, '<span class="hl-sec">$1</span>');
                    return atRule.replace(/\{/, '<span class="hl-op">{</span>');
                })
                .replace(/([\w-]+)(?=\s*\{)/g, '<span class="hl-tag">$1</span>')
                .replace(/(\.)([\w-]+)/g, (m, dot, cls) => dot + '<span class="hl-attr">' + cls + '</span>')
                .replace(/(#)([\w-]+)/g, (m, hash, id) => hash + '<span class="hl-var">' + id + '</span>')
                .replace(/(\d+\.?\d*)(px|em|rem|%|vh|vw|pt|cm|mm|in|ch|ex|vmin|vmax|fr)?/g, (m, num, unit) => '<span class="hl-num">' + num + '</span>' + (unit || ''))
                .replace(/("(?:[^"]*?)")/g, '<span class="hl-str">$1</span>')
                .replace(/(rgb|rgba|hsl|hsla|url)\(/g, '<span class="hl-fn">$1</span>(');
            return result;
        }

        if (lang === 'json') {
            result = result
                .replace(/("(?:[^"\\]|\\.)*?")\s*:/g, '<span class="hl-attr">$1</span>:')
                .replace(/("(?:[^"\\]|\\.)*?")/g, '<span class="hl-str">$1</span>')
                .replace(/\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, '<span class="hl-num">$1</span>')
                .replace(/\b(true|false|null)\b/g, '<span class="hl-kw">$1</span>');
            return result;
        }

        if (lang === 'xml') {
            result = result
                .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-com">$1</span>')
                .replace(/(&lt;\/?)([\w:-]+)/g, (m, br, tag) => br + '<span class="hl-tag">' + tag + '</span>')
                .replace(/(\s)([\w:-]+)(=)("(?:[^"]*?)")/g, (m, sp, attr, eq, val) => sp + '<span class="hl-attr">' + attr + '</span>' + eq + '<span class="hl-str">' + val + '</span>')
                .replace(/("(?:[^"]*?)")/g, '<span class="hl-str">$1</span>');
            return result;
        }

        if (lang === 'bash') {
            result = result
                .replace(/(#.*$)/gm, '<span class="hl-com">$1</span>')
                .replace(/\$(\{?\w+\}?)/g, '<span class="hl-var">$$$1</span>')
                .replace(/("(?:[^"]*?)")/g, '<span class="hl-str">$1</span>')
                .replace(/('(?:[^']*?)')/g, '<span class="hl-str">$1</span>')
                .replace(/(`[^`]*`)/g, '<span class="hl-str">$1</span>');
        }

        if (lang === 'markdown') {
            result = result
                .replace(/(`[^`]+`)/g, '<span class="hl-kw">$1</span>')
                .replace(/^(\#{1,6}\s)(.*)$/gm, '<span class="hl-sec">$1</span>$2')
                .replace(/(\*\*|__)(.*?)\1/g, '<span class="hl-kw">$1$2$1</span>')
                .replace(/(\*|_)(.*?)\1/g, '<span class="hl-var">$1$2$1</span>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="hl-fn">$1</span>(<span class="hl-str">$2</span>)')
                .replace(/^(>+\s)/gm, '<span class="hl-com">$1</span>');
            return result;
        }

        if (cfg.ext) {
            const extRe = new RegExp(cfg.ext, 'g');
            result = result.replace(extRe, '<span class="hl-kw">$1</span>');
        }

        if (cfg.kw) {
            const kwList = cfg.kw.split(/\s+/).filter(Boolean);
            const kwRe = new RegExp('\\b(' + kwList.join('|') + ')\\b', 'gi');
            result = result.replace(kwRe, '<span class="hl-kw">$1</span>');
        }

        result = result
            .replace(/\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, (m) => {
                if (m.startsWith('0') && m.length > 1) return m;
                return isNaN(Number(m)) || m.includes('.') && m.endsWith('.') ? m : '<span class="hl-num">' + m + '</span>';
            })
            .replace(/("(?:[^"\\]|\\.)*?"|'(?:[^'\\]|\\.)*?')/g, '<span class="hl-str">$1</span>')
            .replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="hl-com">$1</span>')
            .replace(/(\$\w+)/g, '<span class="hl-var">$1</span>')
            .replace(/\b(function|def|sub|fn)\b\s*(\w+)/gi, (m, kw, name) => '<span class="hl-kw">' + kw + '</span> <span class="hl-fn">' + name + '</span>');

        return result;
    }

    // ==================== БЛОК КОДА ====================

    insertCodeBlock() {
        const savedRange = this._getSelectedRange();
        const existing = document.getElementById('codeModal');
        if (existing) existing.remove();
        const modalId = this._nextId('code');
        const modal = document.createElement('div');
        modal.id = 'codeModal';
        modal.className = 'editor-modal';
        modal.style.minWidth = '450px';
        modal.innerHTML = `
            <h3>Вставить код</h3>
            <label>Язык:</label>
            <select id="${modalId}-lang">${['php','javascript','html','css','sql','python','java','cpp','csharp','go','ruby','json','xml','bash','markdown'].map(l => `<option value="${l}">${l}</option>`).join('')}</select>
            <label>Код:</label><textarea id="${modalId}-code" rows="10" placeholder="Введите код..." spellcheck="false"></textarea>
            <div class="button-group"><button id="${modalId}-ok">Вставить</button><button id="${modalId}-cancel" class="cancel">Отмена</button></div>
        `;
        document.body.appendChild(modal);
        const langSel = modal.querySelector(`#${modalId}-lang`);
        const codeTA = modal.querySelector(`#${modalId}-code`);

        codeTA.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = codeTA.selectionStart, end = codeTA.selectionEnd;
                codeTA.value = codeTA.value.slice(0, s) + '    ' + codeTA.value.slice(end);
                codeTA.selectionStart = codeTA.selectionEnd = s + 4;
            }
        });

        modal.querySelector(`#${modalId}-ok`).addEventListener('click', () => {
            const lang = langSel.value;
            const code = codeTA.value.trim();
            modal.remove();
            if (!code) return;
            this._restoreRange(savedRange);
            document.execCommand('delete', false, null);
            const highlighted = this._highlightCode(code, lang);
            const eLang = this.escapeHtml(lang);
            document.execCommand('insertHTML', false,
                `<div class="code-block" data-lang="${eLang}">` +
                `<div class="code-block__bar">` +
                `<span class="code-block__lang">${eLang}</span>` +
                `<span class="code-block__btns">` +
                `<button class="code-block__copy" onclick="(function(b){var p=b.closest('.code-block').querySelector('code'),t=p.textContent;navigator.clipboard?navigator.clipboard.writeText(t).then(function(){b.textContent='\\u2705';setTimeout(function(){b.textContent='\\uD83D\\uDCCB'},1500)}):(function(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();b.textContent='\\u2705';setTimeout(function(){b.textContent='\\uD83D\\uDCCB'},1500)})()})(this)">\uD83D\uDCCB</button>` +
                `<button class="code-block__expand" onclick="(function(b){var w=b.closest('.code-block');w.classList.toggle('code-block--full');document.body.style.overflow=w.classList.contains('code-block--full')?'hidden':''})(this)">\u2B76</button>` +
                `</span></div>` +
                `<pre><code class="language-${eLang}">${highlighted}</code></pre></div>`
            );
            this.syncToHidden();
            this.editor.focus();
        });
        modal.querySelector(`#${modalId}-cancel`).addEventListener('click', () => { modal.remove(); this.editor.focus(); });
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ====================
    initEvents() {
        this.editor.addEventListener('input', () => {
            this.syncToHidden();
            this._updateWordCount();
        });
        this.editor.addEventListener('blur', () => this.syncToHidden());

        // Подсветка активных кнопок
        this.editor.addEventListener('mouseup', () => this._updateActiveButtons());
        this.editor.addEventListener('keyup', () => this._updateActiveButtons());

        // Клавиатура
        this.editor.addEventListener('keydown', (e) => this._initKeyboard(e));

        // Вставка
        this.editor.addEventListener('paste', (e) => this._sanitizePaste(e));

        // Drag & drop
        this._initDragDrop();

        // Клик по изображению
        this._initImageClick();

        // Двойной клик по ссылке
        this._initLinkDblClick();

        // Тулбар таблиц
        this._initTableToolbar();
    }

    syncToHidden() {
        if (this.sourceModeActive && this.sourceTextarea) {
            this.hiddenInput.value = this.sourceTextarea.value;
        } else {
            this.hiddenInput.value = this.editor.innerHTML;
        }
    }

    setContent(html) {
        this.editor.innerHTML = html;
        this.syncToHidden();
        this._updateWordCount();
    }

    slugify(text) {
        return text.toString().toLowerCase()
            .replace(/[\s\u200c]+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }
}
