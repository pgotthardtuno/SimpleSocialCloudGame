// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import http from 'http';

// Import routes and middleware
import authRoutes from './routes/auth';
import { protect, AuthenticatedRequest } from './middleware/authMiddleware'; // UserPayload not needed here directly

export function createExpressApp(): express.Application {
    const app: express.Application = express();

    console.log("Configuring Express app...");

    // --- Express Middleware ---
    app.use(express.json()); // For parsing application/json
    app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

    // --- Express API Routes ---
    console.log("Setting up API routes...");
    app.get('/api/ping', (req: Request, res: Response) => {
        res.json({ message: 'pong' });
    });
    app.use('/api/auth', authRoutes);
    app.get('/api/game/data', protect, (req: AuthenticatedRequest, res: Response) => {
        res.json({
            message: `Protected data for ${req.user?.username}!`,
            color: req.user?.color
        });
    });

    // --- Express Static File Serving ---
    console.log("Setting up static file serving...");
    const publicPath = path.join(__dirname, '../public');
    console.log(`Serving static files from: ${publicPath}`);
    app.get('/game.html', (req: Request, res: Response) => {
        res.sendFile(path.join(publicPath, 'game.html'));
    });
    app.use(express.static(publicPath)); // Serve static files (CSS, JS, images)
    app.get('/', (req: Request, res: Response) => { // Root serves index.html
        res.sendFile(path.join(publicPath, 'index.html'));
    });

    // --- Express Error Handling (Keep this last) ---
    console.log("Setting up final error handler...");
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error("Unhandled Error:", err.stack || err);
        const statusCode = (err as any).status || 500;
        const message = process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : err.message;
        // Ensure response is sent only once
        if (!res.headersSent) {
            res.status(statusCode).json({ message: message });
        } else {
            next(err); // Pass to default handler if headers already sent
        }
    });

    console.log("Express app configuration complete.");
    return app;
}

// Function to create the HTTP server (useful for separating concerns)
export function createHttpServer(app: express.Application): http.Server {
    return http.createServer(app);
}