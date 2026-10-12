/**
 * Blintix Studio - Auto-Animated TV Robot (shape: rectangle)
 * Powered by robot-heads
 * 
 * Auto-cycles through lively expressions & states while remaining
 * fully interactive to mouse tracking & direct poke clicks.
 */
(function () {
    function initFooterRobot() {
        const stage = document.getElementById('footerRobotStage');
        if (!stage) return;
        if (typeof window.createRobotHead !== 'function') {
            console.warn('createRobotHead not loaded yet');
            return;
        }

        const speechEl = document.getElementById('robotSpeechText');

        // Sequence of auto-animated states with duration and contextual dialogue
        const sequence = [
            {
                state: 'idle',
                duration: 6500,
                quotes: [
                    "👀 Watching your cursor... move around!",
                    "👋 Hi! I'm Blinti. Tap me anytime!",
                    "✨ Blintix Studio: Ultra-fast & private.",
                    "⚡ Radically simple, high-performance tech."
                ]
            },
            {
                state: 'happy',
                duration: 5500,
                quotes: [
                    "🎉 100% happiness score achieved!",
                    "✨ Loving the Blintix vibe!",
                    "🚀 Great products start with craft & speed!",
                    "🌟 Everything running at smooth 60 FPS!"
                ]
            },
            {
                state: 'thinking',
                duration: 5500,
                quotes: [
                    "🧠 Pondering zero-latency architectures...",
                    "💡 Processing creative studio layouts...",
                    "🤔 Analyzing UX micro-interactions...",
                    "📊 Optimizing web performance metrics..."
                ]
            },
            {
                state: 'searching',
                duration: 5000,
                quotes: [
                    "🔍 Scanning cyberspace for clean code...",
                    "📡 Sweeping radar for bugs & bottlenecks...",
                    "🌐 Searching high and low across the web...",
                    "🛰️ Signal locked on next-gen tech!"
                ]
            },
            {
                state: 'speaking',
                duration: 5000,
                quotes: [
                    "🗣️ Welcome to Blintix Studio!",
                    "💬 Privacy-first, speed-obsessed.",
                    "📢 Explore ZipIt, Services, and our Journal!",
                    "🚀 Let's build something extraordinary together!"
                ]
            },
            {
                state: 'working',
                duration: 5500,
                quotes: [
                    "⚙️ Compiling pixels into magic...",
                    "⚡ Shipping production-ready software...",
                    "🔨 Polishing interactive UI components...",
                    "💻 Writing crisp, typed JavaScript..."
                ]
            }
        ];

        const pokeQuotes = [
            "💥 Boing! That tickles!",
            "🚀 Whoosh! Antenna bouncing!",
            "⚡ Blintix power surge!",
            "😄 Wheee! Nice poke!",
            "🎯 Direct hit! Wide awake and bouncing!",
            "✨ Spring physics activated!"
        ];

        function setSpeech(text) {
            if (!speechEl) return;
            speechEl.style.opacity = '0';
            speechEl.style.transform = 'translateY(2px)';
            setTimeout(() => {
                speechEl.textContent = text;
                speechEl.style.opacity = '1';
                speechEl.style.transform = 'translateY(0)';
            }, 120);
        }

        function pickRandom(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        // Initialize TV Robot Head (shape="rectangle")
        const bot = window.createRobotHead(stage, {
            shape: 'rectangle',
            state: sequence[0].state,
            size: 160,
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
            setSpeech(pickRandom(current.quotes));

            timer = setTimeout(() => {
                currentIndex = (currentIndex + 1) % sequence.length;
                runStep();
            }, current.duration);
        }

        function handlePoke() {
            setSpeech(pickRandom(pokeQuotes));
            pokeCooldown = true;
            if (timer) clearTimeout(timer);

            // Resume auto sequence after 4.5 seconds
            timer = setTimeout(() => {
                pokeCooldown = false;
                currentIndex = (currentIndex + 1) % sequence.length;
                runStep();
            }, 4500);
        }

        // Click anywhere on card to poke
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
