import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUsers, saveUsers } from '../utils/db.js';
import { sendAdminLoginAlert } from '../services/smsService.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lexguard_super_secret_key_123';

// Helper to default to +91 for Indian numbers if no country code is provided
const formatPhone = (phone) => {
    if (!phone) return phone;
    let p = phone.trim();
    if (!p.startsWith('+')) {
        p = '+91' + p;
    }
    return p;
};

// Signup
router.post('/signup', async (req, res) => {
    try {
        let { email, password, phone, name } = req.body;
        phone = formatPhone(phone);

        if (!email || !password || !phone) {
            return res.status(400).json({ error: 'Email, password, and phone are required' });
        }

        const users = getUsers();
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: hashedPassword,
            phone
        };

        users.push(newUser);
        saveUsers(users);

        const token = jwt.sign({ id: newUser.id, email: newUser.email, phone: newUser.phone }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone }
        });
    } catch (err) {
        console.error('[Auth] Signup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        let { email, password, phone } = req.body;
        phone = formatPhone(phone);

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const users = getUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update phone if provided
        if (phone && phone !== user.phone) {
            user.phone = phone;
            saveUsers(users);
        }

        const activePhone = phone || user.phone;
        
        // Send notifications non-blocking
        sendWelcomeEmail(user.email, user.name || 'User').catch(e => console.error(e));
        sendAdminLoginAlert(user.name, user.email).catch(e => console.error(e));

        const token = jwt.sign({ id: user.id, email: user.email, phone: activePhone }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Logged in successfully',
            token,
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
        });
    } catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
