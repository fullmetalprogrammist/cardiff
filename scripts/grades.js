(function () {
    'use strict';

    const data = window.CARD_DATA;
    if (!data || !data.keystore) return;

    const KEY = 'cardiff:grades:' + data.keystore;

    function read() {
        try {
            return JSON.parse(localStorage.getItem(KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function write(id, grade) {
        const store = read();
        store[id] = { grade: grade, reviewedAt: Date.now() };
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
})();