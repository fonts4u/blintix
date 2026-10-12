/**
 * Blintix Studio - Interactive Footer Robot Companion
 * Powered by robot-heads (shape: rectangle)
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
        const stateChips = document.querySelectorAll('.state-chip');
        const swatchBtns = document.querySelectorAll('.swatch-btn');
        const shapeSelect = document.getElementById('robotShapeSelect');
        const pokeBtn = document.getElementById('robotPokeBtn');

        const quotes = {
            idle: [
                "👀 Watching your cursor... move around!",
                "👋 Hi! I'm Blinti. Poke me or change my mood!",
                "✨ Blintix Studio: Ultra-fast & private.",
                "⚡ Designed for speed, craft, and radical simplicity.",
                "📡 Standing by for your next command."
            ],
            poked: [
                "💥 Boing! That tickles!",
                "🚀 Whoosh! Antenna bouncing!",
                "⚡ Blintix power surge!",
                "😄 Wheee! Nice poke!",
                "🎯 Direct hit! Wide awake and ready!",
                "✨ Spring physics activated!"
            ],
            happy: [
                "✨ Loving the Blintix vibe!",
                "🎉 100% happiness score achieved!",
                "🚀 Great products start with speed & craft!",
                "💖 High five, human!",
                "🌟 Everything is running at 60 FPS!"
            ],
            thinking: [
                "🧠 Pondering zero-latency architectures...",
                "💡 Processing creative studio layouts...",
                "🤔 Analyzing UX micro-interactions...",
                "📊 Optimizing web performance metrics...",
                "⚙️ Computing next breakthrough..."
            ],
            searching: [
                "🔍 Scanning the web for clean code...",
                "📡 Sweeping radar for bugs & bottlenecks...",
                "🌐 Searching high and low across cyberspace...",
                "🛰️ Signal locked on next-gen tech!",
                "🔎 Analyzing digital tokens..."
            ],
            working: [
                "⚙️ Compiling pixels into magic...",
                "⚡ Shipping production-ready software...",
                "🔨 Polishing high-performance UI components...",
                "🚀 Deploying with zero compromises!",
                "💻 Writing crisp, typed JavaScript..."
            ],
            speaking: [
                "🗣️ Welcome to Blintix Studio!",
                "🎙️ Privacy-first, speed-obsessed.",
                "💬 Let's build something extraordinary together!",
                "📢 Explore ZipIt, Services, and our Journal!",
                "👋 Need custom engineering? Reach out to us!"
            ],
            sleeping: [
                "😴 Zzz... wake me up with a poke...",
                "🌙 Recharging solar capacitors...",
                "💤 Low-power standby mode active...",
                "🛌 Dreaming in clean binary code...",
                "✨ Snoozing until you click me..."
            ]
        };

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

        function getRandomQuote(category) {
            const list = quotes[category] || quotes.idle;
            return list[Math.floor(Math.random() * list.length)];
        }

        // Initialize Robot Head (Default shape: rectangle as requested)
        const bot = window.createRobotHead(stage, {
            shape: 'rectangle', // classic TV monitor with antenna & knob ears
            state: 'idle',
            size: 150,
            color: '#2b49a3', // Cobalt
            trimColor: '#93a6c8',
            screenColor: '#e8f2ff',
            interactive: true,
            floorShadow: true,
            antenna: true,
            onPoke: function (currentState) {
                setSpeech(getRandomQuote('poked'));
                if (currentState === 'sleeping') {
                    setActiveState('happy');
                }
            }
        });

        if (!bot) return;

        function setActiveState(state) {
            bot.setState(state);
            stateChips.forEach(chip => {
                if (chip.getAttribute('data-state') === state) {
                    chip.classList.add('active');
                    chip.setAttribute('aria-pressed', 'true');
                } else {
                    chip.classList.remove('active');
                    chip.setAttribute('aria-pressed', 'false');
                }
            });
            setSpeech(getRandomQuote(state));
        }

        // State Chips
        stateChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const state = chip.getAttribute('data-state');
                if (state) {
                    setActiveState(state);
                }
            });
        });

        // Color Swatches
        swatchBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const color = btn.getAttribute('data-color');
                if (color) {
                    bot.setColors(color);
                    swatchBtns.forEach(b => {
                        b.classList.remove('active');
                        b.setAttribute('aria-selected', 'false');
                    });
                    btn.classList.add('active');
                    btn.setAttribute('aria-selected', 'true');
                    setSpeech("🎨 Fresh coat of paint! Looking sharp.");
                }
            });
        });

        // Shape Selector (Rectangle TV is default)
        if (shapeSelect) {
            shapeSelect.addEventListener('change', (e) => {
                const shape = e.target.value;
                bot.setShape(shape);
                setSpeech(`✨ Shape switched to ${shape.toUpperCase()} TV!`);
            });
        }

        // Poke Button
        if (pokeBtn) {
            pokeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                bot.poke();
            });
        }

        // Set initial random idle greeting
        setSpeech(getRandomQuote('idle'));

        // Expose instance for developer console exploration
        window.blintixRobot = bot;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooterRobot);
    } else {
        initFooterRobot();
    }
})();
