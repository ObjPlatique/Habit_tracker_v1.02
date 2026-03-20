class HabitTracker {
    constructor() {
        this.habits = JSON.parse(localStorage.getItem('habits')) || [];
        this.notes = JSON.parse(localStorage.getItem('notes')) || {};

        this.init();
        this.render();
        this.startReminder();
    }

    init() {
        document.getElementById('addBtn').onclick = () => this.addHabit();

        document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            document.body.classList.toggle('dark', e.target.checked);
            localStorage.setItem('dark', e.target.checked);
        });

        if (localStorage.getItem('dark') === 'true') {
            document.body.classList.add('dark');
            document.getElementById('darkModeToggle').checked = true;
        }

        document.getElementById('saveNoteBtn').onclick = () => {
            const date = this.today();
            this.notes[date] = document.getElementById('dayNote').value;
            localStorage.setItem('notes', JSON.stringify(this.notes));
        };
    }

    today() {
        return new Date().toISOString().slice(0,10);
    }

    addHabit() {
        const name = document.getElementById('habitInput').value;
        const goal = parseInt(document.getElementById('goalInput').value) || 1;
        const reminder = document.getElementById('reminderInput').value;

        this.habits.push({
            id: Date.now(),
            name,
            goal,
            reminder,
            progress: {},
            completedDates: []
        });

        this.save();
        this.render();
    }

    toggle(id) {
        const today = this.today();
        const h = this.habits.find(x => x.id === id);

        if (!h.progress[today]) h.progress[today] = 0;

        h.progress[today]++;

        if (h.progress[today] >= h.goal) {
            if (!h.completedDates.includes(today)) {
                h.completedDates.push(today);
            }
        }

        this.save();
        this.render();
    }

    render() {
        const el = document.getElementById('dailyGrid');
        const today = this.today();

        el.innerHTML = this.habits.map(h => {
            const p = h.progress[today] || 0;
            const percent = Math.min((p / h.goal) * 100, 100);

            return `
            <div class="daily-habit-item">
                <b>${h.name}</b>
                <div>${p}/${h.goal}</div>

                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percent}%"></div>
                </div>

                <button onclick="app.toggle(${h.id})">+1</button>
            </div>
            `;
        }).join('');
    }

    save() {
        localStorage.setItem('habits', JSON.stringify(this.habits));
    }

    startReminder() {
        setInterval(() => {
            const now = new Date().toTimeString().slice(0,5);

            this.habits.forEach(h => {
                if (h.reminder === now) {
                    alert('Reminder: ' + h.name);
                }
            });
        }, 60000);
    }
}

const app = new HabitTracker();