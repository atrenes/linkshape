import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './styles.css';

const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/login', { username, password });
            const token = response.data;
            localStorage.setItem('jwtToken', token);
            onLogin(token);
            setUsername('');
            setPassword('');
            navigate('/visualization');
        } catch (error) {
            console.error('Login failed:', error);
            setError(error.response?.data?.message || 'An unknown error occurred. Please try again.');
        }
    };

    return (
        <div className={'form-container'}>
            <h1 className={'app-title'}>Log in to continue</h1>
            <form onSubmit={handleSubmit}>
                <div className={'input-group'}>
                    <label>
                        <p className={'highlight-input'}>Username</p>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </label>
                    <label>
                        <p className={'highlight-input'}>Password</p>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </label>
                </div>
                {error && <p className="error-message">{error}</p>}
                <div className={'button-group'}>
                    <button type="submit" className={'button-blue'}>Log In</button>
                </div>
            </form>
        </div>
    );
};

export default LoginPage;