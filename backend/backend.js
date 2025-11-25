backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/notes', require('./routes/notes'));

// error handler
app.use((err, req, res, next) => {
  console.error(err); // logs go here
  res.status(err.status||500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));


backend/config/db.js

const mongoose = require('mongoose');

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};


backend/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);


backend/models/Note.js

const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', NoteSchema);


backend/middleware/auth.js

const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};


backend/routes/auth.js (signup/login)

const express = require('express');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register
router.post('/register', [
  check('name').notEmpty(),
  check('email').isEmail(),
  check('password').isLength({min:6})
], async (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if(user) return res.status(400).json({ msg: 'User already exists' });
    user = new User({ name, email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN }, (err, token) => {
      if(err) throw err;
      res.json({ token });
    });
  } catch (err) { next(err); }
});

// Login
router.post('/login', [
  check('email').isEmail(),
  check('password').exists()
], async (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN }, (err, token) => {
      if(err) throw err;
      res.json({ token });
    });
  } catch (err) { next(err); }
});

module.exports = router;


backend/routes/profile.js

const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) { next(err); }
});

router.put('/', auth, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;


backend/routes/notes.js (CRUD + search/filter)

const express = require('express');
const auth = require('../middleware/auth');
const Note = require('../models/Note');
const router = express.Router();

// Create
router.post('/', auth, async (req, res, next) => {
  try {
    const note = new Note({ ...req.body, user: req.user.id });
    await note.save();
    res.json(note);
  } catch (err) { next(err); }
});

// Read all (with optional search)
router.get('/', auth, async (req, res, next) => {
  try {
    const { q, tag } = req.query;
    const query = { user: req.user.id };
    if (q) query.$or = [{ title: new RegExp(q, 'i') }, { body: new RegExp(q, 'i') }];
    if (tag) query.tags = tag;
    const notes = await Note.find(query).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', auth, async (req, res, next) => {
  try {
    const note = await Note.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { ...req.body, updatedAt: Date.now() }, { new: true });
    if(!note) return res.status(404).json({ msg: 'Not found' });
    res.json(note);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if(!note) return res.status(404).json({ msg: 'Not found' });
    res.json({ msg: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
