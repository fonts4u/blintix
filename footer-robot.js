/**
 * Blintix Studio - Auto-Animated TV Robot (shape: rectangle)
 * Robot Name: Blinky
 * Powered by robot-heads
 * 
 * Auto-cycles through lively expressions while remaining
 * fully interactive to 3D mouse tracking & direct poke clicks.
 */
(function () {
    function initFooterRobot() {
        const stage = document.getElementById('footerRobotStage');
        if (!stage) return;
        if (typeof window.createRobotHead !== 'function') {
            console.warn('createRobotHead not loaded yet');
            return;
        }

        // Auto-animated expression sequence
        const sequence = [
            { state: 'idle', duration: 7000 },
            { state: 'happy', duration: 5500 },
            { state: 'thinking', duration: 5500 },
            { state: 'searching', duration: 5000 },
            { state: 'speaking', duration: 5000 },
            { state: 'working', duration: 5500 }
        ];

        // Initialize TV Robot Head (shape="rectangle")
        const bot = window.createRobotHead(stage, {
            shape: 'rectangle',
            state: sequence[0].state,
            size: 165,
            color: '#2b49a3',
            trimColor: '#93a6c8',
            screenColor: '#e8f2ff',
            interactive: true,
            floorShadow: true,
            antenna: true,
            onPoke: function () {
                handlePoke();
            }
        });

        if (!bot) return;

        let currentIndex = 0;
        let timer = null;
        let pokeCooldown = false;

        function runStep() {
            if (pokeCooldown) return;
            const current = sequence[currentIndex];
            bot.setState(current.state);

            timer = setTimeout(() => {
                currentIndex = (currentIndex + 1) % sequence.length;
                runStep();
            }, current.duration);
        }

        function handlePoke() {
            pokeCooldown = true;
            if (timer) clearTimeout(timer);

            // Animate pixel name tag on poke
            const tags = document.querySelectorAll('.robot-name-tag');
            tags.forEach(tag => {
                tag.classList.add('poked');
                setTimeout(() => tag.classList.remove('poked'), 400);
            });

            // Resume auto sequence after 4.5 seconds
            timer = setTimeout(() => {
                pokeCooldown = false;
                currentIndex = (currentIndex + 1) % sequence.length;
                runStep();
            }, 4500);
        }

        // Allow clicking name tag or card to poke
        const nameTags = document.querySelectorAll('.robot-name-tag');
        nameTags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                bot.poke();
            });
        });

        const card = document.getElementById('footerRobotCard');
        if (card) {
            card.addEventListener('click', () => {
                bot.poke();
            });
        }

        // Start auto-animation loop
        runStep();

        window.blintixRobot = bot;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooterRobot);
    } else {
        initFooterRobot();
    }
})();
