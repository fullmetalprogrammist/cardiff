(function () {
    'use strict';

    const data = window.CARD_DATA;

    function fillList(ul, items) {
        for (const text of items) {
            const li = document.createElement('li');
            li.textContent = text;
            ul.appendChild(li);
        }
    }

    function formatAge(ms) {
        const s = Math.floor(ms / 1000);
        if (s < 60) return s + 's.';
        const m = Math.floor(s / 60);
        if (m < 60) return m + 'm.';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'h.';
        return Math.floor(h / 24) + 'd.';
    }

    function formatIn(ms) {
        if (ms <= 0) return 'now';
        const s = Math.floor(ms / 1000);
        if (s < 60) return s + 's';
        const m = Math.floor(s / 60);
        if (m < 60) return m + 'm';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'h';
        return Math.floor(h / 24) + 'd';
    }

    function updatePath(card, item) {
        const pathEl = card.querySelector('.card-path');
        const store = window.CARD_STORE;
        const rec = store && store.data && store.data[item.id];

        let pathText = pathEl.firstChild;
        if (!pathText || pathText.nodeType !== Node.TEXT_NODE) {
            pathText = document.createTextNode('');
            pathEl.insertBefore(pathText, pathEl.firstChild);
        }
        pathText.nodeValue = `/${data.keystore || ''}/${String(item.id).padStart(2, '0')}`;

        let meta = pathEl.querySelector('.card-meta');
        if (!meta) {
            meta = document.createElement('span');
            meta.className = 'card-meta';
            pathEl.appendChild(meta);
        }

        meta.textContent = '';

        if (rec) {
            if (rec.due) {
                const next = document.createElement('span');
                next.className = 'card-next';
                next.textContent = 'след. повтор: ' + formatIn(new Date(rec.due).getTime() - Date.now());
                meta.appendChild(next);

                const sep = document.createElement('span');
                sep.className = 'card-meta-sep';
                sep.textContent = '·';
                meta.appendChild(sep);
            }

            const age = document.createElement('span');
            age.className = 'card-age';
            age.textContent = 'пред. повтор: ' + formatAge(Date.now() - rec.reviewedAt);
            meta.appendChild(age);

            const dot = document.createElement('span');
            dot.className = 'card-grade-dot';
            dot.dataset.grade = rec.grade;
            meta.appendChild(dot);
        }
    }

    function createCard(template, item) {
        const slide = template.content.firstElementChild.cloneNode(true);
        const card = slide.querySelector('.card');
        card.dataset.id = item.id;

        updatePath(card, item);

        fillList(card.querySelector('.card-question .card-list'), item.question);
        fillList(card.querySelector('.card-answer .card-list'), item.answer);

        return slide;
    }

    function initFlip(card) {
        const faceQuestion = card.querySelector('.card-question');
        const faceAnswer   = card.querySelector('.card-answer');
        const flipBtn      = card.querySelector('.flip');
        let isAnswerShown = false;

        function setSide(show) {
            isAnswerShown = show;
            card.dataset.side = show ? 'answer' : 'question';
            faceQuestion.hidden = show;
            faceAnswer.hidden   = !show;
            flipBtn.setAttribute('aria-pressed', String(show));
            flipBtn.setAttribute('aria-label', show ? 'Показать вопрос' : 'Показать ответ');
        }

        flipBtn.addEventListener('click', () => setSide(!isAnswerShown));
        card._showQuestion = () => setSide(false);
    }

    function initGrades(card) {
        const id = card.dataset.id;
        const buttons = card.querySelectorAll('.grade');
        const fsrs = window.CARD_FSRS;
        const store = window.CARD_STORE;

        if (!fsrs || !store) return;

        const saved = store.data && store.data[id];
        if (saved && saved.grade) {
            for (const btn of buttons) {
                btn.setAttribute('aria-pressed', String(btn.dataset.grade === saved.grade));
            }
        }

        for (const btn of buttons) {
            btn.addEventListener('click', () => {
                const grade = btn.dataset.grade;
                const next = fsrs.review(id, grade);
                if (!next) return;

                for (const b of buttons) {
                    b.setAttribute('aria-pressed', String(b === btn));
                }
                const item = data.questions.find(q => String(q.id) === String(id));
                if (item) updatePath(card, item);
                resortAllCards();
            });
        }
    }

    let orderMode = 'all';

    function getVisibleCards() {
        const slot = document.querySelector('.cards');
        return [...slot.querySelectorAll('.slide:not([hidden]) .card')];
    }

    function getCurrentIndex(cards) {
        const slot = document.querySelector('.cards');
        const scrollMid = slot.scrollTop + slot.clientHeight / 2;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < cards.length; i++) {
            const cardMid = cards[i].offsetTop + cards[i].offsetHeight / 2;
            const dist = Math.abs(cardMid - scrollMid);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    function updateNav() {
        const cards = getVisibleCards();
        const total = cards.length;
        const current = total ? getCurrentIndex(cards) + 1 : 0;

        const curEl = document.querySelector('.bottom-bar-current');
        const totEl = document.querySelector('.bottom-bar-total');
        if (curEl) curEl.textContent = String(current).padStart(2, '0');
        if (totEl) totEl.textContent = String(total).padStart(2, '0');
    }

    function initCardNav() {
        const slot = document.querySelector('.cards');
        if (!slot) return;

        slot.addEventListener('scroll', updateNav, { passive: true });

        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cards = getVisibleCards();
                if (!cards.length) return;

                const currentIdx = getCurrentIndex(cards);
                const dir = btn.dataset.nav === 'next' ? 1 : -1;
                const nextIdx = Math.max(0, Math.min(cards.length - 1, currentIdx + dir));
                if (nextIdx !== currentIdx) {
                    cards[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    }

    function resortAllCards() {
        const slot = document.querySelector('.cards');
        if (!slot || typeof window.CARD_RECOMPUTE !== 'function') return;

        const order = window.CARD_RECOMPUTE(orderMode);
        const visible = new Set(order.map(String));

        for (const slide of slot.querySelectorAll('.slide')) {
            const card = slide.querySelector('.card');
            slide.hidden = !visible.has(String(card.dataset.id));
        }
        for (const id of order) {
            const card = slot.querySelector(`.card[data-id="${id}"]`);
            if (card) slot.appendChild(card.parentElement);
        }

        const byId = new Map(data.questions.map(q => [q.id, q]));
        for (const card of slot.querySelectorAll('.card:not([hidden])')) {
            const item = byId.get(Number(card.dataset.id)) || byId.get(card.dataset.id);
            if (item) updatePath(card, item);
        }

        slot.scrollTo({ top: 0, behavior: 'instant' });
        updateNav();
    }

    function initOrderSwitch(buttons) {
        function apply(mode) {
            orderMode = mode;
            for (const btn of buttons) {
                btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
            }
            resortAllCards();
        }

        for (const btn of buttons) {
            btn.addEventListener('click', () => apply(btn.dataset.mode));
        }

        apply(orderMode);
    }

    function addHiddenHeading(section, text) {
        const h2 = document.createElement('h2');
        h2.className = 'visually-hidden';
        h2.textContent = text;
        section.insertBefore(h2, section.firstChild);
    }

    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        console.warn('[cards] window.CARD_DATA не задан или пуст.');
        return;
    }

    const template = document.getElementById('card-template');
    const slot     = document.querySelector('.cards');

    if (!template || !slot) {
        console.warn('[cards] Не найдены #card-template / .cards');
        return;
    }

    document.title = data.title ? data.title + ' — cardiff' : document.title;

    addHiddenHeading(slot, 'Все карточки');

    for (const item of data.questions) {
        const slide = createCard(template, item);
        slot.appendChild(slide);
        initFlip(slide.querySelector('.card'));
        initGrades(slide.querySelector('.card'));
    }

    const orderButtons = document.querySelectorAll('[data-mode]');
    if (orderButtons.length) initOrderSwitch(orderButtons);

    initCardNav();
    updateNav();
})();