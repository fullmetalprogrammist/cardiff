(function () {
    'use strict';

    const data = window.CARD_DATA;
    if (!data || !data.keystore) return;

    const { FSRS, createEmptyCard, Rating } = window.FSRS;
    const scheduler = new FSRS({});          // дефолтные параметры
    const KEY = 'cardiff:grades:' + data.keystore;

    // 'easy' | 'medium' | 'hard' | 'again'  ->  Rating.*
    const RATING = {
        again:  Rating.Again,
        hard:   Rating.Hard,
        medium: Rating.Good,
        easy:   Rating.Easy,
    };

    function read() {
        try {
            return JSON.parse(localStorage.getItem(KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function write(id, grade, fsrsCard) {
        const store = read();
        store[id] = Object.assign({}, fsrsCard, {
            grade: grade,
            reviewedAt: Date.now(),
        });
        localStorage.setItem(KEY, JSON.stringify(store));
        window.CARD_STORE.data = store;
    }

    function ageSort(questions, store, filterFn) {
        const now = Date.now();
        const DAY = 86400000;

        return questions
            .filter(q => filterFn(store[q.id]))
            .map(q => {
                const rec = store[q.id];
                return {
                    id: q.id,
                    score: Math.log1p((now - rec.reviewedAt) / DAY)
                };
            })
            .sort((a, b) => b.score - a.score)
            .map(x => x.id);
    }

    function computeOrder(mode, store) {
        const qs = data.questions;

        switch (mode) {
            case 'grey':
                return qs
                    .filter(q => !store[q.id])
                    .map(q => q.id)
                    .sort((a, b) => b - a);

            case 'red':
                return ageSort(qs, store, rec => rec && rec.grade === 'hard');

            case 'all':
                return qs.map(q => q.id).sort((a, b) => b - a);

            case 'random': {
                const ids = qs.map(q => q.id);
                for (let i = ids.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [ids[i], ids[j]] = [ids[j], ids[i]];
                }
                return ids;
            }

            case 'ebbinghaus':
            default:
                return ageSort(qs, store, rec => !!rec);
        }
    }

    const store = read();

    window.CARD_STORE = { read: read, write: write, data: store, key: KEY };
    window.CARD_ORDER = computeOrder('ebbinghaus', store);

    window.CARD_RECOMPUTE = function (mode) {
        const fresh = read();
        window.CARD_STORE.data = fresh;
        return computeOrder(mode, fresh);
    };

    // Планировщик отдаём наружу, чтобы initGrades мог делать review
    window.CARD_FSRS = {
        Rating: RATING,
        review: function (id, grade) {
            const saved = window.CARD_STORE.data[id];
            // карточка FSRS: либо из стора, либо пустая
            const card = saved
                ? Object.assign(createEmptyCard(), saved, {
                    due: new Date(saved.due),
                    last_review: saved.last_review ? new Date(saved.last_review) : undefined,
                  })
                : createEmptyCard();

            const rating = RATING[grade];
            if (!rating) return null;

            const { card: next } = scheduler.next(card, new Date(), rating);
            write(id, grade, next);
            return next;
        },
    };
})();