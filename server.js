const nodemailer = require('nodemailer');
const cron = require('node-cron');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

const app = express();

app.set('view engine', 'ejs');
const path = require('path');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Models
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

const Task = mongoose.model('Task', new mongoose.Schema({
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date },
    category: { type: String, default: 'General' }
}));

// Passport Config
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) return done(null, false);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false);
        return done(null, user);
    } catch (err) { return done(err); }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// Routes
app.get('/', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const tasks = await Task.find({ user: req.user.id });
    res.render('index', { taskList: tasks, user: req.user });
});

app.post('/add-task', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const newTask = new Task({
        text: req.body.taskName,
        user: req.user._id,
        dueDate: req.body.dueDate || new Date(),
        category: req.body.category || 'General'
    });
    await newTask.save();
    res.redirect('/');
});

app.post('/edit-task', async (req, res) => {
    const taskId = req.body.id || req.body.editIndex;
    await Task.findByIdAndUpdate(taskId, { text: req.body.newText || req.body.taskName });
    res.redirect('/');
});

app.post('/toggle-task', async (req, res) => {
    const task = await Task.findById(req.body.id);
    task.completed = !task.completed;
    await task.save();
    res.redirect('/');
});

app.post('/delete-task', async (req, res) => {
    await Task.findByIdAndDelete(req.body.id);
    res.redirect('/');
});

app.get('/signup', (req, res) => res.render('signup'));

app.post('/signup', async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await new User({ username: req.body.username, password: hashedPassword }).save();
    res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));
app.get('/logout', (req, res) => { req.logout(() => res.redirect('/login')); });

// Email Reminder (Every morning at 8:00 AM)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'janidudaham81@gmail.com', pass: 'mpbjsnfjnbhpasgl' }
});

cron.schedule('0 8 * * *', async () => {
    const today = new Date().setHours(0, 0, 0, 0);
    const tasks = await Task.find({ dueDate: { $gte: today, $lt: today + 86400000 }, completed: false });
    if (tasks.length > 0) {
        const list = tasks.map(t => `<li>${t.text} (${t.category})</li>`).join('');
        await transporter.sendMail({
            from: 'janidudaham81@gmail.com',
            to: 'janidudaham81@gmail.com',
            subject: '☀️ Today\'s Task Reminder',
            html: `<h3>Hi Janidu,</h3><p>Tasks for today:</p><ul>${list}</ul>`
        });
    }
});

// --- DATABASE CONNECTION & SERVER START ---
// ඔයාගේ ඇත්තම Password එක මෙතන දාන්න. Password එකේ @ තියෙනවා නම් %40 කියලා ලියන්න.
// මේ පේළිය හරියටම මෙහෙම තියෙනවාද බලන්න (වැඩිපුර අකුරු හෝ ඉඩක් නැතිව)
const dbURI = "mongodb+srv://admin:Janidu123@cluster0.zpsu2.mongodb.net/taskDB?retryWrites=true&w=majority";

mongoose.connect(dbURI)
  .then(() => console.log("MongoDB Connected!"))
  .catch(err => console.log("DB Error: ", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});