import React, { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import GraphVisualization from './GraphVisualization';

const AppRouter = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [jwtToken, setJwtToken] = useState(localStorage.getItem('jwtToken'));

    useEffect(() => {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            setIsLoggedIn(true);
            setJwtToken(token);
        }
    }, []);

    const handleLogin = (token) => {
        setIsLoggedIn(true);
        setJwtToken(token);
    };

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                <Route path="/visualization" element={isLoggedIn? <GraphVisualization jwtToken={jwtToken} /> : <Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRouter;