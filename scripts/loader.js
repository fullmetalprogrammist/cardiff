(function () {
    'use strict';

    const TOPICS = {
        kafka: '/cardiff/questions/kafka.js',
        database:  '/cardiff/questions/database.js',
        microservices:  '/cardiff/questions/microservices.js'
    };

    const params = new URLSearchParams(location.search);
    const topic = params.get('topic');
    const src = topic && TOPICS[topic];

    if (!src) {
        console.error('[loader] Неизвестная тема:', topic);
        document.querySelector('.all-cards').textContent =
            'Тема не найдена: ' + (topic || '(не указана)');
        return;
    }

    function loadScript(path) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = path;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Не удалось загрузить ' + path));
            document.head.appendChild(s);
        });
    }

    loadScript(src)
        .then(() => loadScript('/cardiff/scripts/grades.js'))
        .then(() => loadScript('/cardiff/scripts/init-switch_modes-flip.js'))
        .catch(err => {
            console.error('[loader]', err);
            document.querySelector('.all-cards').textContent =
                'Ошибка загрузки данных темы.';
        });
})();